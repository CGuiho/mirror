/**
 * @copyright Copyright © 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

package config

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"go.yaml.in/yaml/v3"
)

const (
	DefaultPackagePath = "package.json"
	DefaultJSRPath     = "jsr.json"
	DefaultTagTemplate = "v{version}"
)

var supportedAdapters = map[string]struct{}{
	"package.json": {},
	"jsr.json":     {},
	"git":          {},
}

var supportedTagTemplates = map[string]struct{}{
	"v{version}":        {},
	"{name}@{version}":  {},
	"{name}/v{version}": {},
}

// MirrorConfig is the normalized, semantically validated mirror.yaml contract.
type MirrorConfig struct {
	Schema  int           `yaml:"schema" json:"schema"`
	Project ProjectConfig `yaml:"project,omitempty" json:"project"`
	Version VersionConfig `yaml:"version" json:"version"`
	Package PackageConfig `yaml:"package,omitempty" json:"package"`
	JSR     JSRConfig     `yaml:"jsr,omitempty" json:"jsr"`
	Git     GitConfig     `yaml:"git,omitempty" json:"git"`
	Agents  AgentsConfig  `yaml:"agents,omitempty" json:"agents"`
	Hooks   HooksConfig   `yaml:"hooks,omitempty" json:"hooks"`
}

type ProjectConfig struct {
	Name       string `yaml:"name,omitempty" json:"name,omitempty"`
	NameSource string `yaml:"name_source,omitempty" json:"name_source,omitempty"`
}

type VersionConfig struct {
	Scheme       string   `yaml:"scheme" json:"scheme"`
	Source       string   `yaml:"source" json:"source"`
	Output       []string `yaml:"output" json:"output"`
	PrereleaseID string   `yaml:"prerelease_id,omitempty" json:"prerelease_id,omitempty"`
}

type PackageConfig struct {
	Path           string   `yaml:"path,omitempty" json:"path"`
	AuxiliaryPaths []string `yaml:"auxiliary_paths,omitempty" json:"auxiliary_paths"`
}

type JSRConfig struct {
	Path string `yaml:"path,omitempty" json:"path"`
}

// JsrConfig is retained as a source-compatible alias for early Go consumers.
type JsrConfig = JSRConfig

type GitConfig struct {
	TagTemplate string `yaml:"tag_template,omitempty" json:"tag_template"`
	Commit      bool   `yaml:"commit,omitempty" json:"commit"`
	Push        bool   `yaml:"push,omitempty" json:"push"`
	AllowDirty  bool   `yaml:"allow_dirty,omitempty" json:"allow_dirty"`
}

type AgentsConfig struct {
	WriteChangelog bool   `yaml:"write_changelog,omitempty" json:"write_changelog"`
	ChangelogPath  string `yaml:"changelog_path,omitempty" json:"changelog_path"`
}

type HooksConfig map[string][]string

type rawConfig struct {
	Schema  *int              `yaml:"schema"`
	Project *rawProjectConfig `yaml:"project"`
	Version *rawVersionConfig `yaml:"version"`
	Package *rawPackageConfig `yaml:"package"`
	JSR     *rawJSRConfig     `yaml:"jsr"`
	Git     *rawGitConfig     `yaml:"git"`
	Agents  *rawAgentsConfig  `yaml:"agents"`
	Hooks   map[string]any    `yaml:"hooks"`
}

type rawProjectConfig struct {
	Name       *string `yaml:"name"`
	NameSource *string `yaml:"name_source"`
}

type rawVersionConfig struct {
	Scheme       *string   `yaml:"scheme"`
	Source       *string   `yaml:"source"`
	Output       *[]string `yaml:"output"`
	PrereleaseID *string   `yaml:"prerelease_id"`
}

type rawPackageConfig struct {
	Path           *string   `yaml:"path"`
	AuxiliaryPaths *[]string `yaml:"auxiliary_paths"`
}

type rawJSRConfig struct {
	Path *string `yaml:"path"`
}

type rawGitConfig struct {
	TagTemplate *string `yaml:"tag_template"`
	Commit      *bool   `yaml:"commit"`
	Push        *bool   `yaml:"push"`
	AllowDirty  *bool   `yaml:"allow_dirty"`
}

type rawAgentsConfig struct {
	WriteChangelog *bool   `yaml:"write_changelog"`
	ChangelogPath  *string `yaml:"changelog_path"`
}

// Resolve applies Mirror's deterministic configuration precedence:
// explicit path, project mirror.yaml, then ~/.guiho/mirror/mirror.yaml.
func Resolve(cwd, explicitPath, home string) (string, error) {
	absoluteCWD, err := filepath.Abs(cwd)
	if err != nil {
		return "", fmt.Errorf("resolve working directory %q: %w", cwd, err)
	}

	if explicitPath != "" {
		path := explicitPath
		if !filepath.IsAbs(path) {
			path = filepath.Join(absoluteCWD, path)
		}
		path, err = filepath.Abs(path)
		if err != nil {
			return "", fmt.Errorf("resolve explicit configuration %q: %w", explicitPath, err)
		}
		if _, err := os.Stat(path); err != nil {
			return "", fmt.Errorf("configuration file not found: %s", path)
		}
		return path, nil
	}

	projectPath := filepath.Join(absoluteCWD, "mirror.yaml")
	if _, err := os.Stat(projectPath); err == nil {
		return projectPath, nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return "", fmt.Errorf("inspect project configuration %s: %w", projectPath, err)
	}

	if home == "" {
		home, err = os.UserHomeDir()
		if err != nil {
			return "", fmt.Errorf("resolve user home directory: %w", err)
		}
	}
	globalPath := filepath.Join(home, ".guiho", "mirror", "mirror.yaml")
	if _, err := os.Stat(globalPath); err == nil {
		return globalPath, nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return "", fmt.Errorf("inspect global configuration %s: %w", globalPath, err)
	}

	return "", fmt.Errorf("Mirror configuration not found; checked %s and %s", projectPath, globalPath)
}

func LoadResolved(cwd, explicitPath, home string) (*MirrorConfig, string, error) {
	path, err := Resolve(cwd, explicitPath, home)
	if err != nil {
		return nil, "", err
	}
	cfg, err := Load(path)
	if err != nil {
		return nil, "", err
	}
	return cfg, path, nil
}

// Load strictly decodes exactly one YAML document and then validates semantics.
func Load(path string) (*MirrorConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read configuration %s: %w", path, err)
	}
	data = bytes.TrimPrefix(data, []byte{0xEF, 0xBB, 0xBF})
	if len(bytes.TrimSpace(data)) == 0 {
		return nil, fmt.Errorf("configuration file is empty: %s", path)
	}

	decoder := yaml.NewDecoder(bytes.NewReader(data))
	decoder.KnownFields(true)
	var raw rawConfig
	if err := decoder.Decode(&raw); err != nil {
		return nil, fmt.Errorf("decode configuration %s: %w", path, err)
	}
	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		if err == nil {
			return nil, fmt.Errorf("decode configuration %s: multiple YAML documents are not supported", path)
		}
		return nil, fmt.Errorf("decode configuration %s: %w", path, err)
	}

	cfg, err := normalize(raw)
	if err != nil {
		return nil, fmt.Errorf("validate configuration %s: %w", path, err)
	}
	return cfg, nil
}

func normalize(raw rawConfig) (*MirrorConfig, error) {
	cfg := &MirrorConfig{
		Schema:  1,
		Version: VersionConfig{Scheme: "semver"},
		Package: PackageConfig{Path: DefaultPackagePath, AuxiliaryPaths: []string{}},
		JSR:     JSRConfig{Path: DefaultJSRPath},
		Git:     GitConfig{TagTemplate: DefaultTagTemplate},
		Agents:  AgentsConfig{WriteChangelog: true, ChangelogPath: "CHANGELOG.md"},
		Hooks:   HooksConfig{},
	}

	if raw.Schema == nil {
		return nil, errors.New("schema is required")
	}
	cfg.Schema = *raw.Schema
	if raw.Project != nil {
		cfg.Project.Name = stringValue(raw.Project.Name)
		cfg.Project.NameSource = stringValue(raw.Project.NameSource)
	}
	if raw.Version == nil {
		return nil, errors.New("version is required")
	}
	if raw.Version.Scheme != nil {
		cfg.Version.Scheme = *raw.Version.Scheme
	}
	cfg.Version.Source = stringValue(raw.Version.Source)
	if raw.Version.Output == nil {
		return nil, errors.New("version.output is required")
	}
	cfg.Version.Output = append([]string(nil), (*raw.Version.Output)...)
	cfg.Version.PrereleaseID = stringValue(raw.Version.PrereleaseID)
	if raw.Package != nil {
		if raw.Package.Path != nil {
			cfg.Package.Path = *raw.Package.Path
		}
		if raw.Package.AuxiliaryPaths != nil {
			cfg.Package.AuxiliaryPaths = append([]string(nil), (*raw.Package.AuxiliaryPaths)...)
		}
	}
	if raw.JSR != nil && raw.JSR.Path != nil {
		cfg.JSR.Path = *raw.JSR.Path
	}
	if raw.Git != nil {
		if raw.Git.TagTemplate != nil {
			cfg.Git.TagTemplate = *raw.Git.TagTemplate
		}
		cfg.Git.Commit = boolValue(raw.Git.Commit)
		cfg.Git.Push = boolValue(raw.Git.Push)
		cfg.Git.AllowDirty = boolValue(raw.Git.AllowDirty)
	}
	if raw.Agents != nil {
		if raw.Agents.WriteChangelog != nil {
			cfg.Agents.WriteChangelog = *raw.Agents.WriteChangelog
		}
		if raw.Agents.ChangelogPath != nil {
			cfg.Agents.ChangelogPath = *raw.Agents.ChangelogPath
		}
	}
	for name, value := range raw.Hooks {
		switch typed := value.(type) {
		case string:
			cfg.Hooks[name] = []string{typed}
		case []any:
			for _, item := range typed {
				command, ok := item.(string)
				if !ok {
					return nil, fmt.Errorf("hooks.%s must contain only strings", name)
				}
				cfg.Hooks[name] = append(cfg.Hooks[name], command)
			}
		default:
			return nil, fmt.Errorf("hooks.%s must be a command string or list of command strings", name)
		}
	}

	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

func (cfg *MirrorConfig) Validate() error {
	if cfg.Schema != 1 {
		return fmt.Errorf("schema must be 1, received %d", cfg.Schema)
	}
	if cfg.Version.Scheme != "semver" {
		return fmt.Errorf("version.scheme must be semver")
	}
	if _, ok := supportedAdapters[cfg.Version.Source]; !ok {
		return fmt.Errorf("version.source must be package.json, jsr.json, or git")
	}
	if len(cfg.Version.Output) == 0 {
		return fmt.Errorf("version.output must contain at least one adapter")
	}
	seen := map[string]struct{}{}
	for _, adapter := range cfg.Version.Output {
		if _, ok := supportedAdapters[adapter]; !ok {
			return fmt.Errorf("version.output contains unsupported adapter %q", adapter)
		}
		if _, exists := seen[adapter]; exists {
			return fmt.Errorf("version.output contains duplicate adapter %q", adapter)
		}
		seen[adapter] = struct{}{}
	}
	if cfg.Project.Name != "" && cfg.Project.NameSource != "" {
		return fmt.Errorf("project.name and project.name_source are mutually exclusive")
	}
	if cfg.Project.NameSource != "" && cfg.Project.NameSource != "package.json" && cfg.Project.NameSource != "jsr.json" {
		return fmt.Errorf("project.name_source must be package.json or jsr.json")
	}
	if _, ok := supportedTagTemplates[cfg.Git.TagTemplate]; !ok {
		return fmt.Errorf("git.tag_template must be v{version}, {name}@{version}, or {name}/v{version}")
	}
	if strings.Contains(cfg.Git.TagTemplate, "{name}") && cfg.Project.Name == "" && cfg.Project.NameSource == "" {
		return fmt.Errorf("git.tag_template %q requires project.name or project.name_source", cfg.Git.TagTemplate)
	}
	if strings.TrimSpace(cfg.Package.Path) == "" {
		return fmt.Errorf("package.path cannot be empty")
	}
	if strings.TrimSpace(cfg.JSR.Path) == "" {
		return fmt.Errorf("jsr.path cannot be empty")
	}
	paths := map[string]struct{}{cfg.Package.Path: {}}
	for _, path := range cfg.Package.AuxiliaryPaths {
		if strings.TrimSpace(path) == "" {
			return fmt.Errorf("package.auxiliary_paths cannot contain empty paths")
		}
		if _, exists := paths[path]; exists {
			return fmt.Errorf("package.auxiliary_paths contains duplicate path %q", path)
		}
		paths[path] = struct{}{}
	}
	if strings.TrimSpace(cfg.Agents.ChangelogPath) == "" {
		return fmt.Errorf("agents.changelog_path cannot be empty")
	}
	for name, commands := range cfg.Hooks {
		if strings.TrimSpace(name) == "" || len(commands) == 0 {
			return fmt.Errorf("hooks entries require a non-empty name and at least one command")
		}
		for _, command := range commands {
			if strings.TrimSpace(command) == "" {
				return fmt.Errorf("hooks.%s cannot contain an empty command", name)
			}
		}
	}
	return nil
}

func JSONSchema() string {
	schema := map[string]any{
		"$schema":              "https://json-schema.org/draft/2020-12/schema",
		"title":                "GUIHO Mirror YAML Configuration",
		"type":                 "object",
		"additionalProperties": false,
		"required":             []string{"schema", "version"},
		"properties": map[string]any{
			"schema": map[string]any{"const": 1},
			"project": map[string]any{
				"type":                 "object",
				"additionalProperties": false,
				"not":                  map[string]any{"required": []string{"name", "name_source"}},
				"properties": map[string]any{
					"name":        map[string]any{"type": "string", "minLength": 1},
					"name_source": map[string]any{"enum": []string{"package.json", "jsr.json"}},
				},
			},
			"package": map[string]any{
				"type":                 "object",
				"additionalProperties": false,
				"properties": map[string]any{
					"path":            map[string]any{"type": "string", "minLength": 1},
					"auxiliary_paths": map[string]any{"type": "array", "uniqueItems": true, "items": map[string]any{"type": "string", "minLength": 1}},
				},
			},
			"jsr": map[string]any{
				"type":                 "object",
				"additionalProperties": false,
				"properties": map[string]any{
					"path": map[string]any{"type": "string", "minLength": 1},
				},
			},
			"version": map[string]any{
				"type":                 "object",
				"additionalProperties": false,
				"required":             []string{"source", "output"},
				"properties": map[string]any{
					"scheme":        map[string]any{"const": "semver"},
					"source":        map[string]any{"enum": []string{"package.json", "jsr.json", "git"}},
					"output":        map[string]any{"type": "array", "minItems": 1, "uniqueItems": true, "items": map[string]any{"enum": []string{"package.json", "jsr.json", "git"}}},
					"prerelease_id": map[string]any{"type": "string"},
				},
			},
			"git": map[string]any{
				"type":                 "object",
				"additionalProperties": false,
				"properties": map[string]any{
					"tag_template": map[string]any{"enum": []string{"v{version}", "{name}@{version}", "{name}/v{version}"}},
					"commit":       map[string]any{"type": "boolean"},
					"push":         map[string]any{"type": "boolean"},
					"allow_dirty":  map[string]any{"type": "boolean"},
				},
			},
			"agents": map[string]any{
				"type":                 "object",
				"additionalProperties": false,
				"properties": map[string]any{
					"write_changelog": map[string]any{"type": "boolean"},
					"changelog_path":  map[string]any{"type": "string", "minLength": 1},
				},
			},
			"hooks": map[string]any{
				"type": "object",
				"additionalProperties": map[string]any{
					"oneOf": []any{
						map[string]any{"type": "string", "minLength": 1},
						map[string]any{"type": "array", "minItems": 1, "items": map[string]any{"type": "string", "minLength": 1}},
					},
				},
			},
		},
	}
	data, err := json.MarshalIndent(schema, "", "  ")
	if err != nil {
		panic(err)
	}
	return string(data)
}

func stringValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func boolValue(value *bool) bool {
	return value != nil && *value
}
