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

func TestAgentNamespaceUsesEmbeddedResourcesAndBothSkillTargets(t *testing.T) {
	root := t.TempDir()
	stdout := &bytes.Buffer{}
	deps := testDependenciesAt(root, stdout, &bytes.Buffer{})

	err := ExecuteContext(context.Background(), deps, BuildInfo{Version: "dev"}, []string{
		"agent", "skill", "install", "--local", "--cwd", root,
	})
	require.NoError(t, err)
	for _, tool := range []string{"agents", "claude"} {
		path := filepath.Join(root, "."+tool, "skills", "guiho-s-mirror", "SKILL.md")
		content, readErr := os.ReadFile(path)
		require.NoError(t, readErr)
		assert.Contains(t, string(content), "name: guiho-s-mirror")
	}

	stdout.Reset()
	err = ExecuteContext(context.Background(), deps, BuildInfo{Version: "dev"}, []string{
		"agent", "skill", "show", "guiho-s-mirror",
	})
	require.NoError(t, err)
	assert.True(t, strings.HasPrefix(stdout.String(), "---\nname: guiho-s-mirror"))

	stdout.Reset()
	err = ExecuteContext(context.Background(), deps, BuildInfo{Version: "dev"}, []string{
		"agent", "prompt", "show", "guiho-i-mirror",
	})
	require.NoError(t, err)
	assert.True(t, strings.HasPrefix(stdout.String(), "---\nname: guiho-i-mirror"))
	assert.Contains(t, stdout.String(), "name: guiho-i-mirror")

	stdout.Reset()
	err = ExecuteContext(context.Background(), deps, BuildInfo{Version: "dev"}, []string{
		"agent", "instruction", "show",
	})
	require.NoError(t, err)
	assert.True(t, strings.HasPrefix(stdout.String(), "## GUIHO Mirror Instruction Block\n"))
	assert.NotContains(t, stdout.String(), "---")
	assert.NotContains(t, stdout.String(), "name: guiho-i-mirror")
}

func TestAgentInstructionMutationIsIdempotentAcrossBothFiles(t *testing.T) {
	root := t.TempDir()
	for _, name := range []string{"AGENTS.md", "CLAUDE.md"} {
		require.NoError(t, os.WriteFile(filepath.Join(root, name), []byte("# User content\n"), 0o644))
	}
	deps := testDependenciesAt(root, &bytes.Buffer{}, &bytes.Buffer{})
	arguments := []string{"agent", "instruction", "update", "--cwd", root}
	require.NoError(t, ExecuteContext(context.Background(), deps, BuildInfo{Version: "dev"}, arguments))
	require.NoError(t, ExecuteContext(context.Background(), deps, BuildInfo{Version: "dev"}, arguments))

	for _, name := range []string{"AGENTS.md", "CLAUDE.md"} {
		content, err := os.ReadFile(filepath.Join(root, name))
		require.NoError(t, err)
		assert.Equal(t, 1, strings.Count(string(content), "<!-- BEGIN MIRROR"))
		assert.Equal(t, 1, strings.Count(string(content), "<!-- END MIRROR -->"))
		assert.Contains(t, string(content), "<!-- BEGIN MIRROR — DO NOT EDIT THIS SECTION -->\n## GUIHO Mirror Instruction Block")
		assert.NotContains(t, string(content), "name: guiho-i-mirror")
		assert.Contains(t, string(content), "# User content")
	}
}
