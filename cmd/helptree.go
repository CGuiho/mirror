/**
 * @copyright Copyright © 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

package cmd

import (
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
)

// RenderHelpTree prints the full recursive command tree starting from the given command.
func RenderHelpTree(cmd *cobra.Command, maxDepth int) {
	fmt.Println("COMMAND TREE")
	fmt.Println()
	renderTreeNode(cmd, "", true, 0, maxDepth)
}

func renderTreeNode(cmd *cobra.Command, prefix string, isRoot bool, depth int, maxDepth int) {
	if maxDepth > 0 && depth > maxDepth {
		return
	}

	if isRoot {
		fmt.Println(cmd.Name())
	}

	type treeEntry struct {
		label string
		cmd   *cobra.Command
	}

	var entries []treeEntry

	// Add subcommands
	for _, sub := range cmd.Commands() {
		if sub.Hidden {
			continue
		}
		desc := sub.Short
		label := formatTreeLabel(sub.Name(), desc)
		entries = append(entries, treeEntry{label: label, cmd: sub})
	}

	// Add local flags
	cmd.LocalFlags().VisitAll(func(f *pflag.Flag) {
		if f.Hidden || (f.Name == "help" && !isRoot) {
			return
		}
		flagStr := "--" + f.Name
		if f.Shorthand != "" {
			flagStr = "-" + f.Shorthand + ", " + flagStr
		}
		if f.DefValue != "false" && f.DefValue != "true" && f.Value.Type() != "bool" {
			flagStr += " <" + flagValueHint(f) + ">"
		}
		entries = append(entries, treeEntry{label: formatTreeLabel(flagStr, f.Usage)})
	})

	for i, entry := range entries {
		isLast := i == len(entries)-1
		connector := "├── "
		childPrefix := "│   "
		if isLast {
			connector = "└── "
			childPrefix = "    "
		}

		fmt.Printf("%s%s%s\n", prefix, connector, entry.label)

		if entry.cmd != nil {
			renderTreeNode(entry.cmd, prefix+childPrefix, false, depth+1, maxDepth)
		}
	}
}

func formatTreeLabel(name string, description string) string {
	if description == "" {
		return name
	}
	padded := name
	targetWidth := 50 - len(padded)
	if targetWidth < 2 {
		targetWidth = 2
	}
	return padded + strings.Repeat(" ", targetWidth) + description
}

func flagValueHint(f *pflag.Flag) string {
	switch f.Name {
	case "cwd", "config", "package-file", "jsr-file":
		return "path"
	case "format":
		return "text|json"
	case "help-tree-depth":
		return "positive-integer"
	case "source":
		return "adapter"
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
	case "page":
		return "positive-integer"
	case "per-page":
		return "positive-integer"
	default:
		return f.Value.Type()
	}
}

// RenderHelpDocs outputs Markdown-formatted documentation for the given command.
func RenderHelpDocs(cmd *cobra.Command) {
	fmt.Printf("# %s\n\n", cmd.CommandPath())
	if cmd.Long != "" {
		fmt.Println(cmd.Long)
	} else if cmd.Short != "" {
		fmt.Println(cmd.Short)
	}
	fmt.Println()

	if cmd.UseLine() != "" {
		fmt.Printf("## Usage\n\n```\n%s\n```\n\n", cmd.UseLine())
	}

	if cmd.HasAvailableSubCommands() {
		fmt.Println("## Commands")
		for _, sub := range cmd.Commands() {
			if !sub.Hidden {
				fmt.Printf("- **%s**: %s\n", sub.Name(), sub.Short)
			}
		}
		fmt.Println()
	}

	if cmd.HasAvailableLocalFlags() {
		fmt.Println("## Flags")
		cmd.LocalFlags().VisitAll(func(f *pflag.Flag) {
			if !f.Hidden {
				fmt.Printf("- `--%s`: %s\n", f.Name, f.Usage)
			}
		})
		fmt.Println()
	}

	os.Exit(0)
}
