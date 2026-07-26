//go:build !windows

package cmd

import (
	"fmt"
	"os"
)

func removeExecutable(path string) (bool, error) {
	if err := os.Remove(path); err != nil {
		return false, fmt.Errorf("remove Mirror executable: %w", err)
	}
	return false, nil
}

func completeWindowsUninstall(_, _ string, _ int) error {
	return fmt.Errorf("Windows uninstall helper is unavailable on this platform")
}
