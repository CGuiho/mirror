package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/CGuiho/mirror/pkg/update"
	"github.com/CGuiho/mirror/pkg/updater"
	"github.com/spf13/cobra"
)

func newUpgradeCommand(deps Dependencies, info BuildInfo) *cobra.Command {
	var requested string
	var dryRun bool
	command := &cobra.Command{
		Use:   "upgrade",
		Short: "Upgrade the installed Mirror native binary.",
		Args:  cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			release, asset, manifest, err := resolveUpgrade(command.Context(), deps, requested, info.Target)
			if err != nil {
				return withExitCode(4, err)
			}
			if dryRun {
				result := map[string]any{
					"currentVersion": info.Version, "targetVersion": release.Version,
					"asset": asset.Name, "url": asset.BrowserDownloadURL,
					"checksums": manifest.BrowserDownloadURL, "dryRun": true,
				}
				if outputFormat(command) == "json" {
					return writeJSON(deps.Out, successEnvelope{OK: true, Command: command.CommandPath(), Result: result})
				}
				fmt.Fprintf(deps.Out, "Mirror %s -> %s\nAsset: %s\nURL: %s\nChecksums: %s\n", info.Version, release.Version, asset.Name, asset.BrowserDownloadURL, manifest.BrowserDownloadURL)
				return nil
			}
			checksum, err := updater.FetchChecksum(command.Context(), deps.HTTPClient, manifest.BrowserDownloadURL, asset.Name)
			if err != nil {
				return withExitCode(4, err)
			}
			var progress func(updater.DownloadProgress)
			if outputFormat(command) == "text" {
				progress = func(event updater.DownloadProgress) {
					if event.Total > 0 {
						fmt.Fprintf(deps.Out, "Download progress: %.1f%% (%d/%d bytes)\n", event.Percent, event.Bytes, event.Total)
					} else {
						fmt.Fprintf(deps.Out, "Download progress: %d bytes\n", event.Bytes)
					}
				}
			}
			result, err := updater.Upgrade(updater.UpgradeOptions{
				TargetVersion: release.Version, DownloadURL: asset.BrowserDownloadURL,
				ExpectedChecksum: checksum, HTTPClient: deps.HTTPClient, Progress: progress,
			})
			if err != nil {
				return withExitCode(5, err)
			}
			if !result.Scheduled {
				cwd, cwdErr := effectiveCWD(command, deps)
				if cwdErr != nil {
					return cwdErr
				}
				if reconcileErr := deps.ReconcileBinary(result.ExecutablePath, cwd); reconcileErr != nil {
					_, rollbackErr := updater.PerformRollback(result.ExecutablePath)
					if rollbackErr != nil {
						return withExitCode(5, fmt.Errorf("reconcile upgraded agent resources: %w; binary rollback failed: %v", reconcileErr, rollbackErr))
					}
					return withExitCode(5, fmt.Errorf("reconcile upgraded agent resources: %w; binary rolled back", reconcileErr))
				}
			}
			if outputFormat(command) == "json" {
				return writeJSON(deps.Out, successEnvelope{OK: true, Command: command.CommandPath(), Result: result})
			}
			if result.Scheduled {
				fmt.Fprintf(deps.Out, "Mirror %s upgrade scheduled; completion will be reported on the next run.\nRecovery: %s\n", release.Version, result.Recovery)
			} else {
				fmt.Fprintf(deps.Out, "Mirror upgraded to %s. Backup: %s\n", release.Version, result.BackupPath)
			}
			return nil
		},
	}
	command.Flags().StringVar(&requested, "version", "", "Select an exact semantic version.")
	command.Flags().BoolVar(&dryRun, "dry-run", false, "Preview without replacing the executable.")
	command.AddCommand(newUpgradeCheckCommand(deps, info))
	command.AddCommand(newUpgradeListCommand(deps))
	command.AddCommand(newUpgradeRollbackCommand())
	command.AddCommand(newUpdateWorkerCommand())
	command.AddCommand(newWindowsReplacementCommand())
	command.AddCommand(newWindowsRollbackCommand())
	return command
}

