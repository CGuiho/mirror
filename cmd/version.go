/**
 * @copyright Copyright © 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

package cmd

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/CGuiho/mirror/pkg/config"
	"github.com/CGuiho/mirror/pkg/versioning"
	"github.com/spf13/cobra"
)

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Plan and apply semantic version changes.",
	Long:  "Plan and apply semantic version changes.",
}

var versionPlanCmd = &cobra.Command{
	Use:   "plan <target>",
	Short: "Build version plan without applying.",
	Long:  "Build version plan without applying.",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		target := args[0]
		cfgPath := resolveConfigPath(cmd)
		cfg, err := config.Load(cfgPath)
		if err != nil {
			return fmt.Errorf("failed to load configuration: %w", err)
		}
		fmt.Printf("configuration file loaded: %s\n", cfgPath)

		cwd, _ := cmd.Flags().GetString("cwd")
		if cwd == "" {
			cwd, _ = os.Getwd()
		}

		plan, err := versioning.BuildPlan(cfg, cfgPath, target, cwd)
		if err != nil {
			return err
		}

		format, _ := cmd.Flags().GetString("format")
		if format == "json" {
			data, _ := json.MarshalIndent(plan, "", "  ")
			fmt.Println(string(data))
		} else {
			fmt.Println()
			fmt.Println("🪞  GUIHO Mirror")
			fmt.Println()
			fmt.Printf("config: %s\n", cfgPath)
			fmt.Println()
			fmt.Print(versioning.FormatPlanText(plan))
		}
		return nil
	},
}

var versionApplyCmd = &cobra.Command{
	Use:   "apply <target>",
	Short: "Apply version plan and create Git tags.",
	Long:  "Apply version plan and create Git tags.",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		target := args[0]
		cfgPath := resolveConfigPath(cmd)
		cfg, err := config.Load(cfgPath)
		if err != nil {
			return fmt.Errorf("failed to load configuration: %w", err)
		}
		fmt.Printf("configuration file loaded: %s\n", cfgPath)

		cwd, _ := cmd.Flags().GetString("cwd")
		if cwd == "" {
			cwd, _ = os.Getwd()
		}

		plan, err := versioning.BuildPlan(cfg, cfgPath, target, cwd)
		if err != nil {
			return err
		}

		dryRun, _ := cmd.Flags().GetBool("dry-run")
		if dryRun {
			plan.DryRun = true
			fmt.Println()
			fmt.Println("🪞  GUIHO Mirror")
			fmt.Println()
			fmt.Printf("config: %s\n", cfgPath)
			fmt.Println()
			fmt.Print(versioning.FormatPlanText(plan))
			fmt.Println("dry_run: true")
			return nil
		}

		if err := versioning.ApplyPlan(plan, cwd); err != nil {
			return err
		}

		format, _ := cmd.Flags().GetString("format")
		if format == "json" {
			data, _ := json.MarshalIndent(plan, "", "  ")
			fmt.Println(string(data))
		} else {
			fmt.Printf("configuration file loaded: %s\n", cfgPath)
			fmt.Println()
			fmt.Println("🪞  GUIHO Mirror")
			fmt.Println()
			fmt.Printf("config: %s\n", cfgPath)
			fmt.Println()
			fmt.Print(versioning.FormatPlanText(plan))
		}
		return nil
	},
}

func init() {
	versionPlanCmd.Flags().Bool("dry-run", false, "Plan without mutation.")
	versionApplyCmd.Flags().Bool("dry-run", false, "Plan without mutation.")
	versionApplyCmd.Flags().Bool("yes", false, "Apply without confirmation.")

	// Version-specific flags from the full help-tree
	for _, cmd := range []*cobra.Command{versionCmd, versionPlanCmd, versionApplyCmd} {
		cmd.Flags().String("source", "", "Select package.json, jsr.json, or git as the source.")
		cmd.Flags().StringSlice("output", nil, "Select output adapters. Repeat or comma-separate values.")
		cmd.Flags().String("package-file", "", "Override the package.json path.")
		cmd.Flags().String("jsr-file", "", "Override the jsr.json path.")
		cmd.Flags().StringSlice("auxiliary", nil, "Add auxiliary package.json paths. Repeat or comma-separate values.")
		cmd.Flags().String("tag-template", "", "Override the Git tag template.")
		cmd.Flags().String("name", "", "Override the project name.")
		cmd.Flags().String("preid", "", "Override the prerelease identifier.")
		cmd.Flags().Bool("commit", false, "Create a release commit when file outputs changed.")
		cmd.Flags().Bool("push", false, "Push release refs.")
		cmd.Flags().Bool("allow-dirty", false, "Allow a dirty Git worktree.")
	}

	versionCmd.AddCommand(versionPlanCmd)
	versionCmd.AddCommand(versionApplyCmd)
}
