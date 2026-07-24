/**
 * @copyright Copyright © 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

package config

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

// MirrorConfig represents the full mirror.yaml configuration structure.
type MirrorConfig struct {
	Schema  int           `yaml:"schema" json:"schema"`
	Project ProjectConfig `yaml:"project" json:"project"`
	Version VersionConfig `yaml:"version" json:"version"`
	Package PackageConfig `yaml:"package,omitempty" json:"package,omitempty"`
	Jsr     JsrConfig     `yaml:"jsr,omitempty" json:"jsr,omitempty"`
	Git     GitConfig     `yaml:"git" json:"git"`
	Agents  AgentsConfig  `yaml:"agents,omitempty" json:"agents,omitempty"`
	Hooks   HooksConfig   `yaml:"hooks,omitempty" json:"hooks,omitempty"`
}

// ProjectConfig holds project identity settings.
type ProjectConfig struct {
	Name       string `yaml:"name,omitempty" json:"name,omitempty"`
	NameSource string `yaml:"name_source,omitempty" json:"name_source,omitempty"`
}

// VersionConfig holds semantic versioning source and output adapters.
type VersionConfig struct {
	Scheme       string   `yaml:"scheme" json:"scheme"`
	Source       string   `yaml:"source" json:"source"`
	Output       []string `yaml:"output" json:"output"`
	PrereleaseID string   `yaml:"prerelease_id,omitempty" json:"prerelease_id,omitempty"`
}

// PackageConfig holds package.json path settings.
type PackageConfig struct {
	Path           string   `yaml:"path,omitempty" json:"path,omitempty"`
	AuxiliaryPaths []string `yaml:"auxiliary_paths,omitempty" json:"auxiliary_paths,omitempty"`
}

// JsrConfig holds jsr.json path settings.
type JsrConfig struct {
	Path string `yaml:"path,omitempty" json:"path,omitempty"`
}

// GitConfig holds Git-related versioning settings.
type GitConfig struct {
	TagTemplate string `yaml:"tag_template" json:"tag_template"`
	Commit      bool   `yaml:"commit" json:"commit"`
	Push        bool   `yaml:"push" json:"push"`
	AllowDirty  bool   `yaml:"allow_dirty" json:"allow_dirty"`
}

// AgentsConfig holds agent integration settings.
type AgentsConfig struct {
	WriteChangelog bool   `yaml:"write_changelog,omitempty" json:"write_changelog,omitempty"`
	ChangelogPath  string `yaml:"changelog_path,omitempty" json:"changelog_path,omitempty"`
}

// HooksConfig holds lifecycle hook commands.
type HooksConfig map[string][]string

// Load reads and strictly parses a mirror.yaml file.
func Load(path string) (*MirrorConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file %s: %w", path, err)
	}

	// Strip UTF-8 BOM if present
	if len(data) >= 3 && data[0] == 0xEF && data[1] == 0xBB && data[2] == 0xBF {
		data = data[3:]
	}

	// Trim trailing whitespace
	data = bytes.TrimRight(data, "\r\n\t ")
	if len(data) == 0 {
		return nil, fmt.Errorf("config file %s is empty", path)
	}

	var cfg MirrorConfig
	decoder := yaml.NewDecoder(
		bytes.NewReader(data),
	)
	decoder.KnownFields(true)

	if err := decoder.Decode(&cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config file %s: %w", path, err)
	}

	if cfg.Schema == 0 {
		cfg.Schema = 1
	}
	if cfg.Version.Scheme == "" {
		cfg.Version.Scheme = "semver"
	}
	if cfg.Git.TagTemplate == "" {
		cfg.Git.TagTemplate = "{name}/v{version}"
	}

	return &cfg, nil
}

// JSONSchema returns a JSON Schema string for mirror.yaml validation.
func JSONSchema() string {
	schema := map[string]interface{}{
		"$schema":     "http://json-schema.org/draft-07/schema#",
		"title":       "Mirror Configuration",
		"description": "Configuration schema for mirror.yaml",
		"type":        "object",
		"properties": map[string]interface{}{
			"schema": map[string]interface{}{
				"type":    "integer",
				"default": 1,
			},
			"project": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"name":        map[string]interface{}{"type": "string"},
					"name_source": map[string]interface{}{"type": "string"},
				},
			},
			"version": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"scheme":        map[string]interface{}{"type": "string", "default": "semver"},
					"source":        map[string]interface{}{"type": "string"},
					"output":        map[string]interface{}{"type": "array", "items": map[string]interface{}{"type": "string"}},
					"prerelease_id": map[string]interface{}{"type": "string"},
				},
			},
			"git": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"tag_template": map[string]interface{}{"type": "string"},
					"commit":       map[string]interface{}{"type": "boolean"},
					"push":         map[string]interface{}{"type": "boolean"},
					"allow_dirty":  map[string]interface{}{"type": "boolean"},
				},
			},
		},
	}
	data, _ := json.MarshalIndent(schema, "", "  ")
	return string(data)
}


