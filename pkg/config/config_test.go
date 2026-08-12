/**
 * @copyright Copyright © 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

package config

import (
	"bytes"
	"encoding/json"
	"fmt"
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

func TestSchemaArtifactParity(t *testing.T) {
	artifact, err := findSchemaArtifact()
	require.NoError(t, err, "locate the committed mirror/schema/mirror.schema.json artifact")

	committed, err := os.ReadFile(artifact)
	require.NoError(t, err)

	generated := []byte(JSONSchema() + "\n")
	if !bytes.Equal(committed, generated) {
		t.Fatalf(
			"committed schema artifact %s drifted from the production Go generator; regenerate it with:\n  go run . config schema > mirror/schema/mirror.schema.json\ncommitted: %d bytes; generated: %d bytes",
			artifact, len(committed), len(generated),
		)
	}
}

func TestJSONSchemaHookContract(t *testing.T) {
	schema := mustSchemaMap(t)

	require.Equal(t, false, schema["additionalProperties"], "root contract must reject unknown fields")

	hooks := mustMap(t, mustMap(t, schema["properties"])["hooks"])
	require.Equal(t, false, hooks["additionalProperties"], "hooks must reject unknown events")
	require.NotContains(t, hooks, "patternProperties", "hooks must not open arbitrary event names")

	hookProperties := mustMap(t, hooks["properties"])
	expectedEvents := map[string]bool{}
	for _, event := range hookEvents {
		expectedEvents[string(event)] = true
	}
	for alias := range hookAliases {
		expectedEvents[alias] = true
	}
	require.Len(t, hookProperties, len(expectedEvents), "schema must define exactly the supported event and alias names")
	for name := range expectedEvents {
		require.Contains(t, hookProperties, name, "schema must define hook event %q", name)
	}
	require.NotContains(t, hookProperties, "before_release", "schema must not accept unknown events")

	for _, event := range hookEvents {
		name := string(event)
		t.Run(name, func(t *testing.T) {
			assertHookValue(t, schema, name, supportsInstructionHooks(event))
		})
	}
	for alias := range hookAliases {
		t.Run(alias, func(t *testing.T) {
			assertHookValue(t, schema, alias, false)
		})
	}
}

func assertHookValue(t *testing.T, schema map[string]any, name string, instructions bool) {
	t.Helper()

	value := hookValueSchema(t, schema, name)
	alternatives := hookAlternatives(t, value)
	require.Len(t, alternatives, 3, "hook %q must accept a command string, a command list, and a hook object", name)

	nonEmptyString := alternativeByType(t, alternatives, "string")
	require.Equal(t, float64(1), nonEmptyString["minLength"], "hook %q string form must reject empty values", name)

	nonEmptyList := alternativeByType(t, alternatives, "array")
	require.Equal(t, float64(1), nonEmptyList["minItems"], "hook %q list form must reject empty lists", name)
	require.Equal(t, map[string]any{"type": "string", "minLength": float64(1)}, nonEmptyList["items"], "hook %q list items must be non-empty strings", name)

	object := alternativeByType(t, alternatives, "object")
	require.Equal(t, false, object["additionalProperties"], "hook %q object form must reject unknown fields", name)
	properties := mustMap(t, object["properties"])
	require.Contains(t, properties, "commands", "hook %q object form must accept commands", name)
	assertNonEmptyStringOrList(t, properties["commands"], name+".commands")
	if instructions {
		require.Contains(t, properties, "instructions", "hook %q object form must accept instructions", name)
		assertNonEmptyStringOrList(t, properties["instructions"], name+".instructions")
		require.Equal(t, []any{
			map[string]any{"required": []any{"instructions"}},
			map[string]any{"required": []any{"commands"}},
		}, object["anyOf"], "hook %q object form must require instructions, commands, or both", name)
	} else {
		require.NotContains(t, properties, "instructions", "command-only hook %q object form must reject instructions", name)
		require.NotContains(t, object, "anyOf", "command-only hook %q object form must not accept an instructions-only object", name)
		require.Equal(t, []any{"commands"}, object["required"], "command-only hook %q object form must require commands", name)
	}
}

func assertNonEmptyStringOrList(t *testing.T, value any, path string) {
	t.Helper()
	field := mustMap(t, value)
	alternatives := hookAlternatives(t, field)
	require.Len(t, alternatives, 2, "%s must accept one non-empty string or a non-empty list", path)
	require.Equal(t, map[string]any{"type": "string", "minLength": float64(1)}, alternatives[0], "%s must accept one non-empty string", path)
	require.Equal(t, map[string]any{
		"type": "array", "minItems": float64(1),
		"items": map[string]any{"type": "string", "minLength": float64(1)},
	}, alternatives[1], "%s must accept a non-empty list of non-empty strings", path)
}

func mustSchemaMap(t *testing.T) map[string]any {
	t.Helper()
	var schema map[string]any
	require.NoError(t, json.Unmarshal([]byte(JSONSchema()), &schema), "generated schema must be valid JSON")
	return schema
}

func hookValueSchema(t *testing.T, schema map[string]any, name string) map[string]any {
	t.Helper()
	hookProperties := mustMap(t, mustMap(t, mustMap(t, schema["properties"])["hooks"])["properties"])
	return mustMap(t, hookProperties[name])
}

func hookAlternatives(t *testing.T, value map[string]any) []any {
	t.Helper()
	require.Contains(t, value, "oneOf", "hook value must declare its alternatives via oneOf")
	return mustSlice(t, value["oneOf"])
}

func alternativeByType(t *testing.T, alternatives []any, want string) map[string]any {
	t.Helper()
	var found map[string]any
	for _, alternative := range alternatives {
		object := mustMap(t, alternative)
		if object["type"] == want {
			require.Nil(t, found, "hook must declare exactly one %q alternative", want)
			found = object
		}
	}
	require.NotNil(t, found, "hook must declare a %q alternative", want)
	return found
}

func mustMap(t *testing.T, value any) map[string]any {
	t.Helper()
	object, ok := value.(map[string]any)
	require.True(t, ok, "expected a JSON object")
	return object
}

func mustSlice(t *testing.T, value any) []any {
	t.Helper()
	list, ok := value.([]any)
	require.True(t, ok, "expected a JSON array")
	return list
}

func findSchemaArtifact() (string, error) {
	dir, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("resolve working directory: %w", err)
	}
	for {
		candidate := filepath.Join(dir, "mirror", "schema", "mirror.schema.json")
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			return candidate, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("mirror/schema/mirror.schema.json not found above %s", dir)
		}
		dir = parent
	}
}

func TestLoadAcceptsIssue28HookReproduction(t *testing.T) {
	path := filepath.Join(t.TempDir(), "mirror.yaml")
	require.NoError(t, os.WriteFile(path, []byte(`schema: 1
project: {name: mirror}
version: {source: git, output: [git]}
git: {tag_template: "{name}/v{version}"}
hooks:
  "after:plan":
    instructions: Review the generated release plan.
    commands: ["go test ./..."]
  "before:apply":
    commands: go vet ./...
  "after:commit": ["echo committed"]
  on_push_error: ./devops/report-failure.sh
`), 0o644))

	cfg, err := Load(path)
	require.NoError(t, err)
	assert.Equal(t, HookDefinition{
		Instructions: []string{"Review the generated release plan."},
		Commands:     []string{"go test ./..."},
	}, cfg.Hooks[HookAfterPlan])
	assert.Equal(t, HookDefinition{Commands: []string{"go vet ./..."}}, cfg.Hooks[HookBeforeApply])
	assert.Equal(t, HookDefinition{Commands: []string{"echo committed"}}, cfg.Hooks[HookAfterCommit])
	assert.Equal(t, HookDefinition{Commands: []string{"./devops/report-failure.sh"}}, cfg.Hooks[HookOnPushError])
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
		"empty instruction string": `hooks:
  "after:plan": {instructions: ""}
`,
		"empty command string": `hooks:
  "before:commit": {commands: ""}
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
