package updater

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

// CanRollback checks if a backup executable (.old) exists for the target executable path.
func CanRollback(execPath string) bool {
	if execPath == "" {
		var err error
		execPath, err = os.Executable()
		if err != nil {
			return false
		}
	}
	execPath, _ = filepath.EvalSymlinks(execPath)
	backupPath := execPath + ".old"
	info, err := os.Stat(backupPath)
	return err == nil && !info.IsDir()
}

// PerformRollback restores the backup executable (.old) back to the primary executable path.
func PerformRollback(execPath string) error {
	if execPath == "" {
		var err error
		execPath, err = os.Executable()
		if err != nil {
			return fmt.Errorf("failed to determine executable path: %w", err)
		}
	}
	execPath, err := filepath.EvalSymlinks(execPath)
	if err != nil {
		return fmt.Errorf("failed to resolve executable symlinks: %w", err)
	}

	backupPath := execPath + ".old"
	if !CanRollback(execPath) {
		return errors.New("no backup executable (.old) found for rollback")
	}

	failedPath := execPath + ".failed"
	_ = os.Remove(failedPath)

	// Move broken/current exec out of the way
	_ = os.Rename(execPath, failedPath)

	// Restore backup
	if err := os.Rename(backupPath, execPath); err != nil {
		// Attempt revert if failed move succeeded
		_ = os.Rename(failedPath, execPath)
		return fmt.Errorf("failed to restore backup executable: %w", err)
	}

	_ = os.Remove(failedPath)
	return nil
}
