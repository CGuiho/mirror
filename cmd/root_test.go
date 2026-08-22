package cmd

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/CGuiho/mirror/pkg/updater"
	"github.com/CGuiho/mirror/pkg/versioning"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFreshRootTreesHaveIndependentState(t *testing.T) {
	firstOut := &bytes.Buffer{}
	secondOut := &bytes.Buffer{}
	first := NewRootCommand(testDependencies(t, firstOut, &bytes.Buffer{}), BuildInfo{Version: "1.2.3"})
	second := NewRootCommand(testDependencies(t, secondOut, &bytes.Buffer{}), BuildInfo{Version: "9.8.7"})

	first.SetArgs([]string{"--version"})
	require.NoError(t, first.Execute())
	second.SetArgs(nil)
	require.NoError(t, second.Execute())
	assert.Equal(t, "mirror v1.2.3\n", firstOut.String())
	assert.Contains(t, secondOut.String(), "v9.8.7")
	assert.Contains(t, secondOut.String(), "GUIHO")
}

func TestStartupUsesOnlyCachedNoticeAndDetachedLauncher(t *testing.T) {
	stdout, stderr := &bytes.Buffer{}, &bytes.Buffer{}
	deps := testDependencies(t, stdout, stderr)
	launches := 0
	deps.ReadUpdateNotice = func(string, time.Time) string {
		return "A newer Mirror version is available.\n"
	}
	deps.LaunchUpdate = func(string, string) error {
		launches++
		return nil
	}
	err := ExecuteContext(context.Background(), deps, BuildInfo{Version: "1.0.0"}, nil)
	require.NoError(t, err)
	assert.Contains(t, stdout.String(), "v1.0.0")
	assert.Contains(t, stdout.String(), "GUIHO")
	// Hello window now renders the cached update notice inline instead of on
	// stderr to keep the update visible in the landing page.
	assert.Contains(t, stdout.String(), "New version available")
	assert.Equal(t, "", stderr.String())
	assert.Equal(t, 1, launches)
}

func TestPlainMirrorBootstrapsAgentResourcesIdempotently(t *testing.T) {
	for _, test := range []struct {
		name     string
		existing []string
		expected []string
	}{
		{name: "neither creates AGENTS", expected: []string{"AGENTS.md"}},
		{name: "AGENTS only", existing: []string{"AGENTS.md"}, expected: []string{"AGENTS.md"}},
		{name: "CLAUDE only", existing: []string{"CLAUDE.md"}, expected: []string{"CLAUDE.md"}},
		{name: "both", existing: []string{"AGENTS.md", "CLAUDE.md"}, expected: []string{"AGENTS.md", "CLAUDE.md"}},
	} {
		t.Run(test.name, func(t *testing.T) {
			root := t.TempDir()
			for _, name := range test.existing {
				require.NoError(t, os.WriteFile(filepath.Join(root, name), []byte("# User\r\n\r\nKeep this.\r\n"), 0o644))
			}
			stdout := &bytes.Buffer{}
			deps := testDependenciesAt(root, stdout, &bytes.Buffer{})
			deps.BootstrapAgents = nil
			require.NoError(t, ExecuteContext(context.Background(), deps, BuildInfo{Version: "1.2.3"}, nil))
			assert.Contains(t, stdout.String(), "v1.2.3")
			assert.Contains(t, stdout.String(), "GUIHO")

			modifications := map[string]time.Time{}
			for _, name := range test.expected {
				path := filepath.Join(root, name)
				content, err := os.ReadFile(path)
				require.NoError(t, err)
				normalized := strings.ReplaceAll(string(content), "\r\n", "\n")
				assert.Equal(t, 1, strings.Count(normalized, "<!-- BEGIN MIRROR"))
				assert.Contains(t, normalized, "<!-- BEGIN MIRROR — DO NOT EDIT THIS SECTION -->\n## GUIHO Mirror Instruction Block")
				managedStart := strings.Index(normalized, "<!-- BEGIN MIRROR")
				managedEnd := strings.Index(normalized, "<!-- END MIRROR -->")
				require.Greater(t, managedStart, -1)
				require.Greater(t, managedEnd, managedStart)
				managed := normalized[managedStart:managedEnd]
				assert.NotContains(t, managed, "\n---\n")
				assert.NotContains(t, managed, "name: guiho-i-mirror")
				if slices.Contains(test.existing, name) {
					assert.Contains(t, string(content), "Keep this.")
					assert.NotContains(t, strings.ReplaceAll(string(content), "\r\n", ""), "\n")
				}
				info, err := os.Stat(path)
				require.NoError(t, err)
				modifications[path] = info.ModTime()
			}
			for _, tool := range []string{"agents", "claude"} {
				skill := filepath.Join(root, "home", "."+tool, "skills", "guiho-s-mirror", "SKILL.md")
				_, err := os.Stat(skill)
				require.NoError(t, err)
			}

			stdout.Reset()
			require.NoError(t, ExecuteContext(context.Background(), deps, BuildInfo{Version: "1.2.3"}, nil))
			for path, before := range modifications {
				after, err := os.Stat(path)
				require.NoError(t, err)
				assert.Equal(t, before, after.ModTime(), "idempotent bootstrap rewrote %s", path)
			}
			if !slices.Contains(test.expected, "AGENTS.md") {
				_, err := os.Stat(filepath.Join(root, "AGENTS.md"))
				assert.ErrorIs(t, err, os.ErrNotExist)
			}
		})
	}
}

