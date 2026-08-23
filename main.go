/**
 * @copyright Copyright © 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

package main

import (
	"fmt"
	"os"

	"github.com/CGuiho/mirror/cmd"
	"github.com/CGuiho/mirror/pkg/launcher"
)

var (
	version     = "dev"
	commit      = ""
	buildDate   = ""
	buildTarget = "development"
)

func main() {
	handled, exitCode, launchErr := launcher.Dispatch(os.Args[1:], version, launcher.Streams{
		In: os.Stdin, Out: os.Stdout, Err: os.Stderr,
	})
	if handled {
		if launchErr != nil {
			fmt.Fprintln(os.Stderr, launchErr)
		}
		if exitCode != 0 {
			os.Exit(exitCode)
		}
		return
	}

	err := cmd.Execute(cmd.BuildInfo{
		Version: version, Commit: commit, BuildDate: buildDate, Target: buildTarget,
	})
	if err == nil {
		return
	}
	fmt.Fprintln(os.Stderr, err)
	cmd.WriteFinalRecovery(err, os.Stdout)
	os.Exit(cmd.ExitCode(err))
}
