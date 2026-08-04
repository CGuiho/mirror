/**
 * @copyright Copyright © 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

package config

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadValidConfig(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "mirror.yaml")
	content := `schema: 1
project:
  name: "@guiho/test"
version:
  scheme: semver
  source: git
  output: ["git"]
git:
  tag_template: "{name}/v{version}"
  commit: true
  push: true
  allow_dirty: false
`
	require.NoError(t, os.WriteFile(cfgPath, []byte(content), 0644))

	cfg, err := Load(cfgPath)
	require.NoError(t, err)
	assert.Equal(t, 1, cfg.Schema)
	assert.Equal(t, "@guiho/test", cfg.Project.Name)
	assert.Equal(t, "semver", cfg.Version.Scheme)
	assert.Equal(t, "git", cfg.Version.Source)
	assert.Equal(t, []string{"git"}, cfg.Version.Output)
	assert.Equal(t, "{name}/v{version}", cfg.Git.TagTemplate)
	assert.True(t, cfg.Git.Commit)
	assert.True(t, cfg.Git.Push)
	assert.False(t, cfg.Git.AllowDirty)
}

func TestLoadRejectsUnknownFields(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "mirror.yaml")
	content := `schema: 1
unknown_field: true
project:
  name: test
version:
  scheme: semver
  source: git
  output: ["git"]
git:
  tag_template: "v{version}"
  commit: true
  push: false
`
	require.NoError(t, os.WriteFile(cfgPath, []byte(content), 0644))

	_, err := Load(cfgPath)
	assert.Error(t, err, "should reject unknown fields")
}

func TestLoadDefaultValues(t *testing.T) {
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "mirror.yaml")
	content := `schema: 1
project:
  name: test
version:
  source: git
  output: ["git"]
git:
  commit: true
  push: false
`
	require.NoError(t, os.WriteFile(cfgPath, []byte(content), 0644))

	cfg, err := Load(cfgPath)
	require.NoError(t, err)
	assert.Equal(t, 1, cfg.Schema)
	assert.Equal(t, "semver", cfg.Version.Scheme)
	assert.Equal(t, "v{version}", cfg.Git.TagTemplate)
}

func TestJSONSchema(t *testing.T) {
	schema := JSONSchema()
	assert.Contains(t, schema, "Mirror YAML Configuration")
	assert.Contains(t, schema, "schema")
	assert.Contains(t, schema, "project")
	assert.Contains(t, schema, "version")
	assert.Contains(t, schema, "git")
	assert.Contains(t, schema, `"before:apply"`)
	assert.Contains(t, schema, `"on_push_error"`)
	assert.Contains(t, schema, `"instructions"`)
	assert.Contains(t, schema, `"commands"`)
}

func TestLoadNormalizesCanonicalAndCompatibilityHooks(t *testing.T) {
	path := filepath.Join(t.TempDir(), "mirror.yaml")
	require.NoError(t, os.WriteFile(path, []byte(`schema: 1
project: {name: mirror}
version: {source: git, output: [git]}
git: {tag_template: "{name}/v{version}"}
hooks:
  "before:apply":
    instructions: Review the release plan.
    commands: ["go test ./...", "go vet ./..."]
  on_push_error: ./devops/report-failure.sh
`), 0o644))

	cfg, err := Load(path)
	require.NoError(t, err)
	assert.Equal(t, HookDefinition{
		Instructions: []string{"Review the release plan."},
		Commands:     []string{"go test ./...", "go vet ./..."},
	}, cfg.Hooks[HookBeforeApply])
	assert.Equal(t, []string{"./devops/report-failure.sh"}, cfg.Hooks[HookOnPushError].Commands)
	assert.True(t, cfg.Hooks.HasCommands())
	assert.Equal(t, 3, cfg.Hooks.CommandCount())
	assert.Equal(t, []HookEvent{HookBeforeApply, HookOnPushError}, cfg.Hooks.CommandEvents())
}

func TestLoadRejectsInvalidHookContracts(t *testing.T) {
	tests := map[string]string{
		"unknown event": `hooks:
  before_release: echo no
`,
		"duplicate alias": `hooks:
  before_apply: echo one
  "before:apply": echo two
`,
		"unknown field": `hooks:
  "before:apply": {command: echo no}
`,
		"empty definition": `hooks:
  "before:apply": {}
`,
		"empty list": `hooks:
  "before:apply": {commands: []}
`,
		"empty instruction list with commands": `hooks:
  "before:apply": {instructions: [], commands: echo no}
`,
		"non-string command": `hooks:
  "before:apply": {commands: [true]}
`,
		"internal instruction": `hooks:
  "before:commit": {instructions: Review the commit.}
`,
		"alias instruction": `hooks:
  before_apply: {instructions: Review the plan.}
`,
	}
	for name, hooks := range tests {
		t.Run(name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "mirror.yaml")
			content := `schema: 1
project: {name: mirror}
version: {source: git, output: [git]}
git: {tag_template: "{name}/v{version}"}
` + hooks
			require.NoError(t, os.WriteFile(path, []byte(content), 0o644))
			_, err := Load(path)
			require.Error(t, err)
		})
	}
}

func TestLoadRejectsMultipleDocuments(t *testing.T) {
	path := filepath.Join(t.TempDir(), "mirror.yaml")
	require.NoError(t, os.WriteFile(path, []byte(`schema: 1
version:
  source: git
  output: [git]
---
schema: 1
version:
  source: git
  output: [git]
`), 0o644))

	_, err := Load(path)
	require.ErrorContains(t, err, "multiple YAML documents")
}

func TestLoadRejectsSemanticErrors(t *testing.T) {
	tests := map[string]string{
		"unsupported schema": `schema: 2
version: {source: git, output: [git]}
`,
		"empty output": `schema: 1
version: {source: git, output: []}
`,
		"duplicate output": `schema: 1
version: {source: git, output: [git, git]}
`,
		"name conflict": `schema: 1
project: {name: mirror, name_source: package.json}
version: {source: git, output: [git]}
`,
		"name template without name": `schema: 1
version: {source: git, output: [git]}
git: {tag_template: "{name}/v{version}"}
`,
	}
	for name, content := range tests {
		t.Run(name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "mirror.yaml")
			require.NoError(t, os.WriteFile(path, []byte(content), 0o644))
			_, err := Load(path)
			require.Error(t, err)
		})
	}
}

func TestResolvePrecedence(t *testing.T) {
	root := t.TempDir()
	home := t.TempDir()
	project := filepath.Join(root, "mirror.yaml")
	explicit := filepath.Join(root, "custom.yaml")
	global := filepath.Join(home, ".guiho", "mirror", "mirror.yaml")
	require.NoError(t, os.MkdirAll(filepath.Dir(global), 0o755))
	for _, path := range []string{project, explicit, global} {
		require.NoError(t, os.WriteFile(path, []byte("schema: 1\nversion: {source: git, output: [git]}\n"), 0o644))
	}

	resolved, err := Resolve(root, "custom.yaml", home)
	require.NoError(t, err)
	assert.Equal(t, explicit, resolved)

	resolved, err = Resolve(root, "", home)
	require.NoError(t, err)
	assert.Equal(t, project, resolved)

	require.NoError(t, os.Remove(project))
	resolved, err = Resolve(root, "", home)
	require.NoError(t, err)
	assert.Equal(t, global, resolved)
}
