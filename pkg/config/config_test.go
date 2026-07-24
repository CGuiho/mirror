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
	content := `project:
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
	assert.Equal(t, "{name}/v{version}", cfg.Git.TagTemplate)
}

func TestJSONSchema(t *testing.T) {
	schema := JSONSchema()
	assert.Contains(t, schema, "Mirror Configuration")
	assert.Contains(t, schema, "schema")
	assert.Contains(t, schema, "project")
	assert.Contains(t, schema, "version")
	assert.Contains(t, schema, "git")
}
