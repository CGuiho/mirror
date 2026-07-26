/**
 * @copyright Copyright © 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

package cmd

import (
	"fmt"
	"github.com/CGuiho/mirror/pkg/config"
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
	command := &cobra.Command{
		Use:   "apply <target>",
		Short: "Apply a version plan and its exact Git refs.",
		Args:  cobra.ExactArgs(1),
		RunE: func(command *cobra.Command, args []string) error {
			plan, err := buildPlan(command, deps, args[0])
			if err != nil {
				return err
			}
			if dryRun {
				plan.DryRun = true
				return renderVersionPlan(command, deps, plan)
			}
			cwd, err := effectiveCWD(command, deps)
			if err != nil {
				return err
			}
			if err := versioning.ApplyPlanWithOptions(plan, cwd, versioning.ApplyOptions{
				Confirmed: confirmed,
				Runner:    deps.Runner,
			}); err != nil {
				return err
			}
			return renderVersionPlan(command, deps, plan)
		},
	}
	command.Flags().BoolVar(&dryRun, "dry-run", false, "Build the plan without mutation.")
	command.Flags().BoolVar(&confirmed, "yes", false, "Apply without an interactive confirmation prompt.")
	return command
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
