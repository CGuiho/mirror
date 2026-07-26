package updater

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

func VerifyExecutable(path, targetVersion string) error {
	command := exec.Command(path, "--version")
	output, err := command.CombinedOutput()
	if err != nil {
		return fmt.Errorf("verify replacement executable: %w (%s)", err, strings.TrimSpace(string(output)))
	}
	expected := strings.TrimPrefix(targetVersion, "v")
	observed := strings.TrimSpace(string(output))
	if observed != "mirror v"+expected {
		return fmt.Errorf("verify replacement executable: expected %q, got %q", "mirror v"+expected, observed)
	}
	return nil
}

func performRollbackFiles(executable, backup string) error {
	failed := fmt.Sprintf("%s.failed-%d", executable, time.Now().UnixNano())
	movedCurrent := false
	if _, err := os.Stat(executable); err == nil {
		if err := os.Rename(executable, failed); err != nil {
			return fmt.Errorf("stage current executable for rollback: %w", err)
		}
		movedCurrent = true
	} else if !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("inspect current executable: %w", err)
	}
	if err := os.Rename(backup, executable); err != nil {
		if movedCurrent {
			if restoreErr := os.Rename(failed, executable); restoreErr != nil {
				return fmt.Errorf("restore backup executable: %w; restore current executable also failed: %v", err, restoreErr)
			}
		}
		return fmt.Errorf("restore backup executable: %w", err)
	}
	if movedCurrent {
		_ = os.Remove(failed)
	}
	return nil
}

func CanRollback(execPath string) bool {
	path, err := executablePath(execPath)
	if err != nil {
		return false
	}
	info, err := os.Stat(path + ".old")
	return err == nil && !info.IsDir()
}

func PerformRollback(execPath string) (bool, error) {
	path, err := executablePath(execPath)
	if err != nil {
		return false, err
	}
	backup := path + ".old"
	if !CanRollback(path) {
		return false, errors.New("no backup executable (.old) found for rollback")
	}
	return performRollback(path, backup)
}

func executablePath(path string) (string, error) {
	if path == "" {
		var err error
		path, err = os.Executable()
		if err != nil {
			return "", fmt.Errorf("determine executable path: %w", err)
		}
	}
	absolute, err := filepath.Abs(path)
	if err != nil {
		return "", fmt.Errorf("resolve executable path: %w", err)
	}
	if resolved, resolveErr := filepath.EvalSymlinks(absolute); resolveErr == nil {
		absolute = resolved
	}
	return absolute, nil
}
