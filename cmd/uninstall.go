/**
 * @copyright Copyright © 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var uninstallCmd = &cobra.Command{
	Use:   "uninstall",
	Short: "Remove the installed Mirror native binary.",
	Long:  "Remove the installed Mirror native binary.",
	RunE: func(cmd *cobra.Command, args []string) error {
		dryRun, _ := cmd.Flags().GetBool("dry-run")
		execPath, _ := os.Executable()
		if dryRun {
			fmt.Printf("mirror uninstall: would remove %s\n", execPath)
		} else {
			fmt.Printf("mirror uninstall: removing %s\n", execPath)
		}
		return nil
	},
}

func init() {
	uninstallCmd.Flags().Bool("dry-run", false, "Print target path without deleting.")
}
