package cmd

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/CGuiho/mirror/pkg/hooks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestVersionApplyRunsTrustedHooksInLifecycleOrderAndKeepsJSONValid(t *testing.T) {
	root := t.TempDir()
	writeHookConfig(t, root, `
  "before:everything": {commands: start}
  "before:plan": {commands: before-plan}
  "after:plan": {commands: after-plan}
  "before:apply": {commands: before-apply}
  "before:tag": {commands: before-tag}
  "after:tag": {commands: after-tag}
  "after:apply": {commands: after-apply}
  "after:everything": {commands: finish}
`)
	stdout, stderr := &bytes.Buffer{}, &bytes.Buffer{}
	deps := testDependenciesAt(root, stdout, stderr)
	gitRunner := &hookGitRunner{}
	hookRunner := &hookCommandRunner{}
	deps.Runner = gitRunner
	deps.HookRunner = hookRunner

	err := ExecuteContext(context.Background(), deps, BuildInfo{Version: "dev"}, []string{
		"version", "apply", "minor", "--yes", "--run-hooks", "--format", "json",
	})
	require.NoError(t, err)

	var document struct {
		OK     bool `json:"ok"`
		Result struct {
			Applied bool           `json:"applied"`
			Hooks   []hooks.Result `json:"hooks"`
		} `json:"result"`
	}
	require.NoError(t, json.Unmarshal(stdout.Bytes(), &document))
	assert.True(t, document.OK)
	assert.True(t, document.Result.Applied)
	assert.Len(t, document.Result.Hooks, 8)
	assert.Equal(t, []string{
		"before:everything", "before:plan", "after:plan", "before:apply",
		"before:tag", "after:tag", "after:apply", "after:everything",
	}, hookRunner.events)
	assert.Equal(t, "hook output\n", document.Result.Hooks[0].Stdout)
	assert.Contains(t, stderr.String(), "command hooks configured: 8")
	assert.Contains(t, strings.Join(gitRunner.calls, "\n"), "git tag -a mirror/v1.3.0")
	for _, path := range hookRunner.contextPaths {
		_, statErr := os.Stat(path)
		assert.ErrorIs(t, statErr, os.ErrNotExist)
	}
}

func TestVersionApplyRequiresExplicitHookTrustNonInteractively(t *testing.T) {
	root := t.TempDir()
	writeHookConfig(t, root, `
  "before:apply": {commands: verify}
`)
	stdout, stderr := &bytes.Buffer{}, &bytes.Buffer{}
	deps := testDependenciesAt(root, stdout, stderr)
	gitRunner := &hookGitRunner{}
	hookRunner := &hookCommandRunner{}
	deps.Runner = gitRunner
	deps.HookRunner = hookRunner

	err := ExecuteContext(context.Background(), deps, BuildInfo{Version: "dev"}, []string{
		"version", "apply", "minor", "--yes",
	})
	require.ErrorContains(t, err, "pass --run-hooks")
	assert.Empty(t, hookRunner.events)
	assert.Empty(t, gitRunner.calls)
}

func TestVersionApplyCanExplicitlySkipCommandHooks(t *testing.T) {
	root := t.TempDir()
	writeHookConfig(t, root, `
  "before:apply": {commands: verify}
`)
	stdout, stderr := &bytes.Buffer{}, &bytes.Buffer{}
	deps := testDependenciesAt(root, stdout, stderr)
	gitRunner := &hookGitRunner{}
	hookRunner := &hookCommandRunner{}
	deps.Runner = gitRunner
	deps.HookRunner = hookRunner

	err := ExecuteContext(context.Background(), deps, BuildInfo{Version: "dev"}, []string{
		"version", "apply", "minor", "--yes", "--skip-hooks",
	})
	require.NoError(t, err)
	assert.Empty(t, hookRunner.events)
	assert.Contains(t, stdout.String(), "applied: true")
	assert.Contains(t, strings.Join(gitRunner.calls, "\n"), "git tag -a mirror/v1.3.0")
}

func TestVersionApplyDryRunNeverRequestsOrExecutesCommandHooks(t *testing.T) {
	root := t.TempDir()
	writeHookConfig(t, root, `
  "before:everything": {commands: verify}
`)
	stdout, stderr := &bytes.Buffer{}, &bytes.Buffer{}
	deps := testDependenciesAt(root, stdout, stderr)
	gitRunner := &hookGitRunner{}
	hookRunner := &hookCommandRunner{}
	deps.Runner = gitRunner
	deps.HookRunner = hookRunner

	err := ExecuteContext(context.Background(), deps, BuildInfo{Version: "dev"}, []string{
		"version", "apply", "minor", "--dry-run", "--format", "json",
	})
	require.NoError(t, err)
	assert.Empty(t, hookRunner.events)
	assert.NotContains(t, stderr.String(), "command hooks configured")
	assert.NotContains(t, strings.Join(gitRunner.calls, "\n"), "git tag -a")
	assert.Contains(t, stdout.String(), `"dry_run": true`)
}

