package cmd

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"os"
	"strings"

	embedFS "github.com/CGuiho/mirror/embed"
	"github.com/CGuiho/mirror/pkg/maintenance"
	"github.com/spf13/cobra"
)

const embeddedSkillID = "guiho-s-mirror"

func newAgentCommand(_ Dependencies) *cobra.Command {
	command := &cobra.Command{
		Use:   "agent",
		Short: "Manage Mirror agent integration.",
		Args:  cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			return command.Help()
		},
	}
	command.AddCommand(newAgentSkillCommand())
	command.AddCommand(newAgentInstructionCommand())
	command.AddCommand(newAgentPromptCommand())
	return command
}

func newAgentSkillCommand() *cobra.Command {
	command := &cobra.Command{
		Use:   "skill",
		Short: "Manage the bundled Mirror skill.",
		Args:  cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			return command.Help()
		},
	}
	command.AddCommand(newAgentSkillMutationCommand("install"))
	command.AddCommand(newAgentSkillUninstallCommand())
	command.AddCommand(newAgentSkillMutationCommand("update"))
	command.AddCommand(newAgentSkillListCommand())
	command.AddCommand(newAgentSkillShowCommand())
	return command
}

func newAgentSkillMutationCommand(action string) *cobra.Command {
	var local bool
	command := &cobra.Command{
		Use:   action,
		Short: strings.ToUpper(action[:1]) + action[1:] + " the bundled Mirror skill.",
		Args:  cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			cwd, format, err := agentMutationOptions(command)
			if err != nil {
				return err
			}
			results, err := maintenance.InstallAgentSkills(embedFS.FS, cwd, local)
			if err != nil {
				return withExitCode(5, err)
			}
			if format == "json" {
				return json.NewEncoder(command.OutOrStdout()).Encode(map[string]any{
					"command": command.CommandPath(), "skills": results,
				})
			}
			for _, result := range results {
				outcome := "unchanged"
				if result.Installed {
					outcome = "installed"
				} else if result.Updated {
					outcome = "updated"
				}
				fmt.Fprintf(command.OutOrStdout(), "%s: %s (%s)\n", result.Tool, result.Path, outcome)
			}
			return nil
		},
	}
	command.Flags().BoolVar(&local, "local", false, "Use project-local skill directories.")
	return command
}

func newAgentSkillUninstallCommand() *cobra.Command {
	var local bool
	command := &cobra.Command{
		Use:   "uninstall",
		Short: "Uninstall the bundled Mirror skill.",
		Args:  cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			cwd, format, err := agentMutationOptions(command)
			if err != nil {
				return err
			}
			removed, err := maintenance.UninstallAgentSkills(cwd, local)
			if err != nil {
				return withExitCode(5, err)
			}
			if format == "json" {
				return json.NewEncoder(command.OutOrStdout()).Encode(map[string]any{
					"command": command.CommandPath(), "removed": removed,
				})
			}
			for _, path := range removed {
				fmt.Fprintf(command.OutOrStdout(), "Removed skill: %s\n", path)
			}
			return nil
		},
	}
	command.Flags().BoolVar(&local, "local", false, "Use project-local skill directories.")
	return command
}

func newAgentSkillListCommand() *cobra.Command {
	var filter string
	var namesOnly bool
	command := &cobra.Command{
		Use:   "list",
		Short: "List bundled Mirror skills.",
		Args:  cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			names := []string{embeddedSkillID}
			if filter != "" && !strings.Contains(strings.ToLower(embeddedSkillID), strings.ToLower(filter)) {
				names = nil
			}
			if outputFormat(command) == "json" {
				return json.NewEncoder(command.OutOrStdout()).Encode(map[string]any{
					"command": command.CommandPath(), "skills": names,
				})
			}
			for _, name := range names {
				if namesOnly {
					fmt.Fprintln(command.OutOrStdout(), name)
				} else {
					fmt.Fprintf(command.OutOrStdout(), "%s\tBundled semantic-versioning workflow for Mirror.\n", name)
				}
			}
			return nil
		},
	}
	command.Flags().StringVar(&filter, "filter", "", "Filter skill identifiers.")
	command.Flags().BoolVar(&namesOnly, "names", false, "Print skill identifiers only.")
	return command
}

func newAgentSkillShowCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "show <id>",
		Short: "Print one raw bundled skill.",
		Args:  cobra.ExactArgs(1),
		RunE: func(command *cobra.Command, args []string) error {
			if args[0] != embeddedSkillID {
				return withExitCode(2, fmt.Errorf("skill %q not found", args[0]))
			}
			data, err := fs.ReadFile(embedFS.FS, "skills/guiho-s-mirror/SKILL.md")
			if err != nil {
				return fmt.Errorf("read embedded skill: %w", err)
			}
			_, err = command.OutOrStdout().Write(data)
			return err
		},
	}
}

func newAgentInstructionCommand() *cobra.Command {
	command := &cobra.Command{
		Use:   "instruction",
		Short: "Manage Mirror instruction blocks.",
		Args:  cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			return command.Help()
		},
	}
	command.AddCommand(newAgentInstructionMutationCommand("apply", false))
	command.AddCommand(newAgentInstructionMutationCommand("remove", true))
	command.AddCommand(newAgentInstructionMutationCommand("update", false))
	command.AddCommand(newAgentInstructionShowCommand())
	return command
}

func newAgentInstructionMutationCommand(action string, remove bool) *cobra.Command {
	return &cobra.Command{
		Use:   action,
		Short: strings.ToUpper(action[:1]) + action[1:] + " the managed Mirror instruction block.",
		Args:  cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			cwd, format, err := agentMutationOptions(command)
			if err != nil {
				return err
			}
			var results []maintenance.InstructionResult
			if remove {
				results, err = maintenance.RemoveInstructions(cwd)
			} else {
				results, err = maintenance.ApplyInstructions(embedFS.FS, cwd)
			}
			if err != nil {
				return withExitCode(5, err)
			}
			if format == "json" {
				return json.NewEncoder(command.OutOrStdout()).Encode(map[string]any{
					"command": command.CommandPath(), "instructions": results,
				})
			}
			for _, result := range results {
				fmt.Fprintf(command.OutOrStdout(), "%s: changed=%t\n", result.Path, result.Changed)
			}
			return nil
		},
	}
}

func newAgentInstructionShowCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "show",
		Short: "Print the managed instruction body.",
		Args:  cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			body, err := maintenance.EmbeddedInstructionBody(embedFS.FS)
			if err != nil {
				return fmt.Errorf("read instruction template: %w", err)
			}
			_, err = fmt.Fprintln(command.OutOrStdout(), body)
			return err
		},
	}
}

func newAgentPromptCommand() *cobra.Command {
	command := &cobra.Command{
		Use:   "prompt",
		Short: "Inspect bundled agent prompts.",
		Args:  cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			return command.Help()
		},
	}
	command.AddCommand(newAgentPromptListCommand())
	command.AddCommand(newAgentPromptShowCommand())
	return command
}

func newAgentPromptListCommand() *cobra.Command {
	var namesOnly bool
	command := &cobra.Command{
		Use:   "list",
		Short: "List bundled Mirror prompts.",
		Args:  cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			name := "guiho-i-mirror"
			if outputFormat(command) == "json" {
				return json.NewEncoder(command.OutOrStdout()).Encode(map[string]any{
					"command": command.CommandPath(), "prompts": []string{name},
				})
			}
			if namesOnly {
				fmt.Fprintln(command.OutOrStdout(), name)
			} else {
				fmt.Fprintf(command.OutOrStdout(), "%s\tMirror semantic-version planning and release instruction.\n", name)
			}
			return nil
		},
	}
	command.Flags().BoolVar(&namesOnly, "names", false, "Print prompt identifiers only.")
	return command
}

func newAgentPromptShowCommand() *cobra.Command {
	return &cobra.Command{
		Use:   "show <id>",
		Short: "Print one raw bundled prompt.",
		Args:  cobra.ExactArgs(1),
		RunE: func(command *cobra.Command, args []string) error {
			id := strings.TrimSuffix(args[0], ".md")
			if id != "guiho-i-mirror" {
				return withExitCode(2, fmt.Errorf("prompt %q not found", args[0]))
			}
			data, err := fs.ReadFile(embedFS.FS, "prompts/guiho-i-mirror.md")
			if err != nil {
				return fmt.Errorf("read embedded prompt: %w", err)
			}
			_, err = command.OutOrStdout().Write(data)
			return err
		},
	}
}

func agentMutationOptions(command *cobra.Command) (string, string, error) {
	cwd, err := command.Flags().GetString("cwd")
	if err != nil {
		return "", "", err
	}
	if cwd == "" {
		cwd, err = os.Getwd()
		if err != nil {
			return "", "", err
		}
	}
	format := outputFormat(command)
	if format != "text" && format != "json" {
		return "", "", withExitCode(2, fmt.Errorf("--format must be text or json"))
	}
	return cwd, format, nil
}
