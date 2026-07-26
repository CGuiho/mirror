/**
 * @copyright Copyright © 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

package cmd

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	embedFS "github.com/CGuiho/mirror/embed"
	"github.com/CGuiho/mirror/pkg/maintenance"
	"github.com/CGuiho/mirror/pkg/update"
	"github.com/CGuiho/mirror/pkg/updater"
	"github.com/CGuiho/mirror/pkg/versioning"
	"github.com/spf13/cobra"
)

// Version remains only as a compatibility fallback for older build scripts.
// New release builds inject main.version and pass it through BuildInfo.
var Version = "dev"

type BuildInfo struct {
	Version   string `json:"version"`
	Commit    string `json:"commit,omitempty"`
	BuildDate string `json:"build_date,omitempty"`
	Target    string `json:"target,omitempty"`
}

type Dependencies struct {
	In               io.Reader
	Out              io.Writer
	Err              io.Writer
	Getwd            func() (string, error)
	HomeDir          func() (string, error)
	Runner           versioning.Runner
	HTTPClient       *http.Client
	Now              func() time.Time
	Executable       func() (string, error)
	ReadUpdateNotice func(string, time.Time) string
	LaunchUpdate     func(string, string) error
	ConsumeUpgrade   func() (*updater.Completion, error)
	ReconcileUpgrade func(string) error
	ReconcileBinary  func(string, string) error
	BootstrapAgents  func(string) error
	IsTerminal       func() bool
}

type successEnvelope struct {
	OK      bool   `json:"ok"`
	Command string `json:"command"`
	Result  any    `json:"result"`
}

var errHelpRendered = errors.New("help output rendered")

func NewRootCommand(deps Dependencies, info BuildInfo) *cobra.Command {
	deps = normalizeDependencies(deps)
	info = normalizeBuildInfo(info)

	var showVersion bool
	startupDone := false
	root := &cobra.Command{
		Use:           "mirror",
		Short:         "Deterministic semantic versioning for GUIHO projects.",
		Long:          "Deterministic semantic versioning for GUIHO projects.",
		Args:          cobra.NoArgs,
		SilenceErrors: true,
		SilenceUsage:  true,
		RunE: func(command *cobra.Command, _ []string) error {
			if showVersion {
				if outputFormat(command) == "json" {
					return writeJSON(deps.Out, successEnvelope{OK: true, Command: command.CommandPath(), Result: info})
				}
				fmt.Fprintf(deps.Out, "mirror v%s\n", info.Version)
				return nil
			}
			cwd, err := effectiveCWD(command, deps)
			if err != nil {
				return err
			}
			if err := deps.BootstrapAgents(cwd); err != nil {
				return fmt.Errorf("bootstrap Mirror agent resources: %w", err)
			}
			if outputFormat(command) == "json" {
				return writeJSON(deps.Out, successEnvelope{
					OK: true, Command: command.CommandPath(),
					Result: map[string]string{"message": "Hello Windows - mirror v" + info.Version},
				})
			}
			fmt.Fprintf(deps.Out, "Hello Windows - mirror v%s\n", info.Version)
			return nil
		},
		PersistentPreRunE: func(command *cobra.Command, _ []string) error {
			format := outputFormat(command)
			if format != "text" && format != "json" {
				return fmt.Errorf("format must be text or json")
			}
			tree, _ := command.Flags().GetBool("help-tree")
			docs, _ := command.Flags().GetBool("help-docs")
			depth, _ := command.Flags().GetInt("help-tree-depth")
			if command.Flags().Changed("help-tree-depth") && depth <= 0 {
				return fmt.Errorf("help-tree-depth must be a positive integer")
			}
			if tree && docs {
				return fmt.Errorf("help-tree and help-docs are mutually exclusive")
			}
			if tree {
				renderHelpTree(deps.Out, command, depth)
				return errHelpRendered
			}
			if docs {
				renderHelpDocs(deps.Out, command)
				return errHelpRendered
			}
			if !startupDone && !showVersion && command.Name() != "__update-worker" {
				startupDone = true
				if completion, err := deps.ConsumeUpgrade(); err == nil && completion != nil {
					fmt.Fprintf(deps.Err, "Mirror upgrade %s: %s (verification: %s, rollback: %s)\n", completion.TargetVersion, completion.Outcome, completion.Verification, completion.Rollback)
					if completion.Failure != "" {
						fmt.Fprintf(deps.Err, "Upgrade failure: %s\nRecovery: %s\n", completion.Failure, completion.Recovery)
					}
					if completion.Outcome == "succeeded" {
						if cwd, cwdErr := effectiveCWD(command, deps); cwdErr == nil {
							if reconcileErr := deps.ReconcileUpgrade(cwd); reconcileErr != nil {
								fmt.Fprintf(deps.Err, "Post-upgrade agent reconciliation failed: %v\n", reconcileErr)
							}
						}
					}
				}
				if notice := deps.ReadUpdateNotice(info.Version, deps.Now()); notice != "" {
					fmt.Fprint(deps.Err, notice)
				}
				if executable, err := deps.Executable(); err == nil {
					_ = deps.LaunchUpdate(executable, info.Version)
				}
			}
			return nil
		},
	}
	root.SetIn(deps.In)
	root.SetOut(deps.Out)
	root.SetErr(deps.Err)
	root.CompletionOptions.DisableDefaultCmd = true
	root.SetFlagErrorFunc(func(_ *cobra.Command, err error) error {
		return withExitCode(2, err)
	})

	flags := root.PersistentFlags()
	flags.String("config", "", "Use this mirror.yaml file.")
	flags.String("cwd", "", "Run as if Mirror started in this directory.")
	flags.String("format", "text", "Select text or JSON output.")
	flags.Bool("color", false, "Enable ANSI color output when supported.")
	flags.Bool("verbose", false, "Show full error details.")
	flags.Bool("help-tree", false, "Show command hierarchy.")
	flags.Int("help-tree-depth", 0, "Limit help-tree recursion depth.")
	flags.Bool("help-docs", false, "Emit deterministic Markdown documentation.")
	root.Flags().BoolVarP(&showVersion, "version", "v", false, "Show the Mirror version.")

	root.AddCommand(newInitCommand(deps))
	root.AddCommand(newConfigCommand(deps))
	root.AddCommand(newAgentCommand(deps))
	root.AddCommand(newVersionCommand(deps))
	root.AddCommand(newUpgradeCommand(deps, info))
	root.AddCommand(newUninstallCommand(deps))
	return root
}

// Execute builds a fresh command tree on every call. main should handle the
// returned error and map it to a process exit code.
func Execute(build ...BuildInfo) error {
	info := BuildInfo{}
	if len(build) > 0 {
		info = build[0]
	}
	err := NewRootCommand(Dependencies{}, info).Execute()
	if errors.Is(err, errHelpRendered) {
		return nil
	}
	return err
}

func ExecuteContext(ctx context.Context, deps Dependencies, info BuildInfo, args []string) error {
	root := NewRootCommand(deps, info)
	root.SetArgs(args)
	err := root.ExecuteContext(ctx)
	if errors.Is(err, errHelpRendered) {
		return nil
	}
	return err
}

func normalizeDependencies(deps Dependencies) Dependencies {
	if deps.In == nil {
		deps.In = os.Stdin
	}
	if deps.Out == nil {
		deps.Out = os.Stdout
	}
	if deps.Err == nil {
		deps.Err = os.Stderr
	}
	if deps.Getwd == nil {
		deps.Getwd = os.Getwd
	}
	if deps.HomeDir == nil {
		deps.HomeDir = func() (string, error) {
			if override := os.Getenv("MIRROR_HOME_DIR"); override != "" {
				return filepath.Abs(override)
			}
			return os.UserHomeDir()
		}
	}
	if deps.Runner == nil {
		deps.Runner = versioning.ExecRunner{}
	}
	if deps.Now == nil {
		deps.Now = time.Now
	}
	if deps.Executable == nil {
		deps.Executable = os.Executable
	}
	if deps.ReadUpdateNotice == nil {
		deps.ReadUpdateNotice = update.ReadNotice
	}
	if deps.LaunchUpdate == nil {
		deps.LaunchUpdate = func(executable, currentVersion string) error {
			return update.LaunchBackgroundWorker(executable, currentVersion, update.CatalogOptions{})
		}
	}
	if deps.ConsumeUpgrade == nil {
		deps.ConsumeUpgrade = updater.ConsumeCompletion
	}
	if deps.ReconcileUpgrade == nil {
		deps.ReconcileUpgrade = func(cwd string) error {
			home, err := deps.HomeDir()
			if err != nil {
				return fmt.Errorf("resolve user home: %w", err)
			}
			if _, err := maintenance.InstallAgentSkills(embedFS.FS, home, true); err != nil {
				return err
			}
			_, err = maintenance.ApplyInstructions(embedFS.FS, cwd)
			return err
		}
	}
	if deps.BootstrapAgents == nil {
		deps.BootstrapAgents = func(cwd string) error {
			home, err := deps.HomeDir()
			if err != nil {
				return fmt.Errorf("resolve user home: %w", err)
			}
			if _, err := maintenance.InstallAgentSkills(embedFS.FS, home, true); err != nil {
				return err
			}
			_, err = maintenance.ApplyInstructions(embedFS.FS, cwd)
			return err
		}
	}
	if deps.ReconcileBinary == nil {
		deps.ReconcileBinary = reconcileInstalledResources
	}
	if deps.HTTPClient == nil {
		deps.HTTPClient = &http.Client{Timeout: 15 * time.Second}
	}
	if deps.IsTerminal == nil {
		deps.IsTerminal = func() bool {
			info, err := os.Stdin.Stat()
			return err == nil && info.Mode()&os.ModeCharDevice != 0
		}
	}
	return deps
}

func normalizeBuildInfo(info BuildInfo) BuildInfo {
	if info.Version == "" {
		info.Version = Version
	}
	if info.Version == "" {
		info.Version = "dev"
	}
	if info.Target == "" {
		info.Target = "development"
	}
	return info
}

func outputFormat(command *cobra.Command) string {
	format, err := command.Flags().GetString("format")
	if err != nil || format == "" {
		return "text"
	}
	return strings.ToLower(format)
}

func effectiveCWD(command *cobra.Command, deps Dependencies) (string, error) {
	cwd, err := command.Flags().GetString("cwd")
	if err != nil {
		return "", err
	}
	if cwd == "" {
		cwd, err = deps.Getwd()
		if err != nil {
			return "", fmt.Errorf("resolve working directory: %w", err)
		}
	}
	absolute, err := filepath.Abs(cwd)
	if err != nil {
		return "", fmt.Errorf("resolve working directory %q: %w", cwd, err)
	}
	return absolute, nil
}

func writeAtomic(path string, data []byte, mode os.FileMode) error {
	temp, err := os.CreateTemp(filepath.Dir(path), "."+filepath.Base(path)+".mirror-*")
	if err != nil {
		return fmt.Errorf("create temporary file for %s: %w", path, err)
	}
	tempPath := temp.Name()
	defer os.Remove(tempPath)
	if _, err := temp.Write(data); err != nil {
		temp.Close()
		return fmt.Errorf("write temporary file for %s: %w", path, err)
	}
	if err := temp.Sync(); err != nil {
		temp.Close()
		return fmt.Errorf("sync temporary file for %s: %w", path, err)
	}
	if err := temp.Close(); err != nil {
		return fmt.Errorf("close temporary file for %s: %w", path, err)
	}
	if err := os.Chmod(tempPath, mode); err != nil {
		return fmt.Errorf("set mode for %s: %w", path, err)
	}
	backup := tempPath + ".backup"
	if _, err := os.Stat(path); err == nil {
		if err := os.Rename(path, backup); err != nil {
			return fmt.Errorf("stage existing %s: %w", path, err)
		}
	}
	if err := os.Rename(tempPath, path); err != nil {
		_ = os.Rename(backup, path)
		return fmt.Errorf("replace %s: %w", path, err)
	}
	_ = os.Remove(backup)
	return nil
}
