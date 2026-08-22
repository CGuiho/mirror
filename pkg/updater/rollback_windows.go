//go:build windows

package updater

import (
	"errors"
)

func performRollback(executable, backup string) (bool, error) {
	return false, errors.New("no backup executable (.old) found for rollback — upgrade overwrites directly; reinstall via install script if needed")
}

func CompleteWindowsRollback(executable, backup, helper string, parentPID int) (returnErr error) {
	return errors.New("rollback is not available — upgrade overwrites directly without backup")
}
