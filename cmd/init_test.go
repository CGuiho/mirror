package cmd

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/CGuiho/mirror/pkg/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInitNonInteractiveDefaultsToGitSourceSimpleTagCommitAndPush(t *testing.T) {
	root := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(root, "package.json"), []byte(`{"name":"example","version":"1.2.3"}`), 0o644))
	deps := testDependenciesAt(root, &bytes.Buffer{}, &bytes.Buffer{})
	require.NoError(t, ExecuteContext(context.Background(), deps, BuildInfo{Version: "dev"}, []string{"init"}))
	content, err := os.ReadFile(filepath.Join(root, "mirror.yaml"))
	require.NoError(t, err)
	text := string(content)
	assert.Contains(t, text, `name: "`+filepath.Base(root)+`"`)
	assert.Contains(t, text, `source: "git"`)
	assert.Contains(t, text, `output: ["git"]`)
	assert.Contains(t, text, `tag_template: "v{version}"`)
	assert.Contains(t, text, "commit: true")
	assert.Contains(t, text, "push: true")
}

func TestInitExplicitPackageSourceRemainsAuthoritative(t *testing.T) {
	root := t.TempDir()
	deps := testDependenciesAt(root, &bytes.Buffer{}, &bytes.Buffer{})
	require.NoError(t, ExecuteContext(context.Background(), deps, BuildInfo{Version: "dev"}, []string{"init", "--source", "package.json"}))
	content, err := os.ReadFile(filepath.Join(root, "mirror.yaml"))
	require.NoError(t, err)
	text := string(content)
	assert.Contains(t, text, `name_source: "package.json"`)
	assert.Contains(t, text, `source: "package.json"`)
	assert.Contains(t, text, `output: ["package.json", "git"]`)
}

func TestInitInteractiveDefaultsAndExplicitSelections(t *testing.T) {
	for _, test := range []struct {
		name        string
		input       string
		tag         string
		commit      string
		push        string
		defaultMark bool
	}{
		{name: "accept defaults", input: "\n\n\n", tag: "v{version}", commit: "true", push: "true", defaultMark: true},
		{name: "select alternatives", input: "2\ncustom-name\nn\nno\n", tag: "{name}@{version}", commit: "false", push: "false"},
	} {
		t.Run(test.name, func(t *testing.T) {
			root := t.TempDir()
			stdout := &bytes.Buffer{}
			deps := testDependenciesAt(root, stdout, &bytes.Buffer{})
			deps.In = strings.NewReader(test.input)
			deps.IsTerminal = func() bool { return true }
			require.NoError(t, ExecuteContext(context.Background(), deps, BuildInfo{Version: "dev"}, []string{"init", "--source", "git"}))
			content, err := os.ReadFile(filepath.Join(root, "mirror.yaml"))
			require.NoError(t, err)
			assert.Contains(t, string(content), `tag_template: "`+test.tag+`"`)
			assert.Contains(t, string(content), "commit: "+test.commit)
			assert.Contains(t, string(content), "push: "+test.push)
			assert.Contains(t, stdout.String(), "1. v{version} (default)")
			assert.Contains(t, stdout.String(), "Create release commits? [Y/n]")
			assert.Contains(t, stdout.String(), "Push release refs? [Y/n]")
		})
	}
}

func TestInitExplicitFlagsRemainAuthoritativeInInteractiveMode(t *testing.T) {
	root := t.TempDir()
	stdout := &bytes.Buffer{}
	deps := testDependenciesAt(root, stdout, &bytes.Buffer{})
	deps.IsTerminal = func() bool { return true }
	require.NoError(t, ExecuteContext(context.Background(), deps, BuildInfo{Version: "dev"}, []string{
		"init", "--source", "git", "--tag-template", "{name}/v{version}", "--commit=false", "--push=false",
	}))
	content, err := os.ReadFile(filepath.Join(root, "mirror.yaml"))
	require.NoError(t, err)
	assert.Contains(t, string(content), `tag_template: "{name}/v{version}"`)
	assert.Contains(t, string(content), "commit: false")
	assert.Contains(t, string(content), "push: false")
	assert.NotContains(t, stdout.String(), "Git tag template:")
}

