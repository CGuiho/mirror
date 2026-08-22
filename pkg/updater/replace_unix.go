//go:build !windows

package updater

import (
	"errors"
	"fmt"
	"os"
)

func replaceExecutable(executable, candidate, _, targetVersion, _, _, _ string, verify VerifyFunc) (bool, error) {
	// Just overwrite the binary — treat as if it doesn't exist. No backup, no rollback.
	// This mirrors the installer behavior: download to temp, then move into place.
	if _, err := os.Stat(executable); err == nil {
		if err := os.Remove(executable); err != nil {
			return false, fmt.Errorf("remove current executable: %w", err)
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return false, fmt.Errorf("inspect current executable: %w", err)
	}
	if err := os.Rename(candidate, executable); err != nil {
		return false, fmt.Errorf("activate update: %w", err)
	}
	if err := verify(executable, targetVersion); err != nil {
		return false, err
	}
	return false, nil
}

func CompleteWindowsReplacement(_, _, _, _, _, _, _, _ string, _ int) error {
	return fmt.Errorf("Windows replacement helper is unavailable on this platform")
}
