package cmd

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestInitNonInteractiveDefaultsToSimpleTagCommitAndPush(t *testing.T) {
	root := t.TempDir()
	deps := testDependenciesAt(root, &bytes.Buffer{}, &bytes.Buffer{})
	require.NoError(t, ExecuteContext(context.Background(), deps, BuildInfo{Version: "dev"}, []string{"init", "--source", "git"}))
	content, err := os.ReadFile(filepath.Join(root, "mirror.yaml"))
	require.NoError(t, err)
	text := string(content)
	assert.Contains(t, text, `tag_template: "v{version}"`)
	assert.Contains(t, text, "commit: true")
	assert.Contains(t, text, "push: true")
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
		{name: "select alternatives", input: "2\nn\nno\n", tag: "{name}@{version}", commit: "false", push: "false"},
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