func newUpgradeCheckCommand(deps Dependencies, info BuildInfo) *cobra.Command {
	return &cobra.Command{
		Use:   "check",
		Short: "Check whether a newer stable release exists.",
		Args:  cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			release, err := update.FetchLatestRelease(command.Context(), update.CatalogOptions{HTTPClient: deps.HTTPClient})
			if err != nil {
				return withExitCode(4, err)
			}
			available := update.CompareVersions(release.Version, info.Version) > 0
			if outputFormat(command) == "json" {
				return json.NewEncoder(deps.Out).Encode(map[string]any{
					"command": command.CommandPath(), "currentVersion": info.Version,
					"latestVersion": release.Version, "updateAvailable": available,
				})
			}
			fmt.Fprintf(deps.Out, "Current: %s\nLatest: %s\nUpdate available: %t\n", info.Version, release.Version, available)
			return nil
		},
	}
}

func newUpgradeListCommand(deps Dependencies) *cobra.Command {
	var page int
	var perPage int
	var includePrereleases bool
	command := &cobra.Command{
		Use:   "list",
		Short: "List available canonical Mirror releases.",
		Args:  cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			if page < 1 || perPage < 1 || perPage > 100 {
				return withExitCode(2, fmt.Errorf("--page must be positive and --per-page must be between 1 and 100"))
			}
			releases, err := update.FetchReleases(command.Context(), update.CatalogOptions{HTTPClient: deps.HTTPClient})
			if err != nil {
				return withExitCode(4, err)
			}
			filtered := make([]update.Release, 0, len(releases))
			for _, release := range releases {
				if includePrereleases || !release.Prerelease {
					filtered = append(filtered, release)
				}
			}
			start := (page - 1) * perPage
			end := start + perPage
			if start > len(filtered) {
				start = len(filtered)
			}
			if end > len(filtered) {
				end = len(filtered)
			}
			if outputFormat(command) == "json" {
				return json.NewEncoder(deps.Out).Encode(map[string]any{
					"command": command.CommandPath(), "page": page, "perPage": perPage,
					"total": len(filtered), "releases": filtered[start:end],
				})
			}
			for _, release := range filtered[start:end] {
				fmt.Fprintf(deps.Out, "%s\t%s\n", release.Version, release.TagName)
			}
			return nil
		},
	}
	command.Flags().IntVar(&page, "page", 1, "Select a positive result page.")
	command.Flags().IntVar(&perPage, "per-page", 8, "Select 1 to 100 results per page.")
	command.Flags().BoolVar(&includePrereleases, "pre-releases", false, "Include prerelease versions.")
	return command
}

func newUpgradeRollbackCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "rollback",
		Short: "Restore the previous Mirror executable.",
		Args:  cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			scheduled, err := updater.PerformRollback("")
			if err != nil {
				return withExitCode(5, err)
			}
			if scheduled {
				fmt.Fprintln(command.OutOrStdout(), "Mirror rollback scheduled; completion will be reported on the next run.")
			} else {
				fmt.Fprintln(command.OutOrStdout(), "Restored the previous Mirror executable.")
			}
			return nil
		},
	}
}

func newWindowsRollbackCommand() *cobra.Command {
	var pid int
	var executable string
	var backup string
	var helper string
	command := &cobra.Command{
		Use:    "__rollback-windows",
		Hidden: true,
		Args:   cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			return updater.CompleteWindowsRollback(executable, backup, helper, pid)
		},
	}
	command.Flags().IntVar(&pid, "pid", 0, "Internal parent process ID.")
	command.Flags().StringVar(&executable, "executable", "", "Internal executable path.")
	command.Flags().StringVar(&backup, "backup", "", "Internal backup path.")
	command.Flags().StringVar(&helper, "helper", "", "Internal helper path.")
	return command
}

