package cmd

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestExitCodeContract(t *testing.T) {
	assert.Equal(t, 0, ExitCode(nil))
	assert.Equal(t, 1, ExitCode(errors.New("operational failure")))
	assert.Equal(t, 2, ExitCode(errors.New("unknown command \"nope\" for \"mirror\"")))
	assert.Equal(t, 3, ExitCode(withExitCode(3, errors.New("configuration failure"))))
	assert.Equal(t, 4, ExitCode(withExitCode(4, errors.New("remote failure"))))
	assert.Equal(t, 5, ExitCode(withExitCode(5, errors.New("installation failure"))))
	assert.Equal(t, 130, ExitCode(context.Canceled))
}
