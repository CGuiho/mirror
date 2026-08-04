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

func newConfigCommand(deps Dependencies) *cobra.Command {
	command := &cobra.Command{
		Use:   "config",
		Short: "Validate and inspect configuration.",
		Long:  "Validate and inspect the effective strict YAML configuration.",
		Args:  cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			return command.Help()
		},
	}
	command.AddCommand(newConfigShowCommand(deps))
	command.AddCommand(newConfigCheckCommand(deps))
	command.AddCommand(newConfigSchemaCommand(deps))
	return command
}

func newConfigShowCommand(deps Dependencies) *cobra.Command {
	return &cobra.Command{
		Use:   "show",
		Short: "Show effective configuration.",
		Args:  cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			cfg, path, err := loadConfig(command, deps)
			if err != nil {
				return err
			}
			reportLoadedConfig(deps, path)
			if outputFormat(command) == "json" {
				return writeJSON(deps.Out, successEnvelope{
					OK: true, Command: command.CommandPath(),
					Result: map[string]any{"path": path, "config": cfg},
				})
			}
			fmt.Fprintf(deps.Out, "schema: %d\n", cfg.Schema)
			if cfg.Project.Name != "" {
				fmt.Fprintf(deps.Out, "project.name: %s\n", cfg.Project.Name)
			}
			if cfg.Project.NameSource != "" {
				fmt.Fprintf(deps.Out, "project.name_source: %s\n", cfg.Project.NameSource)
			}
			fmt.Fprintf(deps.Out, "version.source: %s\n", cfg.Version.Source)
			fmt.Fprintf(deps.Out, "version.output: %v\n", cfg.Version.Output)
			fmt.Fprintf(deps.Out, "git.tag_template: %s\n", cfg.Git.TagTemplate)
			fmt.Fprintf(deps.Out, "git.commit: %t\n", cfg.Git.Commit)
			fmt.Fprintf(deps.Out, "git.push: %t\n", cfg.Git.Push)
			fmt.Fprintf(deps.Out, "git.allow_dirty: %t\n", cfg.Git.AllowDirty)
			for _, event := range config.HookEvents() {
				definition, configured := cfg.Hooks[event]
				if !configured {
					continue
				}
				fmt.Fprintf(deps.Out, "hooks.%s.instructions: %d\n", event, len(definition.Instructions))
				fmt.Fprintf(deps.Out, "hooks.%s.commands: %d\n", event, len(definition.Commands))
			}
			return nil
		},
	}
}

func newConfigCheckCommand(deps Dependencies) *cobra.Command {
	return &cobra.Command{
		Use:   "check",
		Short: "Validate configuration against the Mirror contract.",
		Args:  cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			_, path, err := loadConfig(command, deps)
			if err != nil {
				return err
			}
			reportLoadedConfig(deps, path)
			if outputFormat(command) == "json" {
				return writeJSON(deps.Out, successEnvelope{
					OK: true, Command: command.CommandPath(),
					Result: map[string]any{"valid": true, "path": path},
				})
			}
			fmt.Fprintln(deps.Out, "ok")
			return nil
		},
	}
}

func newConfigSchemaCommand(deps Dependencies) *cobra.Command {
	var save bool
	command := &cobra.Command{
		Use:   "schema",
		Short: "Output or save the Mirror JSON Schema.",
		Args:  cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			schema := config.JSONSchema() + "\n"
			if !save {
				fmt.Fprint(deps.Out, schema)
				return nil
			}
			home, err := deps.HomeDir()
			if err != nil {
				return fmt.Errorf("resolve user home directory: %w", err)
			}
			path := filepath.Join(home, ".guiho", "mirror", "schema.json")
			if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
				return fmt.Errorf("create schema directory: %w", err)
			}
			if err := writeAtomic(path, []byte(schema), 0o644); err != nil {
				return err
			}
			if outputFormat(command) == "json" {
				return writeJSON(deps.Out, successEnvelope{
					OK: true, Command: command.CommandPath(),
					Result: map[string]any{"saved": true, "path": path},
				})
			}
			fmt.Fprintf(deps.Out, "saved: %s\n", path)
			return nil
		},
	}
	command.Flags().BoolVar(&save, "save", false, "Save schema to ~/.guiho/mirror/schema.json.")
	return command
}

func loadConfig(command *cobra.Command, deps Dependencies) (*config.MirrorConfig, string, error) {
	cwd, err := effectiveCWD(command, deps)
	if err != nil {
		return nil, "", err
	}
	explicit, err := command.Flags().GetString("config")
	if err != nil {
		return nil, "", err
	}
	home, err := deps.HomeDir()
	if err != nil {
		return nil, "", fmt.Errorf("resolve user home directory: %w", err)
	}
	cfg, path, err := config.LoadResolved(cwd, explicit, home)
	if err != nil {
		return nil, "", withExitCode(3, err)
	}
	absolutePath, err := filepath.Abs(path)
	if err != nil {
		return nil, "", fmt.Errorf("resolve configuration path: %w", err)
	}
	return cfg, absolutePath, nil
}

func reportLoadedConfig(deps Dependencies, path string) {
	fmt.Fprintf(deps.Err, "configuration file loaded: %s\n", path)
}

func writeJSON(writer interface{ Write([]byte) (int, error) }, value any) error {
	encoder := json.NewEncoder(writer)
	encoder.SetEscapeHTML(false)
	encoder.SetIndent("", "  ")
	return encoder.Encode(value)
}
