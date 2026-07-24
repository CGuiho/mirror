/**
 * @copyright Copyright © 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

package cmd

import (
	"fmt"
	"os"
	"runtime"
	"strings"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

// Version is set at build time via ldflags or read from git tags.
var Version = "dev"

var cfgFile string

var rootCmd = &cobra.Command{
	Use:   "mirror",
	Short: "Deterministic semantic versioning for GUIHO projects.",
	Long:  "Deterministic semantic versioning for GUIHO projects. (mirror v" + Version + ")",
	PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
		helpTree, _ := cmd.Flags().GetBool("help-tree")
		if helpTree {
			depth, _ := cmd.Flags().GetInt("help-tree-depth")
			RenderHelpTree(cmd, depth)
			os.Exit(0)
		}
		helpDocs, _ := cmd.Flags().GetBool("help-docs")
		if helpDocs {
			RenderHelpDocs(cmd)
			os.Exit(0)
		}
		return nil
	},
	Run: func(cmd *cobra.Command, args []string) {
		showVersion, _ := cmd.Flags().GetBool("version")
		if showVersion {
			fmt.Printf("mirror v%s\n", Version)
			return
		}
		platformName := "Unknown"
		switch runtime.GOOS {
		case "windows":
			platformName = "Windows"
		case "linux":
			platformName = "Linux"
		case "darwin":
			platformName = "macOS"
		}
		archName := runtime.GOARCH
		if archName == "amd64" {
			archName = "x64"
		}
		fmt.Println("╔════════════════════════════════════════════════════╗")
		fmt.Println("║  MIRROR                                            ║")
		fmt.Println("║  Semantic project versioning                       ║")
		fmt.Println("║  GUIHO                                             ║")
		fmt.Println("╚════════════════════════════════════════════════════╝")
		fmt.Println()
		fmt.Printf("  platform      %s %s\n", platformName, archName)
		fmt.Printf("  version       v%s\n", Version)
		fmt.Println()
		fmt.Println("  Run `mirror --help` to see available commands.")
		fmt.Println()
	},
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func init() {
	cobra.OnInitialize(initConfig)

	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "Use this mirror.yaml file.")
	rootCmd.PersistentFlags().String("cwd", "", "Run as if Mirror started in this directory.")
	rootCmd.PersistentFlags().String("format", "text", "Select text or JSON output.")
	rootCmd.PersistentFlags().Bool("color", false, "Enable ANSI color output.")
	rootCmd.PersistentFlags().Bool("verbose", false, "Show full error details.")
	rootCmd.PersistentFlags().Bool("help-tree", false, "Show command hierarchy.")
	rootCmd.PersistentFlags().Int("help-tree-depth", 0, "Limit help-tree recursion depth.")
	rootCmd.PersistentFlags().Bool("help-docs", false, "Emit Markdown documentation for this command.")

	rootCmd.Flags().BoolP("version", "v", false, "Show the Mirror version.")

	_ = viper.BindPFlag("cwd", rootCmd.PersistentFlags().Lookup("cwd"))
	_ = viper.BindPFlag("config", rootCmd.PersistentFlags().Lookup("config"))
	_ = viper.BindPFlag("format", rootCmd.PersistentFlags().Lookup("format"))

	rootCmd.AddCommand(initCmd)
	rootCmd.AddCommand(configCmd)
	rootCmd.AddCommand(agentCmd)
	rootCmd.AddCommand(versionCmd)
	rootCmd.AddCommand(upgradeCmd)
	rootCmd.AddCommand(uninstallCmd)
}

func initConfig() {
	if cfgFile != "" {
		viper.SetConfigFile(cfgFile)
	} else {
		cwd, _ := rootCmd.PersistentFlags().GetString("cwd")
		if cwd == "" {
			cwd, _ = os.Getwd()
		}
		viper.AddConfigPath(cwd)
		viper.SetConfigName("mirror")
		viper.SetConfigType("yaml")
	}

	viper.SetEnvPrefix("MIRROR")
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_", "-", "_"))
	viper.AutomaticEnv()

	_ = viper.ReadInConfig()
}
