//go:build !windows

package updater

import (
	"errors"
)

func performRollback(executable, backup string) (bool, error) {
	return false, performRollbackFiles(executable, backup)
}

func CompleteWindowsRollback(string, string, string, int) error {
	return errors.New("Windows rollback helper is unavailable on this platform")
}