func newUpdateWorkerCommand() *cobra.Command {
	var current string
	var repo string
	var lease string
	var token string
	command := &cobra.Command{
		Use:    "__update-worker",
		Hidden: true,
		Args:   cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			return update.RunLeasedWorker(command.Context(), current, update.CatalogOptions{Repo: repo}, "", lease, token)
		},
	}
	command.Flags().StringVar(&current, "current-version", "", "Internal current version.")
	command.Flags().StringVar(&repo, "repo", update.DefaultRepo, "Internal repository.")
	command.Flags().StringVar(&lease, "lease", "", "Internal lease path.")
	command.Flags().StringVar(&token, "lease-token", "", "Internal lease token.")
	return command
}

func newWindowsReplacementCommand() *cobra.Command {
	var pid int
	var executable string
	var candidate string
	var backup string
	var targetVersion string
	var checksum string
	var helper string
	var lockPath string
	var lockToken string
	command := &cobra.Command{
		Use:    "__replace-windows",
		Hidden: true,
		Args:   cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			return updater.CompleteWindowsReplacement(executable, candidate, backup, targetVersion, checksum, helper, lockPath, lockToken, pid)
		},
	}
	command.Flags().IntVar(&pid, "pid", 0, "Internal parent process ID.")
	command.Flags().StringVar(&executable, "executable", "", "Internal executable path.")
	command.Flags().StringVar(&candidate, "candidate", "", "Internal candidate path.")
	command.Flags().StringVar(&backup, "backup", "", "Internal backup path.")
	command.Flags().StringVar(&targetVersion, "target-version", "", "Internal target version.")
	command.Flags().StringVar(&checksum, "checksum", "", "Internal checksum.")
	command.Flags().StringVar(&helper, "helper", "", "Internal helper path.")
	command.Flags().StringVar(&lockPath, "lock", "", "Internal transaction lock path.")
	command.Flags().StringVar(&lockToken, "lock-token", "", "Internal transaction lock token.")
	return command
}

func resolveUpgrade(ctx context.Context, deps Dependencies, requested, buildTarget string) (update.Release, update.ReleaseAsset, update.ReleaseAsset, error) {
	releases, err := update.FetchReleases(ctx, update.CatalogOptions{HTTPClient: deps.HTTPClient})
	if err != nil {
		return update.Release{}, update.ReleaseAsset{}, update.ReleaseAsset{}, err
	}
	targetAsset, err := updater.TargetAsset(buildTarget)
	if err != nil {
		return update.Release{}, update.ReleaseAsset{}, update.ReleaseAsset{}, err
	}
	requested = strings.TrimPrefix(requested, "v")
	for _, release := range releases {
		if requested != "" && release.Version != requested {
			continue
		}
		if requested == "" && release.Prerelease {
			continue
		}
		var binary update.ReleaseAsset
		var manifest update.ReleaseAsset
		for _, asset := range release.Assets {
			switch asset.Name {
			case targetAsset:
				binary = asset
			case "checksums.txt":
				manifest = asset
			}
		}
		if binary.Name == "" || manifest.Name == "" {
			if requested != "" {
				return release, binary, manifest, fmt.Errorf("release %s does not contain %s and checksums.txt", release.Version, targetAsset)
			}
			continue
		}
		return release, binary, manifest, nil
	}
	return update.Release{}, update.ReleaseAsset{}, update.ReleaseAsset{}, fmt.Errorf("no compatible canonical Mirror release found")
}

func reconcileInstalledResources(executable, cwd string) error {
	commands := [][]string{
		{"agent", "skill", "update"},
		{"agent", "instruction", "update", "--cwd", cwd},
	}
	for _, arguments := range commands {
		command := exec.Command(executable, arguments...)
		command.Env = append(os.Environ(), "MIRROR_DISABLE_UPDATE_CHECK=1")
		output, err := command.CombinedOutput()
		if err != nil {
			return fmt.Errorf("run %s: %w (%s)", strings.Join(arguments, " "), err, strings.TrimSpace(string(output)))
		}
	}
	return nil
}
