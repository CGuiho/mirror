//go:build !windows

package updater

import (
	"errors"
)

func performRollback(executable, backup string) (bool, error) {
	return false, errors.New("no backup executable (.old) found for rollback — upgrade overwrites directly; reinstall via install script if needed")
}

func CompleteWindowsRollback(string, string, string, int) error {
	return errors.New("Windows rollback helper is unavailable on this platform")
}
