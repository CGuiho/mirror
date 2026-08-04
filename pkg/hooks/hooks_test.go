package hooks

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/CGuiho/mirror/pkg/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSessionRunsCommandsSequentiallyWithContextAndReporting(t *testing.T) {
	runner := &recordingRunner{outputs: map[string]CommandOutput{
		"first":  {Stdout: "first output\n"},
		"second": {Stderr: "second warning\n"},
	}}
	reporter := &bytes.Buffer{}
	session, err := NewSession(Options{
		Config: config.HooksConfig{
			config.HookBeforeApply: {Commands: []string{"first", "second"}},
		},
		CWD: t.TempDir(), ConfigPath: "C:/project/mirror.yaml", Target: "minor",
		Runner: runner, Environment: []string{"BASE=value"}, TempDir: t.TempDir(), Reporter: reporter,
	})
	require.NoError(t, err)
	contextPath := session.ContextPath()
	t.Cleanup(func() { require.NoError(t, session.Cleanup()) })

	hookContext := Context{
		Stage: "apply", Source: "git", Output: []string{"git"},
		CurrentVersion: "4.0.1", NextVersion: "4.1.0", ProjectName: "mirror",
		GitTag: "mirror/v4.1.0",
	}
	require.NoError(t, session.Run(context.Background(), config.HookBeforeApply, hookContext))

	assert.Equal(t, []string{"first", "second"}, runner.commands)
	require.Len(t, runner.environments, 2)
	assert.Equal(t, "before:apply", environmentValue(runner.environments[0], "MIRROR_HOOK_EVENT"))
	assert.Equal(t, "4.1.0", environmentValue(runner.environments[0], "MIRROR_NEXT"))
	assert.Equal(t, contextPath, environmentValue(runner.environments[0], "MIRROR_CONTEXT_PATH"))
	assert.Equal(t, "value", environmentValue(runner.environments[0], "BASE"))

	results := session.Results()
	require.Len(t, results, 2)
	assert.Equal(t, "success", results[0].Status)
	assert.Equal(t, "first output\n", results[0].Stdout)
	assert.Equal(t, "second warning\n", results[1].Stderr)
	assert.Contains(t, reporter.String(), "[mirror:hook:before:apply:1] success")
	assert.Contains(t, reporter.String(), "first output")

	data, err := os.ReadFile(contextPath)
	require.NoError(t, err)
	var document struct {
		Event   config.HookEvent `json:"event"`
		Results []Result         `json:"results"`
	}
	require.NoError(t, json.Unmarshal(data, &document))
	assert.Equal(t, config.HookBeforeApply, document.Event)
	assert.Len(t, document.Results, 2)
}

func TestSessionStopsNormalHooksAndMarksRemainingCommandsSkipped(t *testing.T) {
	runner := &recordingRunner{outputs: map[string]CommandOutput{
		"fail": {ExitCode: 7, Stderr: "failure"},
	}}
	session, err := NewSession(Options{
		Config: config.HooksConfig{
			config.HookBeforePlan: {Commands: []string{"fail", "never"}},
		},
		CWD: t.TempDir(), Runner: runner, TempDir: t.TempDir(), JSON: true,
	})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, session.Cleanup()) })

	err = session.Run(context.Background(), config.HookBeforePlan, Context{Stage: "plan"})
	require.Error(t, err)
	var hookError *CommandError
	require.ErrorAs(t, err, &hookError)
	assert.Equal(t, 7, hookError.ExitCode)
	assert.Equal(t, []string{"fail"}, runner.commands)
	results := session.Results()
	require.Len(t, results, 2)
	assert.Equal(t, "failure", results[0].Status)
	assert.Equal(t, "skipped", results[1].Status)
}

func TestSessionBestEffortRunsEveryErrorHookAndPreservesPrimary(t *testing.T) {
	runner := &recordingRunner{outputs: map[string]CommandOutput{
		"fail-one": {ExitCode: 2},
		"fail-two": {ExitCode: 3},
	}}
	session, err := NewSession(Options{
		Config: config.HooksConfig{
			config.HookOnError: {Commands: []string{"fail-one", "fail-two"}},
		},
		CWD: t.TempDir(), Runner: runner, TempDir: t.TempDir(), JSON: true,
	})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, session.Cleanup()) })

	secondary := session.RunBestEffort(context.Background(), config.HookOnError, Context{ErrorMessage: "primary"})
	assert.Len(t, secondary, 2)
	assert.Equal(t, []string{"fail-one", "fail-two"}, runner.commands)
	primary := errors.New("release failed")
	combined := WithSecondary(primary, secondary)
	assert.ErrorIs(t, combined, primary)
	assert.Contains(t, combined.Error(), "secondary hook failures")
}

func TestSessionCleanupRemovesPrivateContext(t *testing.T) {
	temporaryRoot := t.TempDir()
	session, err := NewSession(Options{
		Config: config.HooksConfig{
			config.HookBeforeApply: {Commands: []string{"noop"}},
		},
		CWD: t.TempDir(), Runner: &recordingRunner{}, TempDir: temporaryRoot,
	})
	require.NoError(t, err)
	path := session.ContextPath()
	info, err := os.Stat(path)
	require.NoError(t, err)
	if runtime.GOOS != "windows" {
		assert.Equal(t, os.FileMode(0o600), info.Mode().Perm())
	}
	require.NoError(t, session.Cleanup())
	_, err = os.Stat(path)
	assert.ErrorIs(t, err, os.ErrNotExist)
	require.NoError(t, session.Cleanup())
}

func TestExecRunnerCapturesStreamsAndExitCode(t *testing.T) {
	command := "printf out; printf err >&2; exit 7"
	if runtime.GOOS == "windows" {
		command = "echo out& echo err 1>&2& exit /b 7"
	}
	output, err := (ExecRunner{}).Run(context.Background(), t.TempDir(), command, os.Environ())
	require.NoError(t, err)
	assert.Contains(t, output.Stdout, "out")
	assert.Contains(t, output.Stderr, "err")
	assert.Equal(t, 7, output.ExitCode)
}

type recordingRunner struct {
	commands     []string
	environments [][]string
	outputs      map[string]CommandOutput
	errors       map[string]error
}

func (runner *recordingRunner) Run(_ context.Context, cwd, command string, environment []string) (CommandOutput, error) {
	runner.commands = append(runner.commands, command)
	runner.environments = append(runner.environments, append([]string(nil), environment...))
	if contextPath := environmentValue(environment, "MIRROR_CONTEXT_PATH"); contextPath != "" {
		data, err := os.ReadFile(filepath.Clean(contextPath))
		if err != nil {
			return CommandOutput{}, err
		}
		if !strings.Contains(string(data), `"kind": "command"`) {
			return CommandOutput{}, errors.New("hook context is incomplete")
		}
	}
	return runner.outputs[command], runner.errors[command]
}

func environmentValue(environment []string, name string) string {
	prefix := name + "="
	for _, entry := range environment {
		if strings.HasPrefix(entry, prefix) {
			return strings.TrimPrefix(entry, prefix)
		}
	}
	return ""
}