func TestConfigShowJSONKeepsDiagnosticOffStdout(t *testing.T) {
	root := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(root, "mirror.yaml"), []byte(`schema: 1
project: {name: mirror}
version: {source: git, output: [git]}
git: {tag_template: "{name}/v{version}"}
`), 0o644))
	stdout, stderr := &bytes.Buffer{}, &bytes.Buffer{}
	err := ExecuteContext(context.Background(), testDependenciesAt(root, stdout, stderr), BuildInfo{Version: "dev"}, []string{"config", "show", "--format", "json"})
	require.NoError(t, err)

	var document map[string]any
	require.NoError(t, json.Unmarshal(stdout.Bytes(), &document))
	assert.Equal(t, true, document["ok"])
	assert.NotContains(t, stdout.String(), "configuration file loaded")
	assert.Contains(t, stderr.String(), "configuration file loaded:")
}

func TestHelpTreeAndDocsComeFromLiveTree(t *testing.T) {
	stdout := &bytes.Buffer{}
	err := ExecuteContext(context.Background(), testDependencies(t, stdout, &bytes.Buffer{}), BuildInfo{Version: "dev"}, []string{"version", "--help-tree"})
	require.NoError(t, err)
	assert.Contains(t, stdout.String(), "COMMAND TREE")
	assert.Contains(t, stdout.String(), "apply <target>")
	assert.Contains(t, stdout.String(), "current")
	assert.Contains(t, stdout.String(), "├──")

	stdout.Reset()
	err = ExecuteContext(context.Background(), testDependencies(t, stdout, &bytes.Buffer{}), BuildInfo{Version: "dev"}, []string{"version", "--help-docs"})
	require.NoError(t, err)
	assert.Contains(t, stdout.String(), "# mirror version")
	assert.Contains(t, stdout.String(), "## mirror version apply")
	assert.Contains(t, stdout.String(), "Developer Context")
}

func TestVersionPlanJSONIsOneDocumentAndUsesInjectedRunner(t *testing.T) {
	root := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(root, "mirror.yaml"), []byte(`schema: 1
project: {name: mirror}
version: {source: git, output: [git]}
git: {tag_template: "{name}/v{version}"}
`), 0o644))
	stdout, stderr := &bytes.Buffer{}, &bytes.Buffer{}
	deps := testDependenciesAt(root, stdout, stderr)
	deps.Runner = planRunner{}
	err := ExecuteContext(context.Background(), deps, BuildInfo{Version: "dev"}, []string{"version", "plan", "minor", "--format", "json"})
	require.NoError(t, err)

	decoder := json.NewDecoder(bytes.NewReader(stdout.Bytes()))
	var document map[string]any
	require.NoError(t, decoder.Decode(&document))
	var extra any
	assert.Error(t, decoder.Decode(&extra))
	assert.Equal(t, true, document["ok"])
	result := document["result"].(map[string]any)
	assert.Equal(t, "mirror/v1.3.0", result["tag"])
	assert.NotContains(t, stdout.String(), "configuration file loaded")
	assert.Contains(t, stderr.String(), "configuration file loaded:")
}

func TestOnlyHelpAndRootVersionUseShortFlags(t *testing.T) {
	root := NewRootCommand(testDependencies(t, &bytes.Buffer{}, &bytes.Buffer{}), BuildInfo{Version: "dev"})
	var visit func(*cobra.Command)
	visit = func(command *cobra.Command) {
		command.LocalNonPersistentFlags().VisitAll(func(flag *pflag.Flag) {
			if flag.Shorthand == "" {
				return
			}
			assert.True(t, flag.Name == "help" || (command == root && flag.Name == "version"), "%s has forbidden shorthand -%s", command.CommandPath(), flag.Shorthand)
		})
		for _, child := range command.Commands() {
			visit(child)
		}
	}
	visit(root)
}

func testDependencies(t *testing.T, stdout, stderr *bytes.Buffer) Dependencies {
	t.Helper()
	return testDependenciesAt(t.TempDir(), stdout, stderr)
}

func testDependenciesAt(root string, stdout, stderr *bytes.Buffer) Dependencies {
	return Dependencies{
		In:  strings.NewReader(""),
		Out: stdout,
		Err: stderr,
		Getwd: func() (string, error) {
			return root, nil
		},
		HomeDir: func() (string, error) {
			return filepath.Join(root, "home"), nil
		},
		Runner: versioning.ExecRunner{},
		ReadUpdateNotice: func(string, time.Time) string {
			return ""
		},
		LaunchUpdate: func(string, string) error {
			return nil
		},
		ConsumeUpgrade: func() (*updater.Completion, error) {
			return nil, nil
		},
		ReconcileUpgrade: func(string) error {
			return nil
		},
		ReconcileBinary: func(string, string) error {
			return nil
		},
		BootstrapAgents: func(string) error {
			return nil
		},
		IsTerminal: func() bool { return false },
	}
}

type planRunner struct{}

func (planRunner) Run(_ string, name string, args ...string) ([]byte, error) {
	if name == "git" && len(args) >= 2 && args[0] == "tag" && args[1] == "--list" {
		return []byte("mirror/v1.2.3\n@guiho/mirror/v99.0.0\n"), nil
	}
	return nil, nil
}
