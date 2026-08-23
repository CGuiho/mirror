package cmd

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"
)

type exitError struct {
	code int
	err  error
}

type upgradeRecoveryError struct {
	err     error
	command string
}

func (err *upgradeRecoveryError) Error() string { return err.err.Error() }
func (err *upgradeRecoveryError) Unwrap() error { return err.err }

func withUpgradeRecovery(err error, command string) error {
	if err == nil {
		return nil
	}
	return &upgradeRecoveryError{err: err, command: command}
}

// WriteFinalRecovery writes an upgrade recovery block after the ordinary error
// diagnostic so the directly executable installer command is the final output.
func WriteFinalRecovery(err error, out io.Writer) bool {
	var recovery *upgradeRecoveryError
	if !errors.As(err, &recovery) {
		return false
	}
	fmt.Fprintln(out, "If the upgrade fails, reinstall Mirror with this command:")
	fmt.Fprintln(out, recovery.command)
	return true
}

func (err *exitError) Error() string {
	return err.err.Error()
}

func (err *exitError) Unwrap() error {
	return err.err
}

func withExitCode(code int, err error) error {
	if err == nil {
		return nil
	}
	var existing *exitError
	if errors.As(err, &existing) {
		return err
	}
	return &exitError{code: code, err: err}
}

func ExitCode(err error) int {
	if err == nil {
		return 0
	}
	if errors.Is(err, context.Canceled) {
		return 130
	}
	var coded *exitError
	if errors.As(err, &coded) {
		return coded.code
	}
	message := err.Error()
	for _, prefix := range []string{
		"unknown command", "unknown flag", "flag needs an argument", "requires at least",
		"requires exactly", "accepts ", "requires a subcommand",
	} {
		if strings.Contains(message, prefix) {
			return 2
		}
	}
	return 1
}