func TestVersionApplyCanTrustCommandHooksInteractively(t *testing.T) {
	root := t.TempDir()
	writeHookConfig(t, root, `
  "before:apply": {commands: verify}
`)
	stdout, stderr := &bytes.Buffer{}, &bytes.Buffer{}
	deps := testDependenciesAt(root, stdout, stderr)
	deps.In = strings.NewReader("yes\n")
	deps.IsTerminal = func() bool { return true }
	gitRunner := &hookGitRunner{}
	hookRunner := &hookCommandRunner{}
	deps.Runner = gitRunner
	deps.HookRunner = hookRunner

	err := ExecuteContext(context.Background(), deps, BuildInfo{Version: "dev"}, []string{
		"version", "apply", "minor", "--yes",
	})
	require.NoError(t, err)
	assert.Equal(t, []string{"before:apply"}, hookRunner.events)
	assert.Contains(t, stderr.String(), "Run configured command hooks? [y/N]")
}

func TestVersionApplyRoutesInternalHookFailureThroughNestedErrors(t *testing.T) {
	root := t.TempDir()
	writeHookConfig(t, root, `
  "before:everything": {commands: start}
  "before:plan": {commands: before-plan}
  "after:plan": {commands: after-plan}
  "before:apply": {commands: before-apply}
  "before:tag": {commands: fail}
  "on:tag-error": {commands: tag-error}
  "on:apply-error": {commands: apply-error}
  "on:error": {commands: global-error}
  "after:everything": {commands: finish}
`)
	stdout, stderr := &bytes.Buffer{}, &bytes.Buffer{}
	deps := testDependenciesAt(root, stdout, stderr)
	gitRunner := &hookGitRunner{}
	hookRunner := &hookCommandRunner{failures: map[string]int{"fail": 9}}
	deps.Runner = gitRunner
	deps.HookRunner = hookRunner

	err := ExecuteContext(context.Background(), deps, BuildInfo{Version: "dev"}, []string{
		"version", "apply", "minor", "--yes", "--run-hooks", "--format", "json",
	})
	require.ErrorContains(t, err, "exit code 9")
	assert.Equal(t, []string{
		"before:everything", "before:plan", "after:plan", "before:apply",
		"before:tag", "on:tag-error", "on:apply-error", "on:error", "after:everything",
	}, hookRunner.events)
	assert.NotContains(t, strings.Join(gitRunner.calls, "\n"), "git tag -a")

	var document struct {
		OK     bool `json:"ok"`
		Result struct {
			Stage string         `json:"stage"`
			Hooks []hooks.Result `json:"hooks"`
		} `json:"result"`
	}
	require.NoError(t, json.Unmarshal(stdout.Bytes(), &document))
	assert.False(t, document.OK)
	assert.Equal(t, "apply", document.Result.Stage)
	assert.Len(t, document.Result.Hooks, 9)
}

func writeHookConfig(t *testing.T, root, hookBody string) {
	t.Helper()
	content := `schema: 1
project: {name: mirror}
version: {source: git, output: [git]}
git: {tag_template: "{name}/v{version}"}
hooks:
` + hookBody
	require.NoError(t, os.WriteFile(filepath.Join(root, "mirror.yaml"), []byte(content), 0o644))
}

type hookGitRunner struct {
	calls []string
}

func (runner *hookGitRunner) Run(_ string, name string, args ...string) ([]byte, error) {
	runner.calls = append(runner.calls, name+" "+strings.Join(args, " "))
	if name == "git" && len(args) == 2 && args[0] == "tag" && args[1] == "--list" {
		return []byte("mirror/v1.2.3\n"), nil
	}
	return nil, nil
}

type hookCommandRunner struct {
	events       []string
	contextPaths []string
	failures     map[string]int
}

func (runner *hookCommandRunner) Run(_ context.Context, _ string, command string, environment []string) (hooks.CommandOutput, error) {
	event := hookEnvironmentValue(environment, "MIRROR_HOOK_EVENT")
	runner.events = append(runner.events, event)
	contextPath := hookEnvironmentValue(environment, "MIRROR_CONTEXT_PATH")
	runner.contextPaths = append(runner.contextPaths, contextPath)
	if contextPath == "" {
		return hooks.CommandOutput{}, errors.New("missing MIRROR_CONTEXT_PATH")
	}
	if _, err := os.Stat(contextPath); err != nil {
		return hooks.CommandOutput{}, err
	}
	if exitCode := runner.failures[command]; exitCode != 0 {
		return hooks.CommandOutput{ExitCode: exitCode, Stderr: "hook failed\n"}, nil
	}
	return hooks.CommandOutput{Stdout: "hook output\n"}, nil
}

func hookEnvironmentValue(environment []string, name string) string {
	prefix := name + "="
	for _, entry := range environment {
		if strings.HasPrefix(entry, prefix) {
			return strings.TrimPrefix(entry, prefix)
		}
	}
	return ""
}