func TestInitInteractiveNameTemplatePromptsForProjectName(t *testing.T) {
	for _, test := range []struct {
		name      string
		input     string
		tag       string
		wantName  string
		wantShown string
	}{
		{name: "explicit name for at template", input: "2\nmy-package\nn\nno\n", tag: "{name}@{version}", wantName: "my-package", wantShown: "Project name"},
		{name: "explicit name for slash template", input: "3\nanother-package\nn\nno\n", tag: "{name}/v{version}", wantName: "another-package", wantShown: "Project name"},
	} {
		t.Run(test.name, func(t *testing.T) {
			root := t.TempDir()
			stdout := &bytes.Buffer{}
			deps := testDependenciesAt(root, stdout, &bytes.Buffer{})
			deps.In = strings.NewReader(test.input)
			deps.IsTerminal = func() bool { return true }
			require.NoError(t, ExecuteContext(context.Background(), deps, BuildInfo{Version: "dev"}, []string{"init", "--source", "git"}))
			content, err := os.ReadFile(filepath.Join(root, "mirror.yaml"))
			require.NoError(t, err)
			assert.Contains(t, string(content), `tag_template: "`+test.tag+`"`)
			assert.Contains(t, string(content), `name: "`+test.wantName+`"`)
			assert.Contains(t, stdout.String(), test.wantShown)
			cfg, err := config.Load(filepath.Join(root, "mirror.yaml"))
			require.NoError(t, err)
			assert.Equal(t, test.wantName, cfg.Project.Name)
			assert.Equal(t, test.tag, cfg.Git.TagTemplate)
		})
	}
}

func TestInitInteractiveNameTemplateDefaultsToGoModuleNameOnEmptyAnswer(t *testing.T) {
	root := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(root, "go.mod"), []byte("module example.com/acme/widget\n\ngo 1.24\n"), 0o644))
	stdout := &bytes.Buffer{}
	deps := testDependenciesAt(root, stdout, &bytes.Buffer{})
	deps.In = strings.NewReader("3\n\n\n\n")
	deps.IsTerminal = func() bool { return true }
	require.NoError(t, ExecuteContext(context.Background(), deps, BuildInfo{Version: "dev"}, []string{"init", "--source", "git"}))
	content, err := os.ReadFile(filepath.Join(root, "mirror.yaml"))
	require.NoError(t, err)
	assert.Contains(t, string(content), `name: "widget"`)
	assert.Contains(t, stdout.String(), "Project name [widget]:")
	cfg, err := config.Load(filepath.Join(root, "mirror.yaml"))
	require.NoError(t, err)
	assert.Equal(t, "widget", cfg.Project.Name)
}

func TestInitInteractiveSimpleTemplateDoesNotPromptForName(t *testing.T) {
	root := t.TempDir()
	stdout := &bytes.Buffer{}
	deps := testDependenciesAt(root, stdout, &bytes.Buffer{})
	deps.In = strings.NewReader("1\n\n\n")
	deps.IsTerminal = func() bool { return true }
	require.NoError(t, ExecuteContext(context.Background(), deps, BuildInfo{Version: "dev"}, []string{"init", "--source", "git"}))
	content, err := os.ReadFile(filepath.Join(root, "mirror.yaml"))
	require.NoError(t, err)
	assert.Contains(t, string(content), `tag_template: "v{version}"`)
	assert.NotContains(t, stdout.String(), "Project name")
}

func TestInitNonInteractiveNameTemplateDerivesNameWithoutPrompt(t *testing.T) {
	root := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(root, "go.mod"), []byte("module example.com/acme/widget\n\ngo 1.24\n"), 0o644))
	stdout := &bytes.Buffer{}
	deps := testDependenciesAt(root, stdout, &bytes.Buffer{})
	require.NoError(t, ExecuteContext(context.Background(), deps, BuildInfo{Version: "dev"}, []string{
		"init", "--source", "git", "--tag-template", "{name}/v{version}", "--commit=false", "--push=false",
	}))
	content, err := os.ReadFile(filepath.Join(root, "mirror.yaml"))
	require.NoError(t, err)
	assert.Contains(t, string(content), `tag_template: "{name}/v{version}"`)
	assert.Contains(t, string(content), `name: "widget"`)
	assert.NotContains(t, stdout.String(), "Project name")
	cfg, err := config.Load(filepath.Join(root, "mirror.yaml"))
	require.NoError(t, err)
	assert.Equal(t, "widget", cfg.Project.Name)
}

func TestDefaultProjectNameFallsBackToDirectory(t *testing.T) {
	root := t.TempDir()
	name, err := defaultProjectName(root)
	require.NoError(t, err)
	assert.Equal(t, filepath.Base(root), name)
}
