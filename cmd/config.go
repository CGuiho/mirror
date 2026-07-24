/**
 * @copyright Copyright © 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/CGuiho/mirror/pkg/config"
	"github.com/spf13/cobra"
)

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Validate and inspect configuration.",
	Long:  "Validate and inspect configuration.",
}

var configShowCmd = &cobra.Command{
	Use:   "show",
	Short: "Show effective configuration.",
	Long:  "Show effective configuration.",
	RunE: func(cmd *cobra.Command, args []string) error {
		cfgPath := resolveConfigPath(cmd)
		cfg, err := config.Load(cfgPath)
		if err != nil {
			return fmt.Errorf("failed to load configuration: %w", err)
		}

		format, _ := cmd.Flags().GetString("format")
		if format == "json" {
			data, _ := json.MarshalIndent(cfg, "", "  ")
			fmt.Println(string(data))
		} else {
			fmt.Printf("configuration file loaded: %s\n", cfgPath)
			fmt.Printf("schema: %d\n", cfg.Schema)
			fmt.Printf("project.name: %s\n", cfg.Project.Name)
			fmt.Printf("version.source: %s\n", cfg.Version.Source)
			fmt.Printf("version.output: %v\n", cfg.Version.Output)
			fmt.Printf("git.tag_template: %s\n", cfg.Git.TagTemplate)
			fmt.Printf("git.commit: %v\n", cfg.Git.Commit)
			fmt.Printf("git.push: %v\n", cfg.Git.Push)
		}
		return nil
	},
}

var configCheckCmd = &cobra.Command{
	Use:   "check",
	Short: "Validate configuration against schema.",
	Long:  "Validate configuration against schema.",
	RunE: func(cmd *cobra.Command, args []string) error {
		cfgPath := resolveConfigPath(cmd)
		_, err := config.Load(cfgPath)
		if err != nil {
			return fmt.Errorf("configuration invalid: %w", err)
		}
		fmt.Printf("configuration file loaded: %s\n", cfgPath)
		fmt.Println("ok")
		return nil
	},
}

var configSchemaCmd = &cobra.Command{
	Use:   "schema",
	Short: "Output or save JSON schema.",
	Long:  "Output or save JSON schema.",
	RunE: func(cmd *cobra.Command, args []string) error {
		schema := config.JSONSchema()
		format, _ := cmd.Flags().GetString("format")
		if format == "json" {
			fmt.Println(schema)
		} else {
			fmt.Println(schema)
		}
		return nil
	},
}

func init() {
	configCmd.AddCommand(configShowCmd)
	configCmd.AddCommand(configCheckCmd)
	configCmd.AddCommand(configSchemaCmd)
}

func resolveConfigPath(cmd *cobra.Command) string {
	cfgFlag, _ := cmd.Flags().GetString("config")
	if cfgFlag != "" {
		return cfgFlag
	}
	cwd, _ := cmd.Flags().GetString("cwd")
	if cwd == "" {
		cwd, _ = os.Getwd()
	}
	return filepath.Join(cwd, "mirror.yaml")
}
