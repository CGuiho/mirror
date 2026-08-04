package versioning

import (
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/CGuiho/mirror/pkg/config"
	mirrorhooks "github.com/CGuiho/mirror/pkg/hooks"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildAndApplyGitOnlyPlanUsesExactTemplate(t *testing.T) {
	repository := initializeRepository(t)
	runGit(t, repository, "tag", "-a", "mirror/v1.2.3", "-m", "baseline")
	runGit(t, repository, "tag", "-a", "@guiho/mirror/v99.0.0", "-m", "unrelated")

	cfg := validConfig()
	plan, err := BuildPlan(cfg, filepath.Join(repository, "mirror.yaml"), "minor", repository)
	require.NoError(t, err)
	assert.Equal(t, "1.2.3", plan.CurrentVersion)
	assert.Equal(t, "1.3.0", plan.NextVersion)
	assert.Equal(t, "mirror/v1.3.0", plan.Tag)

	err = ApplyPlanWithOptions(plan, repository, ApplyOptions{Confirmed: false})
	require.ErrorContains(t, err, "without confirmation")
	require.NoError(t, ApplyPlanWithOptions(plan, repository, ApplyOptions{Confirmed: true}))
	assert.Equal(t, "mirror/v1.3.0", strings.TrimSpace(runGit(t, repository, "tag", "--list", "mirror/v1.3.0")))
}

func TestBuildPlanReadsReachableLegacyTagAndRendersConfiguredCanonicalTag(t *testing.T) {
	repository := initializeRepository(t)
	runGit(t, repository, "tag", "-a", "@guiho/mirror/v3.8.0", "-m", "legacy baseline")

	plan, err := BuildPlan(validConfig(), filepath.Join(repository, "mirror.yaml"), "major", repository)
	require.NoError(t, err)
	assert.Equal(t, "3.8.0", plan.CurrentVersion)
	assert.Equal(t, "4.0.0", plan.NextVersion)
	assert.Equal(t, "mirror/v4.0.0", plan.Tag)
}

func TestInitialGitVersionRequiresExactTargetAndAppliesCanonicalTag(t *testing.T) {
	repository := initializeRepository(t)
	cfg := validConfig()

	plan, err := BuildPlan(cfg, filepath.Join(repository, "mirror.yaml"), "0.0.1", repository)
	require.NoError(t, err)
	assert.True(t, plan.Initial)
	assert.Empty(t, plan.CurrentVersion)
	assert.Equal(t, "0.0.1", plan.NextVersion)
	assert.Equal(t, "mirror/v0.0.1", plan.Tag)
	require.NoError(t, ApplyPlanWithOptions(plan, repository, ApplyOptions{Confirmed: true}))
	assert.Equal(t, "mirror/v0.0.1", strings.TrimSpace(runGit(t, repository, "tag", "--list", "mirror/v0.0.1")))
}

func TestInitialGitVersionRejectsRelativeTarget(t *testing.T) {
	repository := initializeRepository(t)
	_, err := BuildPlan(validConfig(), filepath.Join(repository, "mirror.yaml"), "patch", repository)
	require.ErrorContains(t, err, "use an exact semantic version for the initial release")
}

func TestApplyRejectsDirtyWorktreeBeforeTagging(t *testing.T) {
	repository := initializeRepository(t)
	runGit(t, repository, "tag", "-a", "mirror/v1.0.0", "-m", "baseline")
	plan, err := BuildPlan(validConfig(), filepath.Join(repository, "mirror.yaml"), "patch", repository)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(repository, "dirty.txt"), []byte("dirty"), 0o644))

	err = ApplyPlanWithOptions(plan, repository, ApplyOptions{Confirmed: true})
	require.ErrorContains(t, err, "worktree is dirty")
	assert.Empty(t, strings.TrimSpace(runGit(t, repository, "tag", "--list", "mirror/v1.0.1")))
}

func TestPackageAdapterPreservesDocumentAndAppliesWithoutGit(t *testing.T) {
	root := t.TempDir()
	packagePath := filepath.Join(root, "package.json")
	require.NoError(t, os.WriteFile(packagePath, []byte("{\n  \"name\": \"example\",\n  \"version\": \"1.2.3\",\n  \"private\": true\n}\n"), 0o644))
	cfg := validConfig()
	cfg.Project = config.ProjectConfig{NameSource: "package.json"}
	cfg.Version.Source = "package.json"
	cfg.Version.Output = []string{"package.json"}
	cfg.Git.TagTemplate = "v{version}"

	plan, err := BuildPlan(cfg, filepath.Join(root, "mirror.yaml"), "patch", root)
	require.NoError(t, err)
	require.NoError(t, ApplyPlanWithOptions(plan, root, ApplyOptions{Confirmed: true}))
	content, err := os.ReadFile(packagePath)
	require.NoError(t, err)
	assert.Contains(t, string(content), `"version": "1.2.4"`)
	assert.Contains(t, string(content), `"private": true`)
}

