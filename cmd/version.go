/**
 * @copyright Copyright © 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

package cmd

import (
	"bufio"
	"fmt"
	"strings"

	"github.com/CGuiho/mirror/pkg/config"
	"github.com/CGuiho/mirror/pkg/hooks"
	"github.com/CGuiho/mirror/pkg/versioning"
	"github.com/spf13/cobra"
)

func newVersionCommand(deps Dependencies) *cobra.Command {
	command := &cobra.Command{
		Use:   "version",
		Short: "Inspect, plan, and apply semantic version changes.",
		Args:  cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			return command.Help()
		},
	}
	addVersionOverrideFlags(command)
	command.AddCommand(newVersionCurrentCommand(deps))
	command.AddCommand(newVersionNextCommand(deps))
	command.AddCommand(newVersionPlanCommand(deps))
	command.AddCommand(newVersionApplyCommand(deps))
	return command
}

func newVersionCurrentCommand(deps Dependencies) *cobra.Command {
	return &cobra.Command{
		Use:   "current",
		Short: "Print the current configured version.",
		Args:  cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			plan, err := buildPlan(command, deps, "patch")
			if err != nil {
				return err
			}
			if outputFormat(command) == "json" {
				return writeJSON(deps.Out, successEnvelope{
					OK: true, Command: command.CommandPath(),
					Result: map[string]any{"version": plan.CurrentVersion, "source": plan.Source},
				})
			}
			fmt.Fprintln(deps.Out, plan.CurrentVersion)
			return nil
		},
	}
}

func newVersionNextCommand(deps Dependencies) *cobra.Command {
	return &cobra.Command{
		Use:   "next <target>",
		Short: "Calculate the next version without building an action plan.",
		Args:  cobra.ExactArgs(1),
		RunE: func(command *cobra.Command, args []string) error {
			plan, err := buildPlan(command, deps, args[0])
			if err != nil {
				return err
			}
			if outputFormat(command) == "json" {
				return writeJSON(deps.Out, successEnvelope{
					OK: true, Command: command.CommandPath(),
					Result: map[string]any{"current": plan.CurrentVersion, "next": plan.NextVersion},
				})
			}
			fmt.Fprintln(deps.Out, plan.NextVersion)
			return nil
		},
	}
}

func newVersionPlanCommand(deps Dependencies) *cobra.Command {
	var dryRun bool
	command := &cobra.Command{
		Use:   "plan <target>",
		Short: "Build a version plan without applying it.",
		Args:  cobra.ExactArgs(1),
		RunE: func(command *cobra.Command, args []string) error {
			plan, err := buildPlan(command, deps, args[0])
			if err != nil {
				return err
			}
			plan.DryRun = dryRun
			return renderVersionPlan(command, deps, plan)
		},
	}
	command.Flags().BoolVar(&dryRun, "dry-run", false, "Mark the read-only plan as a dry run.")
	return command
}

func newVersionApplyCommand(deps Dependencies) *cobra.Command {
	var dryRun bool
	var confirmed bool
	var runHooks bool
	var skipHooks bool
	command := &cobra.Command{
		Use:   "apply <target>",
		Short: "Apply a version plan and its exact Git refs.",
		Args:  cobra.ExactArgs(1),
		RunE: func(command *cobra.Command, args []string) error {
			if runHooks && skipHooks {
				return withExitCode(2, fmt.Errorf("--run-hooks and --skip-hooks are mutually exclusive"))
			}
			cfg, path, cwd, err := loadVersionInputs(command, deps)
			if err != nil {
				return err
			}
			if dryRun {
				plan, err := versioning.BuildPlanWithRunner(cfg, path, args[0], cwd, deps.Runner)
				if err != nil {
					return err
				}
				plan.DryRun = true
				return renderVersionPlan(command, deps, plan)
			}
			if !confirmed {
				return fmt.Errorf("refusing to apply without confirmation; pass --yes")
			}
			executeHooks, err := resolveCommandHookTrust(deps, cfg.Hooks, runHooks, skipHooks)
			if err != nil {
				return err
			}
			plan, results, stage, err := executeVersionApply(command, deps, cfg, path, cwd, args[0], executeHooks)
			if err != nil {
				if outputFormat(command) == "json" {
					failure := map[string]any{"stage": stage, "error": err.Error(), "hooks": results}
					if plan != nil {
						failure["plan"] = plan
					}
					if writeErr := writeJSON(deps.Out, map[string]any{
						"ok": false, "command": command.CommandPath(), "result": failure,
					}); writeErr != nil {
						return writeErr
					}
				}
				return err
			}
			return renderVersionPlan(command, deps, plan)
		},
	}
	command.Flags().BoolVar(&dryRun, "dry-run", false, "Build the plan without mutation.")
	command.Flags().BoolVar(&confirmed, "yes", false, "Apply without an interactive confirmation prompt.")
	command.Flags().BoolVar(&runHooks, "run-hooks", false, "Trust and execute configured command hooks.")
	command.Flags().BoolVar(&skipHooks, "skip-hooks", false, "Apply without executing configured command hooks.")
	return command
}

func loadVersionInputs(command *cobra.Command, deps Dependencies) (*config.MirrorConfig, string, string, error) {
	cfg, path, err := loadConfig(command, deps)
	if err != nil {
		return nil, "", "", err
	}
	if err := applyVersionOverrides(command, cfg); err != nil {
		return nil, "", "", err
	}
	reportLoadedConfig(deps, path)
	cwd, err := effectiveCWD(command, deps)
	if err != nil {
		return nil, "", "", err
	}
	return cfg, path, cwd, nil
}

func resolveCommandHookTrust(deps Dependencies, configured config.HooksConfig, runHooks, skipHooks bool) (bool, error) {
	if !configured.HasCommands() {
		return false, nil
	}
	events := configured.CommandEvents()
	names := make([]string, 0, len(events))
	for _, event := range events {
		names = append(names, string(event))
	}
	fmt.Fprintf(deps.Err, "command hooks configured: %d across %s\n", configured.CommandCount(), strings.Join(names, ", "))
	if runHooks {
		return true, nil
	}
	if skipHooks {
		return false, nil
	}
	if !deps.IsTerminal() {
		return false, fmt.Errorf("command hooks are configured; pass --run-hooks to trust them or --skip-hooks to bypass them")
	}
	fmt.Fprint(deps.Err, "Run configured command hooks? [y/N] ")
	answer, err := bufio.NewReader(deps.In).ReadString('\n')
	if err != nil && strings.TrimSpace(answer) == "" {
		return false, fmt.Errorf("read command-hook confirmation: %w", err)
	}
	switch strings.ToLower(strings.TrimSpace(answer)) {
	case "y", "yes":
		return true, nil
	default:
		return false, nil
	}
}

func executeVersionApply(
	command *cobra.Command,
	deps Dependencies,
	cfg *config.MirrorConfig,
	path, cwd, target string,
	executeHooks bool,
) (*versioning.VersionPlan, []hooks.Result, string, error) {
	if !executeHooks {
		plan, err := versioning.BuildPlanWithRunner(cfg, path, target, cwd, deps.Runner)
		if err != nil {
			return nil, nil, "plan", err
		}
		err = versioning.ApplyPlanWithOptions(plan, cwd, versioning.ApplyOptions{
			Confirmed: true, Runner: deps.Runner, Context: command.Context(),
		})
		return plan, nil, "apply", err
	}

	session, err := hooks.NewSession(hooks.Options{
		Config: cfg.Hooks, CWD: cwd, ConfigPath: path, Target: target,
		Runner: deps.HookRunner, Reporter: deps.Err, JSON: outputFormat(command) == "json",
	})
	if err != nil {
		return nil, nil, "everything", err
	}

	var plan *versioning.VersionPlan
	stage := "everything"
	primary := func() error {
		baseContext := hooks.Context{Stage: "everything"}
		if err := session.Run(command.Context(), config.HookBeforeEverything, baseContext); err != nil {
			return err
		}
		stage = "plan"
		if err := session.Run(command.Context(), config.HookBeforePlan, hooks.Context{Stage: "plan"}); err != nil {
			return err
		}
		built, err := versioning.BuildPlanWithRunner(cfg, path, target, cwd, deps.Runner)
		if err != nil {
			return err
		}
		plan = built
		planContext := versioning.HookContextForPlan(plan)
		if err := session.Run(command.Context(), config.HookAfterPlan, planContext); err != nil {
			return err
		}

		stage = "apply"
		planContext.Stage = "apply"
		if err := session.Run(command.Context(), config.HookBeforeApply, planContext); err != nil {
			return err
		}
		if err := versioning.ApplyPlanWithOptions(plan, cwd, versioning.ApplyOptions{
			Confirmed: true, Runner: deps.Runner, Context: command.Context(), Hooks: session,
		}); err != nil {
			return err
		}
		planContext = versioning.HookContextForPlan(plan)
		planContext.Stage = "apply"
		if err := session.Run(command.Context(), config.HookAfterApply, planContext); err != nil {
			return err
		}
		return nil
	}()

	secondary := session.SecondaryErrors()
	finalContext := versioning.HookContextForPlan(plan)
	if primary != nil {
		finalContext.ErrorStage = stage
		finalContext.ErrorMessage = primary.Error()
		finalContext.ErrorExitCode = hooks.ExitCode(primary)
		finalContext.Secondary = hooks.Strings(secondary)
		switch stage {
		case "plan":
			secondary = append(secondary, session.RunBestEffort(command.Context(), config.HookOnPlanError, finalContext)...)
		case "apply":
			secondary = append(secondary, session.RunBestEffort(command.Context(), config.HookOnApplyError, finalContext)...)
		}
		finalContext.Secondary = hooks.Strings(secondary)
		secondary = append(secondary, session.RunBestEffort(command.Context(), config.HookOnError, finalContext)...)
	}
	finalContext.Secondary = hooks.Strings(secondary)
	finalizerFailures := session.RunBestEffort(command.Context(), config.HookAfterEverything, finalContext)
	secondary = append(secondary, finalizerFailures...)
	if cleanupErr := session.Cleanup(); cleanupErr != nil {
		secondary = append(secondary, fmt.Errorf("remove hook context: %w", cleanupErr))
	}
	results := session.Results()
	if plan != nil {
		plan.HookResults = results
	}
	if primary == nil && len(secondary) > 0 {
		primary = secondary[0]
		secondary = secondary[1:]
		stage = "everything"
	}
	return plan, results, stage, hooks.WithSecondary(primary, secondary)
}

func buildPlan(command *cobra.Command, deps Dependencies, target string) (*versioning.VersionPlan, error) {
	cfg, path, err := loadConfig(command, deps)
	if err != nil {
		return nil, err
	}
	if err := applyVersionOverrides(command, cfg); err != nil {
		return nil, err
	}
	reportLoadedConfig(deps, path)
	cwd, err := effectiveCWD(command, deps)
	if err != nil {
		return nil, err
	}
	return versioning.BuildPlanWithRunner(cfg, path, target, cwd, deps.Runner)
}

func renderVersionPlan(command *cobra.Command, deps Dependencies, plan *versioning.VersionPlan) error {
	if outputFormat(command) == "json" {
		return writeJSON(deps.Out, successEnvelope{OK: true, Command: command.CommandPath(), Result: plan})
	}
	fmt.Fprint(deps.Out, versioning.FormatPlanText(plan))
	return nil
}

func addVersionOverrideFlags(command *cobra.Command) {
	flags := command.PersistentFlags()
	flags.String("source", "", "Override package.json, jsr.json, or git as the source.")
	flags.StringSlice("output", nil, "Override output adapters; repeat or comma-separate values.")
	flags.String("package-file", "", "Override the package.json path.")
	flags.String("jsr-file", "", "Override the jsr.json path.")
	flags.StringSlice("auxiliary", nil, "Override auxiliary package.json paths.")
	flags.String("tag-template", "", "Override the Git tag template.")
	flags.String("name", "", "Override the project name.")
	flags.String("preid", "", "Override the prerelease identifier.")
	flags.Bool("commit", false, "Create a release commit when file outputs change.")
	flags.Bool("push", false, "Push the release commit and exact planned tag.")
	flags.Bool("allow-dirty", false, "Allow a dirty Git worktree.")
}

func applyVersionOverrides(command *cobra.Command, cfg *config.MirrorConfig) error {
	flags := command.Flags()
	if flags.Changed("source") {
		cfg.Version.Source, _ = flags.GetString("source")
	}
	if flags.Changed("output") {
		cfg.Version.Output, _ = flags.GetStringSlice("output")
	}
	if flags.Changed("package-file") {
		cfg.Package.Path, _ = flags.GetString("package-file")
	}
	if flags.Changed("jsr-file") {
		cfg.JSR.Path, _ = flags.GetString("jsr-file")
	}
	if flags.Changed("auxiliary") {
		cfg.Package.AuxiliaryPaths, _ = flags.GetStringSlice("auxiliary")
	}
	if flags.Changed("tag-template") {
		cfg.Git.TagTemplate, _ = flags.GetString("tag-template")
	}
	if flags.Changed("name") {
		cfg.Project.Name, _ = flags.GetString("name")
		cfg.Project.NameSource = ""
	}
	if flags.Changed("preid") {
		cfg.Version.PrereleaseID, _ = flags.GetString("preid")
	}
	if flags.Changed("commit") {
		cfg.Git.Commit, _ = flags.GetBool("commit")
	}
	if flags.Changed("push") {
		cfg.Git.Push, _ = flags.GetBool("push")
	}
	if flags.Changed("allow-dirty") {
		cfg.Git.AllowDirty, _ = flags.GetBool("allow-dirty")
	}
	if cfg.Git.Push {
		cfg.Git.Commit = true
	}
	return cfg.Validate()
}
