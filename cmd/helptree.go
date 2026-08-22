/**
 * @copyright Copyright © 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

package cmd

import (
	"fmt"
	"io"
	"sort"
	"strings"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
)

func RenderHelpTree(command *cobra.Command, maxDepth int, showGlobalFlags bool) {
	renderHelpTree(command.OutOrStdout(), command, maxDepth, showGlobalFlags)
}

func renderHelpTree(writer io.Writer, command *cobra.Command, maxDepth int, showGlobalFlags bool) {
	fmt.Fprintln(writer, "COMMAND TREE")
	fmt.Fprintln(writer)
	if !showGlobalFlags {
		global := globalFlags(command)
		if len(global) > 0 {
			fmt.Fprintln(writer, "Global Flags:")
			for _, flag := range global {
				name := "--" + flag.Name
				if flag.Shorthand != "" {
					name = "-" + flag.Shorthand + ", " + name
				}
				if flag.NoOptDefVal == "" {
					name += " <" + flagValueHint(flag) + ">"
				}
				fmt.Fprintln(writer, "  "+treeLabel(name, flag.Usage))
			}
			fmt.Fprintln(writer)
		}
	}
	fmt.Fprintln(writer, command.Name())
	renderTreeChildren(writer, command, "", 0, maxDepth, showGlobalFlags)
}

func renderTreeChildren(writer io.Writer, command *cobra.Command, prefix string, depth, maxDepth int, showGlobalFlags bool) {
	if maxDepth > 0 && depth >= maxDepth {
		return
	}
	type entry struct {
		label   string
		command *cobra.Command
	}
	entries := make([]entry, 0)
	children := append([]*cobra.Command(nil), command.Commands()...)
	sort.Slice(children, func(i, j int) bool { return children[i].Name() < children[j].Name() })
	for _, child := range children {
		if child.Hidden || !child.IsAvailableCommand() {
			continue
		}
		entries = append(entries, entry{label: treeLabel(child.Use, child.Short), command: child})
	}

	flags := visibleFlagsForTree(command, showGlobalFlags)
	for _, flag := range flags {
		name := "--" + flag.Name
		if flag.Shorthand != "" {
			name = "-" + flag.Shorthand + ", " + name
		}
		if flag.NoOptDefVal == "" {
			name += " <" + flagValueHint(flag) + ">"
		}
		entries = append(entries, entry{label: treeLabel(name, flag.Usage)})
	}

	for index, item := range entries {
		last := index == len(entries)-1
		connector, nextPrefix := "├── ", prefix+"│   "
		if last {
			connector, nextPrefix = "└── ", prefix+"    "
		}
		fmt.Fprintln(writer, prefix+connector+item.label)
		if item.command != nil {
			renderTreeChildren(writer, item.command, nextPrefix, depth+1, maxDepth, showGlobalFlags)
		}
	}
}

func RenderHelpDocs(command *cobra.Command) {
	renderHelpDocs(command.OutOrStdout(), command)
}

func renderHelpDocs(writer io.Writer, command *cobra.Command) {
	renderCommandMarkdown(writer, command, 1)
}

func renderCommandMarkdown(writer io.Writer, command *cobra.Command, level int) {
	heading := strings.Repeat("#", level)
	fmt.Fprintf(writer, "%s %s\n\n", heading, command.CommandPath())
	description := command.Long
	if description == "" {
		description = command.Short
	}
	if description != "" {
		fmt.Fprintln(writer, description)
		fmt.Fprintln(writer)
	}
	fmt.Fprintf(writer, "%s# Usage\n\n```text\n%s\n```\n\n", heading, command.UseLine())
	if command.Example != "" {
		fmt.Fprintf(writer, "%s# Examples\n\n```text\n%s\n```\n\n", heading, command.Example)
	}
	flags := visibleFlags(command)
	if len(flags) > 0 {
		fmt.Fprintf(writer, "%s# Flags\n\n", heading)
		for _, flag := range flags {
			name := "--" + flag.Name
			if flag.Shorthand != "" {
				name = "-" + flag.Shorthand + ", " + name
			}
			fmt.Fprintf(writer, "- `%s`: %s\n", name, flag.Usage)
		}
		fmt.Fprintln(writer)
	}
	fmt.Fprintf(writer, "%s# Developer Context\n\n", heading)
	fmt.Fprintf(writer, "- Command path: `%s`\n", command.CommandPath())
	fmt.Fprintf(writer, "- Accepts positionals: `%t`\n\n", strings.Contains(command.Use, " "))

	children := append([]*cobra.Command(nil), command.Commands()...)
	sort.Slice(children, func(i, j int) bool { return children[i].Name() < children[j].Name() })
	for _, child := range children {
		if child.Hidden || !child.IsAvailableCommand() {
			continue
		}
		renderCommandMarkdown(writer, child, level+1)
	}
}

func visibleFlags(command *cobra.Command) []*pflag.Flag {
	return visibleFlagsForTree(command, true)
}

func globalFlags(command *cobra.Command) []*pflag.Flag {
	root := command.Root()
	flags := make([]*pflag.Flag, 0)
	root.PersistentFlags().VisitAll(func(flag *pflag.Flag) {
		if !flag.Hidden {
			flags = append(flags, flag)
		}
	})
	sort.Slice(flags, func(i, j int) bool { return flags[i].Name < flags[j].Name })
	return flags
}

func visibleFlagsForTree(command *cobra.Command, showGlobalFlags bool) []*pflag.Flag {
	command.InitDefaultHelpFlag()
	flagsByName := map[string]*pflag.Flag{}
	command.NonInheritedFlags().VisitAll(func(flag *pflag.Flag) {
		if !flag.Hidden {
			flagsByName[flag.Name] = flag
		}
	})
	if showGlobalFlags {
		command.InheritedFlags().VisitAll(func(flag *pflag.Flag) {
			if !flag.Hidden {
				flagsByName[flag.Name] = flag
			}
		})
	}
	flags := make([]*pflag.Flag, 0, len(flagsByName))
	for _, flag := range flagsByName {
		flags = append(flags, flag)
	}
	sort.Slice(flags, func(i, j int) bool { return flags[i].Name < flags[j].Name })
	return flags
}

func treeLabel(name, description string) string {
	if description == "" {
		return name
	}
	padding := 48 - len(name)
	if padding < 2 {
		padding = 2
	}
	return name + strings.Repeat(" ", padding) + description
}

func flagValueHint(flag *pflag.Flag) string {
	switch flag.Name {
	case "cwd", "config", "package-file", "jsr-file":
		return "path"
	case "format":
		return "text|json"
	case "help-tree-depth":
		return "positive-integer"
	case "source":
		return "package.json|jsr.json|git"
	case "output":
		return "adapter"
	case "tag-template":
		return "template"
	case "name":
		return "name"
	case "preid":
		return "identifier"
	case "version":
		return "version"
	case "arch":
		return "x64|arm64"
	case "variant":
		return "baseline|default|modern"
	case "page", "per-page":
		return "positive-integer"
	default:
		return flag.Value.Type()
	}
}