func TestApplyRestoresFilesAndIndexWhenCommitFails(t *testing.T) {
	repository := initializeRepository(t)
	packagePath := filepath.Join(repository, "package.json")
	require.NoError(t, os.WriteFile(packagePath, []byte("{\"name\":\"example\",\"version\":\"1.2.3\"}\n"), 0o644))
	runGit(t, repository, "add", "package.json")
	runGit(t, repository, "commit", "-m", "package")

	cfg := validConfig()
	cfg.Project = config.ProjectConfig{NameSource: "package.json"}
	cfg.Version.Source = "package.json"
	cfg.Version.Output = []string{"package.json", "git"}
	cfg.Git.Commit = true
	plan, err := BuildPlan(cfg, filepath.Join(repository, "mirror.yaml"), "patch", repository)
	require.NoError(t, err)

	err = ApplyPlanWithOptions(plan, repository, ApplyOptions{Confirmed: true, Runner: failCommitRunner{}})
	require.ErrorContains(t, err, "create release commit")
	content, readErr := os.ReadFile(packagePath)
	require.NoError(t, readErr)
	assert.Contains(t, string(content), `"version":"1.2.3"`)
	assert.Empty(t, strings.TrimSpace(runGit(t, repository, "status", "--porcelain")))
	assert.Empty(t, strings.TrimSpace(runGit(t, repository, "tag", "--list", "mirror/v1.2.4")))
}

func TestApplyPushesOnlyPlannedTag(t *testing.T) {
	runner := &recordingRunner{}
	plan := &VersionPlan{
		Tag:         "mirror/v2.0.0",
		AllowDirty:  true,
		PushEnabled: true,
		Actions: []VersionPlanAction{
			{Type: "git-tag", Tag: "mirror/v2.0.0"},
			{Type: "git-push", IncludeTags: true},
		},
	}
	require.NoError(t, ApplyPlanWithOptions(plan, t.TempDir(), ApplyOptions{Confirmed: true, Runner: runner}))
	joined := strings.Join(runner.calls, "\n")
	assert.NotContains(t, joined, "push origin --tags")
	assert.Contains(t, joined, "push origin refs/tags/mirror/v2.0.0:refs/tags/mirror/v2.0.0")
}

func TestApplyRunsOneWriteBatchAndRollsBackWhenAfterWriteHookFails(t *testing.T) {
	root := t.TempDir()
	first := filepath.Join(root, "package.json")
	second := filepath.Join(root, "secondary.json")
	for _, path := range []string{first, second} {
		require.NoError(t, os.WriteFile(path, []byte("{\"name\":\"example\",\"version\":\"1.2.3\"}\n"), 0o644))
	}
	plan := &VersionPlan{
		CurrentVersion: "1.2.3", NextVersion: "1.2.4", Source: "package.json", Output: []string{"package.json"},
		Actions: []VersionPlanAction{
			{Type: "write-file", Adapter: "package.json", Path: first, CurrentVersion: "1.2.3", NextVersion: "1.2.4"},
			{Type: "write-file", Adapter: "package.json", Path: second, CurrentVersion: "1.2.3", NextVersion: "1.2.4"},
		},
	}
	hookRunner := &versionHookRunner{failures: map[string]int{"after": 6}}
	session, err := mirrorhooks.NewSession(mirrorhooks.Options{
		Config: config.HooksConfig{
			config.HookBeforeWrite:  {Commands: []string{"before"}},
			config.HookAfterWrite:   {Commands: []string{"after"}},
			config.HookOnWriteError: {Commands: []string{"error"}},
		},
		CWD: root, Runner: hookRunner, TempDir: t.TempDir(), JSON: true,
	})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, session.Cleanup()) })

	err = ApplyPlanWithOptions(plan, root, ApplyOptions{
		Confirmed: true, Context: context.Background(), Hooks: session,
	})
	require.ErrorContains(t, err, "exit code 6")
	assert.Equal(t, []string{"before:write", "after:write", "on:write-error"}, hookRunner.events)
	assert.Empty(t, plan.Completed)
	for _, path := range []string{first, second} {
		content, readErr := os.ReadFile(path)
		require.NoError(t, readErr)
		assert.Contains(t, string(content), `"version":"1.2.3"`)
	}
}

