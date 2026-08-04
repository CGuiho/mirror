/**
 * @copyright Copyright © 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

package cmd

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/CGuiho/mirror/pkg/config"
	"github.com/spf13/cobra"
)

func newInitCommand(deps Dependencies) *cobra.Command {
	var source string
	var force bool
	var tagTemplate string
	var commit bool
	var push bool
	var yes bool
	var nonInteractive bool
	command := &cobra.Command{
		Use:   "init",
		Short: "Create or validate mirror.yaml configuration.",
		Long:  "Create a strict YAML Mirror configuration, or validate the existing file without replacing it.",
		Args:  cobra.NoArgs,
		RunE: func(command *cobra.Command, _ []string) error {
			cwd, err := effectiveCWD(command, deps)
			if err != nil {
				return err
			}
			explicit, err := command.Flags().GetString("config")
			if err != nil {
				return err
			}
			path := explicit
			if path == "" {
				path = filepath.Join(cwd, "mirror.yaml")
			} else if !filepath.IsAbs(path) {
				path = filepath.Join(cwd, path)
			}
			path, err = filepath.Abs(path)
			if err != nil {
				return fmt.Errorf("resolve configuration path: %w", err)
			}

			if _, statErr := os.Stat(path); statErr == nil && !force {
				if _, err := config.Load(path); err != nil {
					return fmt.Errorf("existing configuration is invalid: %w", err)
				}
				return renderInitResult(command, deps, path, "validated")
			} else if statErr != nil && !os.IsNotExist(statErr) {
				return fmt.Errorf("inspect configuration %s: %w", path, statErr)
			}

			if source == "" {
				source = "git"
			}
			resolvedTag := tagTemplate
			if resolvedTag == "" {
				resolvedTag = "v{version}"
			}
			resolvedCommit := commit
			resolvedPush := push
			if deps.IsTerminal() && !yes && !nonInteractive {
				prompter := newInitPrompter(deps)
				if !command.Flags().Changed("tag-template") {
					resolvedTag, err = prompter.selectTagTemplate()
					if err != nil {
						return err
					}
				}
				if !command.Flags().Changed("commit") {
					resolvedCommit, err = prompter.confirm("Create release commits?", true)
					if err != nil {
						return err
					}
				}
				if !command.Flags().Changed("push") {
					resolvedPush, err = prompter.confirm("Push release refs?", true)
					if err != nil {
						return err
					}
				}
			}
			rendered, err := renderInitialConfig(cwd, source, resolvedTag, resolvedCommit, resolvedPush)
			if err != nil {
				return err
			}
			if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
				return fmt.Errorf("create configuration directory: %w", err)
			}
			if err := writeAtomic(path, []byte(rendered), 0o644); err != nil {
				return err
			}
			if _, err := config.Load(path); err != nil {
				return fmt.Errorf("validate generated configuration: %w", err)
			}
			return renderInitResult(command, deps, path, "created")
		},
	}
	command.Flags().StringVar(&source, "source", "", "Select package.json, jsr.json, or git; default git.")
	command.Flags().BoolVar(&force, "force", false, "Replace an existing valid configuration.")
	command.Flags().StringVar(&tagTemplate, "tag-template", "", "Select v{version}, {name}@{version}, or {name}/v{version}; default v{version}.")
	command.Flags().BoolVar(&commit, "commit", true, "Create release commits (default true).")
	command.Flags().BoolVar(&push, "push", true, "Push release refs (default true).")
	command.Flags().BoolVar(&yes, "yes", false, "Accept all defaults without prompting.")
	command.Flags().BoolVar(&nonInteractive, "non-interactive", false, "Create configuration without prompting.")
	return command
}

func renderInitResult(command *cobra.Command, deps Dependencies, path, status string) error {
	if outputFormat(command) == "json" {
		return writeJSON(deps.Out, successEnvelope{
			OK: true, Command: command.CommandPath(),
			Result: map[string]any{"status": status, "path": path},
		})
	}
	fmt.Fprintf(deps.Out, "%s: %s\n", status, path)
	return nil
}

func renderInitialConfig(cwd, source, tagTemplate string, commit, push bool) (string, error) {
	if source != "package.json" && source != "jsr.json" && source != "git" {
		return "", fmt.Errorf("source must be package.json, jsr.json, or git")
	}
	name := filepath.Base(cwd)
	if strings.TrimSpace(name) == "" || name == "." {
		return "", fmt.Errorf("cannot derive project name from working directory %s", cwd)
	}

	projectLine := "  name: " + quoteYAML(name)
	output := `["git"]`
	if source != "git" {
		projectLine = "  name_source: " + quoteYAML(source)
		output = fmt.Sprintf("[%s, \"git\"]", quoteYAML(source))
	}
	if tagTemplate != "v{version}" && tagTemplate != "{name}@{version}" && tagTemplate != "{name}/v{version}" {
		return "", fmt.Errorf("tag template must be v{version}, {name}@{version}, or {name}/v{version}")
	}
	return strings.Join([]string{
		"# yaml-language-server: $schema=https://raw.githubusercontent.com/CGuiho/mirror/main/mirror/schema/mirror.schema.json",
		"schema: 1",
		"project:",
		projectLine,
		"version:",
		"  scheme: semver",
		"  source: " + quoteYAML(source),
		"  output: " + output,
		"  prerelease_id: \"\"",
		"package:",
		"  path: package.json",
		"  auxiliary_paths: []",
		"jsr:",
		"  path: jsr.json",
		"git:",
		"  tag_template: " + quoteYAML(tagTemplate),
		fmt.Sprintf("  commit: %t", commit),
		fmt.Sprintf("  push: %t", push),
		"  allow_dirty: false",
		"agents:",
		"  write_changelog: true",
		"  changelog_path: CHANGELOG.md",
		"",
	}, "\n"), nil
}

type initPrompter struct {
	reader *bufio.Reader
	out    interface{ Write([]byte) (int, error) }
}

func newInitPrompter(deps Dependencies) *initPrompter {
	return &initPrompter{reader: bufio.NewReader(deps.In), out: deps.Out}
}

func (p *initPrompter) selectTagTemplate() (string, error) {
	options := []string{"v{version}", "{name}@{version}", "{name}/v{version}"}
	fmt.Fprintln(p.out, "Git tag template:")
	for index, option := range options {
		marker := ""
		if index == 0 {
			marker = " (default)"
		}
		fmt.Fprintf(p.out, "  %d. %s%s\n", index+1, option, marker)
	}
	fmt.Fprint(p.out, "Choice [1]: ")
	answer, err := p.readLine()
	if err != nil {
		return "", err
	}
	switch strings.TrimSpace(answer) {
	case "", "1":
		return options[0], nil
	case "2":
		return options[1], nil
	case "3":
		return options[2], nil
	default:
		return "", fmt.Errorf("Git tag template choice must be 1, 2, or 3")
	}
}

func (p *initPrompter) confirm(question string, defaultValue bool) (bool, error) {
	indicator := " [Y/n]: "
	if !defaultValue {
		indicator = " [y/N]: "
	}
	fmt.Fprint(p.out, question+indicator)
	answer, err := p.readLine()
	if err != nil {
		return false, err
	}
	switch strings.ToLower(strings.TrimSpace(answer)) {
	case "":
		return defaultValue, nil
	case "y", "yes":
		return true, nil
	case "n", "no":
		return false, nil
	default:
		return false, fmt.Errorf("%s answer must be yes or no", question)
	}
}

func (p *initPrompter) readLine() (string, error) {
	line, err := p.reader.ReadString('\n')
	if err != nil && len(line) == 0 {
		if err.Error() == "EOF" {
			return "", nil
		}
		return "", err
	}
	return strings.TrimRight(line, "\r\n"), nil
}

func quoteYAML(value string) string {
	return fmt.Sprintf("%q", value)
}
