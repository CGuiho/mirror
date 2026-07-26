package cmd

import (
	"context"
	"errors"
	"strings"
)

type exitError struct {
	code int
	err  error
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