func TestApplyReportsPartialPushEffectsToErrorHook(t *testing.T) {
	root := t.TempDir()
	plan := &VersionPlan{
		Tag:         "mirror/v2.0.0",
		AllowDirty:  true,
		PushEnabled: true,
		Actions: []VersionPlanAction{
			{Type: "git-push", IncludeCommit: true, IncludeTags: true},
		},
	}
	hookRunner := &versionHookRunner{}
	session, err := mirrorhooks.NewSession(mirrorhooks.Options{
		Config: config.HooksConfig{
			config.HookOnPushError: {Commands: []string{"capture"}},
		},
		CWD: root, Runner: hookRunner, TempDir: t.TempDir(), JSON: true,
	})
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, session.Cleanup()) })

	err = ApplyPlanWithOptions(plan, root, ApplyOptions{
		Confirmed: true, Runner: &failTagPushRunner{}, Context: context.Background(), Hooks: session,
	})
	require.ErrorContains(t, err, "push exact Git tag")
	assert.Equal(t, []string{"push:commit"}, plan.Completed)
	require.Len(t, hookRunner.contexts, 1)
	assert.Equal(t, []string{"push:commit"}, hookRunner.contexts[0].Completed)
}

func validConfig() *config.MirrorConfig {
	return &config.MirrorConfig{
		Schema:  1,
		Project: config.ProjectConfig{Name: "mirror"},
		Version: config.VersionConfig{Scheme: "semver", Source: "git", Output: []string{"git"}},
		Package: config.PackageConfig{Path: "package.json", AuxiliaryPaths: []string{}},
		JSR:     config.JSRConfig{Path: "jsr.json"},
		Git:     config.GitConfig{TagTemplate: "{name}/v{version}"},
		Agents:  config.AgentsConfig{WriteChangelog: true, ChangelogPath: "CHANGELOG.md"},
		Hooks:   config.HooksConfig{},
	}
}

func initializeRepository(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	runGit(t, root, "init")
	runGit(t, root, "config", "user.email", "mirror-tests@example.invalid")
	runGit(t, root, "config", "user.name", "Mirror Tests")
	require.NoError(t, os.WriteFile(filepath.Join(root, "README.md"), []byte("fixture\n"), 0o644))
	runGit(t, root, "add", "README.md")
	runGit(t, root, "commit", "-m", "fixture")
	return root
}

func runGit(t *testing.T, cwd string, args ...string) string {
	t.Helper()
	command := exec.Command("git", args...)
	command.Dir = cwd
	output, err := command.CombinedOutput()
	require.NoError(t, err, "%s", output)
	return string(output)
}

type recordingRunner struct {
	calls []string
}

type versionHookRunner struct {
	events   []string
	failures map[string]int
	contexts []mirrorhooks.Context
}

func (runner *versionHookRunner) Run(_ context.Context, _ string, command string, environment []string) (mirrorhooks.CommandOutput, error) {
	var contextPath string
	for _, value := range environment {
		if strings.HasPrefix(value, "MIRROR_HOOK_EVENT=") {
			runner.events = append(runner.events, strings.TrimPrefix(value, "MIRROR_HOOK_EVENT="))
		}
		if strings.HasPrefix(value, "MIRROR_CONTEXT_PATH=") {
			contextPath = strings.TrimPrefix(value, "MIRROR_CONTEXT_PATH=")
		}
	}
	if contextPath != "" {
		data, err := os.ReadFile(contextPath)
		if err != nil {
			return mirrorhooks.CommandOutput{}, err
		}
		var document struct {
			Context mirrorhooks.Context `json:"context"`
		}
		if err := json.Unmarshal(data, &document); err != nil {
			return mirrorhooks.CommandOutput{}, err
		}
		runner.contexts = append(runner.contexts, document.Context)
	}
	return mirrorhooks.CommandOutput{ExitCode: runner.failures[command]}, nil
}

type failTagPushRunner struct {
	recordingRunner
}

func (runner *failTagPushRunner) Run(cwd, name string, args ...string) ([]byte, error) {
	output, _ := runner.recordingRunner.Run(cwd, name, args...)
	if name == "git" && len(args) > 2 && args[0] == "push" && strings.HasPrefix(args[2], "refs/tags/") {
		return output, assert.AnError
	}
	return output, nil
}

type failCommitRunner struct {
	ExecRunner
}

func (runner failCommitRunner) Run(cwd, name string, args ...string) ([]byte, error) {
	if name == "git" && len(args) > 0 && args[0] == "commit" {
		return nil, assert.AnError
	}
	return runner.ExecRunner.Run(cwd, name, args...)
}

func (runner *recordingRunner) Run(_ string, name string, args ...string) ([]byte, error) {
	runner.calls = append(runner.calls, name+" "+strings.Join(args, " "))
	return nil, nil
}
