/**
 * @copyright Copyright © 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

package main

import (
	"fmt"
	"os"

	"github.com/CGuiho/mirror/cmd"
)

var (
	version     = "dev"
	commit      = ""
	buildDate   = ""
	buildTarget = "development"
)

func main() {
	err := cmd.Execute(cmd.BuildInfo{
		Version: version, Commit: commit, BuildDate: buildDate, Target: buildTarget,
	})
	if err == nil {
		return
	}
	fmt.Fprintln(os.Stderr, err)
	os.Exit(cmd.ExitCode(err))
}
