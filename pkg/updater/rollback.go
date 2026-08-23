package updater

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

func VerifyExecutable(path, targetVersion string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, path, "--version")
	output, err := command.CombinedOutput()
	if err != nil {
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return fmt.Errorf("verify replacement executable: timed out after 10s")
		}
		return fmt.Errorf("verify replacement executable: %w (%s)", err, strings.TrimSpace(string(output)))
	}
	expected := strings.TrimPrefix(targetVersion, "v")
	observed := strings.TrimSpace(string(output))
	if observed != expected {
		return fmt.Errorf("verify replacement executable: expected %q, got %q", expected, observed)
	}
	return nil
}

func VerifySelfTest(path string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	command := exec.CommandContext(ctx, path, "__self-test")
	output, err := command.CombinedOutput()
	if err != nil {
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return fmt.Errorf("verify replacement self-test: timed out after 10s")
		}
		return fmt.Errorf("verify replacement self-test: %w (%s)", err, strings.TrimSpace(string(output)))
	}
	if observed := strings.TrimSpace(string(output)); observed != "" {
		return fmt.Errorf("verify replacement self-test: expected no output, got %q", observed)
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
	// No backup is retained — upgrade just overwrites. No rollback available.
	return false
}

func PerformRollback(execPath string) (bool, error) {
	return false, errors.New("no backup executable (.old) found for rollback — upgrade overwrites directly; reinstall via install script if needed")
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
