//go:build windows

package updater

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"syscall"
	"time"
)

func performRollback(executable, backup string) (bool, error) {
	helperFile, err := os.CreateTemp(filepath.Dir(executable), ".mirror-rollback-helper-*.exe")
	if err != nil {
		return false, fmt.Errorf("create Windows rollback helper: %w", err)
	}
	helper := helperFile.Name()
	source, err := os.Open(executable)
	if err != nil {
		helperFile.Close()
		os.Remove(helper)
		return false, fmt.Errorf("open current executable for rollback helper: %w", err)
	}
	if _, err := io.Copy(helperFile, source); err != nil {
		source.Close()
		helperFile.Close()
		os.Remove(helper)
		return false, fmt.Errorf("copy Windows rollback helper: %w", err)
	}
	source.Close()
	if err := helperFile.Close(); err != nil {
		os.Remove(helper)
		return false, fmt.Errorf("close Windows rollback helper: %w", err)
	}
	command := exec.Command(helper, "upgrade", "__rollback-windows",
		"--pid", strconv.Itoa(os.Getpid()),
		"--executable", executable,
		"--backup", backup,
		"--helper", helper,
	)
	command.SysProcAttr = &syscall.SysProcAttr{CreationFlags: 0x08000000, HideWindow: true}
	command.Stdin, command.Stdout, command.Stderr = nil, nil, nil
	if err := command.Start(); err != nil {
		os.Remove(helper)
		return false, fmt.Errorf("start Windows rollback helper: %w", err)
	}
	if err := command.Process.Release(); err != nil {
		return false, fmt.Errorf("release Windows rollback helper: %w", err)
	}
	return true, nil
}

func CompleteWindowsRollback(executable, backup, helper string, parentPID int) (returnErr error) {
	completion := Completion{
		TargetVersion: "previous",
		Outcome:       "failed",
		Verification:  "not requested",
		Rollback:      "failed",
		Recovery:      fmt.Sprintf("restore %q to %q", backup, executable),
	}
	defer func() {
		if returnErr != nil {
			completion.Failure = returnErr.Error()
		}
		_ = WriteCompletion(completion)
		scheduleDelete(helper)
	}()
	if err := waitForProcessExit(uint32(parentPID), 120*time.Second); err != nil {
		return err
	}
	if err := performRollbackFiles(executable, backup); err != nil {
		return err
	}
	completion.Outcome = "succeeded"
	completion.Rollback = "succeeded"
	completion.Recovery = ""
	return nil
}
