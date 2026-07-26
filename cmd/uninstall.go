package cmd

import (
	"encoding/json"
	"fmt"
	"path/filepath"

	"github.com/CGuiho/mirror/pkg/maintenance"
	"github.com/spf13/cobra"
)

func newUninstallCommand(deps Dependencies) *cobra.Command {
	var dryRun bool
	var keepResources bool
	command := &cobra.Command{
		Use:   "uninstall",
		Short: "Remove the installed Mirror binary and agent resources.",
		Args:  cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			cwd, err := effectiveCWD(command, deps)
			if err != nil {
				return err
			}
			executable, err := deps.Executable()
			if err != nil {
				return withExitCode(5, fmt.Errorf("determine Mirror executable: %w", err))
			}
			executable, err = filepath.Abs(executable)
			if err != nil {
				return withExitCode(5, fmt.Errorf("resolve Mirror executable path: %w", err))
			}
			removed := []string{}
			instructions := []maintenance.InstructionResult{}
			if !keepResources && !dryRun {
				removed, err = maintenance.UninstallAgentSkills("", false)
				if err != nil {
					return withExitCode(5, err)
				}
				instructions, err = maintenance.RemoveInstructions(cwd)
				if err != nil {
					return withExitCode(5, err)
				}
			}
			if dryRun {
				result := map[string]any{
					"command": command.CommandPath(), "dryRun": true,
					"executable": executable, "keepAgentResources": keepResources,
				}
				if outputFormat(command) == "json" {
					return json.NewEncoder(deps.Out).Encode(result)
				}
				fmt.Fprintf(deps.Out, "Would remove executable: %s\n", executable)
				if !keepResources {
					fmt.Fprintln(deps.Out, "Would remove global Mirror skills and project instruction blocks.")
				}
				return nil
			}
			scheduled, err := removeExecutable(executable)
			if err != nil {
				return withExitCode(5, err)
			}
			result := map[string]any{
				"command": command.CommandPath(), "outcome": "succeeded",
				"executable": executable, "scheduled": scheduled,
				"removedAgentResources": removed, "instructionResults": instructions,
			}
			if outputFormat(command) == "json" {
				return json.NewEncoder(deps.Out).Encode(result)
			}
			if scheduled {
				fmt.Fprintf(deps.Out, "Scheduled executable removal: %s\n", executable)
			} else {
				fmt.Fprintf(deps.Out, "Removed executable: %s\n", executable)
			}
			for _, path := range removed {
				fmt.Fprintf(deps.Out, "Removed skill: %s\n", path)
			}
			return nil
		},
	}
	command.Flags().BoolVar(&dryRun, "dry-run", false, "Print targets without deleting.")
	command.Flags().BoolVar(&keepResources, "keep-agent-resources", false, "Keep global Mirror agent skills.")
	command.AddCommand(newWindowsUninstallCommand())
	return command
}

func newWindowsUninstallCommand() *cobra.Command {
	var pid int
	var executable string
	var helper string
	command := &cobra.Command{
		Use:    "__remove-windows",
		Hidden: true,
		Args:   cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			return completeWindowsUninstall(executable, helper, pid)
		},
	}
	command.Flags().IntVar(&pid, "pid", 0, "Internal parent process ID.")
	command.Flags().StringVar(&executable, "executable", "", "Internal executable path.")
	command.Flags().StringVar(&helper, "helper", "", "Internal helper path.")
	return command
}
