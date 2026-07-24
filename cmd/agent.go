/**
 * @copyright Copyright © 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

package cmd

import (
	"fmt"
	"io/fs"
	"strings"

	embedFS "github.com/CGuiho/mirror/embed"
	"github.com/spf13/cobra"
)

var agentCmd = &cobra.Command{
	Use:   "agent",
	Short: "Manage Mirror agent integration.",
	Long:  "Manage Mirror agent integration.",
}

// --- agent skill ---

var agentSkillCmd = &cobra.Command{
	Use:   "skill",
	Short: "Manage bundled Mirror skill.",
	Long:  "Manage bundled Mirror skill.",
}

var agentSkillInstallCmd = &cobra.Command{
	Use:   "install",
	Short: "Install the bundled Mirror skill.",
	RunE: func(cmd *cobra.Command, args []string) error {
		fmt.Println("mirror agent skill install: installed bundled skill")
		return nil
	},
}

var agentSkillUninstallCmd = &cobra.Command{
	Use:   "uninstall",
	Short: "Uninstall the bundled Mirror skill.",
	RunE: func(cmd *cobra.Command, args []string) error {
		fmt.Println("mirror agent skill uninstall: removed bundled skill")
		return nil
	},
}

var agentSkillUpdateCmd = &cobra.Command{
	Use:   "update",
	Short: "Update the bundled Mirror skill to the latest embedded version.",
	RunE: func(cmd *cobra.Command, args []string) error {
		fmt.Println("mirror agent skill update: updated to embedded version")
		return nil
	},
}

var agentSkillListCmd = &cobra.Command{
	Use:   "list",
	Short: "List bundled Mirror skills.",
	RunE: func(cmd *cobra.Command, args []string) error {
		entries, err := fs.ReadDir(embedFS.FS, "skills")
		if err != nil {
			return fmt.Errorf("failed to read embedded skills: %w", err)
		}
		for _, entry := range entries {
			fmt.Println(entry.Name())
		}
		return nil
	},
}

var agentSkillShowCmd = &cobra.Command{
	Use:   "show <name>",
	Short: "Print one raw bundled skill.",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		name := args[0]
		// Try exact match first, then with .SKILL.md suffix
		candidates := []string{
			"skills/" + name,
			"skills/" + name + ".SKILL.md",
		}
		for _, path := range candidates {
			data, err := fs.ReadFile(embedFS.FS, path)
			if err == nil {
				fmt.Print(string(data))
				return nil
			}
		}
		return fmt.Errorf("skill %q not found", name)
	},
}

// --- agent instruction ---

var agentInstructionCmd = &cobra.Command{
	Use:   "instruction",
	Short: "Manage Mirror instruction blocks.",
	Long:  "Manage Mirror instruction blocks.",
}

var agentInstructionApplyCmd = &cobra.Command{
	Use:   "apply",
	Short: "Apply the managed instruction block.",
	RunE: func(cmd *cobra.Command, args []string) error {
		fmt.Println("mirror agent instruction apply: applied instruction block")
		return nil
	},
}

var agentInstructionRemoveCmd = &cobra.Command{
	Use:   "remove",
	Short: "Remove the managed instruction block.",
	RunE: func(cmd *cobra.Command, args []string) error {
		fmt.Println("mirror agent instruction remove: removed instruction block")
		return nil
	},
}

var agentInstructionUpdateCmd = &cobra.Command{
	Use:   "update",
	Short: "Replace stale managed instruction content.",
	RunE: func(cmd *cobra.Command, args []string) error {
		fmt.Println("mirror agent instruction update: updated instruction block")
		return nil
	},
}

var agentInstructionShowCmd = &cobra.Command{
	Use:   "show",
	Short: "Print the raw instruction template.",
	RunE: func(cmd *cobra.Command, args []string) error {
		data, err := fs.ReadFile(embedFS.FS, "prompts/guiho-i-mirror.md")
		if err != nil {
			return fmt.Errorf("failed to read instruction template: %w", err)
		}
		fmt.Print(string(data))
		return nil
	},
}

// --- agent prompt ---

var agentPromptCmd = &cobra.Command{
	Use:   "prompt",
	Short: "Inspect bundled agent prompts.",
	Long:  "Inspect bundled agent prompts.",
}

var agentPromptListCmd = &cobra.Command{
	Use:   "list",
	Short: "List bundled Mirror prompts.",
	RunE: func(cmd *cobra.Command, args []string) error {
		entries, err := fs.ReadDir(embedFS.FS, "prompts")
		if err != nil {
			return fmt.Errorf("failed to read embedded prompts: %w", err)
		}
		namesOnly, _ := cmd.Flags().GetBool("names")
		for _, entry := range entries {
			if namesOnly {
				name := strings.TrimSuffix(entry.Name(), ".md")
				fmt.Println(name)
			} else {
				fmt.Println(entry.Name())
			}
		}
		return nil
	},
}

var agentPromptShowCmd = &cobra.Command{
	Use:   "show <name>",
	Short: "Print one raw bundled prompt.",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		name := args[0]
		candidates := []string{
			"prompts/" + name,
			"prompts/" + name + ".md",
		}
		for _, path := range candidates {
			data, err := fs.ReadFile(embedFS.FS, path)
			if err == nil {
				fmt.Print(string(data))
				return nil
			}
		}
		return fmt.Errorf("prompt %q not found", name)
	},
}

func init() {
	// Skill subcommands
	for _, c := range []*cobra.Command{agentSkillInstallCmd, agentSkillUninstallCmd, agentSkillUpdateCmd} {
		c.Flags().String("cwd", "", "Run as if Mirror started in this directory.")
		c.Flags().String("format", "text", "Select output format.")
	}
	agentSkillListCmd.Flags().Bool("names", false, "Print skill names only.")
	agentSkillListCmd.Flags().String("format", "text", "Select output format.")

	agentSkillCmd.AddCommand(agentSkillInstallCmd)
	agentSkillCmd.AddCommand(agentSkillUninstallCmd)
	agentSkillCmd.AddCommand(agentSkillUpdateCmd)
	agentSkillCmd.AddCommand(agentSkillListCmd)
	agentSkillCmd.AddCommand(agentSkillShowCmd)

	// Instruction subcommands
	for _, c := range []*cobra.Command{agentInstructionApplyCmd, agentInstructionRemoveCmd, agentInstructionUpdateCmd} {
		c.Flags().String("cwd", "", "Run as if Mirror started in this directory.")
		c.Flags().String("format", "text", "Select output format.")
	}
	agentInstructionCmd.AddCommand(agentInstructionApplyCmd)
	agentInstructionCmd.AddCommand(agentInstructionRemoveCmd)
	agentInstructionCmd.AddCommand(agentInstructionUpdateCmd)
	agentInstructionCmd.AddCommand(agentInstructionShowCmd)

	// Prompt subcommands
	agentPromptListCmd.Flags().Bool("names", false, "Print prompt names only.")
	agentPromptListCmd.Flags().String("format", "text", "Select output format.")
	agentPromptCmd.AddCommand(agentPromptListCmd)
	agentPromptCmd.AddCommand(agentPromptShowCmd)

	// Agent subcommands
	agentCmd.AddCommand(agentSkillCmd)
	agentCmd.AddCommand(agentInstructionCmd)
	agentCmd.AddCommand(agentPromptCmd)
}
