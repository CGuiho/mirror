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

type HookEvent string

const (
	HookBeforeEverything HookEvent = "before:everything"
	HookAfterEverything  HookEvent = "after:everything"
	HookBeforePlan       HookEvent = "before:plan"
	HookAfterPlan        HookEvent = "after:plan"
	HookOnPlanError      HookEvent = "on:plan-error"
	HookBeforeApply      HookEvent = "before:apply"
	HookAfterApply       HookEvent = "after:apply"
	HookOnApplyError     HookEvent = "on:apply-error"
	HookBeforeWrite      HookEvent = "before:write"
	HookAfterWrite       HookEvent = "after:write"
	HookOnWriteError     HookEvent = "on:write-error"
	HookBeforeCommit     HookEvent = "before:commit"
	HookAfterCommit      HookEvent = "after:commit"
	HookOnCommitError    HookEvent = "on:commit-error"
	HookBeforeTag        HookEvent = "before:tag"
	HookAfterTag         HookEvent = "after:tag"
	HookOnTagError       HookEvent = "on:tag-error"
	HookBeforePush       HookEvent = "before:push"
	HookAfterPush        HookEvent = "after:push"
	HookOnPushError      HookEvent = "on:push-error"
	HookOnError          HookEvent = "on:error"
)

var hookEvents = []HookEvent{
	HookBeforeEverything, HookAfterEverything,
	HookBeforePlan, HookAfterPlan, HookOnPlanError,
	HookBeforeApply, HookAfterApply, HookOnApplyError,
	HookBeforeWrite, HookAfterWrite, HookOnWriteError,
	HookBeforeCommit, HookAfterCommit, HookOnCommitError,
	HookBeforeTag, HookAfterTag, HookOnTagError,
	HookBeforePush, HookAfterPush, HookOnPushError,
	HookOnError,
}

var supportedHookEvents = func() map[HookEvent]struct{} {
	events := make(map[HookEvent]struct{}, len(hookEvents))
	for _, event := range hookEvents {
		events[event] = struct{}{}
	}
	return events
}()

var hookAliases = map[string]HookEvent{
	"before_everything": HookBeforeEverything,
	"after_everything":  HookAfterEverything,
	"before_plan":       HookBeforePlan,
	"after_plan":        HookAfterPlan,
	"on_plan_error":     HookOnPlanError,
	"before_apply":      HookBeforeApply,
	"after_apply":       HookAfterApply,
	"on_apply_error":    HookOnApplyError,
	"before_write":      HookBeforeWrite,
	"after_write":       HookAfterWrite,
	"on_write_error":    HookOnWriteError,
	"before_commit":     HookBeforeCommit,
	"after_commit":      HookAfterCommit,
	"on_commit_error":   HookOnCommitError,
	"before_tag":        HookBeforeTag,
	"after_tag":         HookAfterTag,
	"on_tag_error":      HookOnTagError,
	"before_push":       HookBeforePush,
	"after_push":        HookAfterPush,
	"on_push_error":     HookOnPushError,
	"on_error":          HookOnError,
}

type HookDefinition struct {
	Instructions []string `yaml:"instructions,omitempty" json:"instructions,omitempty"`
	Commands     []string `yaml:"commands,omitempty" json:"commands,omitempty"`
}

type HooksConfig map[HookEvent]HookDefinition

func HookEvents() []HookEvent {
	return append([]HookEvent(nil), hookEvents...)
}

func (hooks HooksConfig) HasCommands() bool {
	for _, definition := range hooks {
		if len(definition.Commands) > 0 {
			return true
		}
	}
	return false
}

func (hooks HooksConfig) CommandCount() int {
	count := 0
	for _, definition := range hooks {
		count += len(definition.Commands)
	}
	return count
}

func (hooks HooksConfig) CommandEvents() []HookEvent {
	events := make([]HookEvent, 0)
	for _, event := range hookEvents {
		if len(hooks[event].Commands) > 0 {
			events = append(events, event)
		}
	}
	return events
}

type rawConfig struct {
	Schema  *int                 `yaml:"schema"`
	Project *rawProjectConfig    `yaml:"project"`
	Version *rawVersionConfig    `yaml:"version"`
	Package *rawPackageConfig    `yaml:"package"`
	JSR     *rawJSRConfig        `yaml:"jsr"`
	Git     *rawGitConfig        `yaml:"git"`
	Agents  *rawAgentsConfig     `yaml:"agents"`
	Hooks   map[string]yaml.Node `yaml:"hooks"`
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
		event, err := normalizeHookEvent(name)
		if err != nil {
			return nil, err
		}
		if _, duplicate := cfg.Hooks[event]; duplicate {
			return nil, fmt.Errorf("hooks defines duplicate event %q", event)
		}
		definition, err := normalizeHookDefinition(name, value)
		if err != nil {
			return nil, err
		}
		if name != string(event) && len(definition.Instructions) > 0 {
			return nil, fmt.Errorf("hooks.%s is a command-only compatibility alias; use %q for instructions", name, event)
		}
		cfg.Hooks[event] = definition
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
	for event, definition := range cfg.Hooks {
		if _, supported := supportedHookEvents[event]; !supported {
			return fmt.Errorf("hooks contains unsupported event %q", event)
		}
		if len(definition.Instructions) == 0 && len(definition.Commands) == 0 {
			return fmt.Errorf("hooks.%s requires instructions, commands, or both", event)
		}
		if !supportsInstructionHooks(event) && len(definition.Instructions) > 0 {
			return fmt.Errorf("hooks.%s does not support AI-agent instructions", event)
		}
		for _, instruction := range definition.Instructions {
			if strings.TrimSpace(instruction) == "" {
				return fmt.Errorf("hooks.%s cannot contain an empty instruction", event)
			}
		}
		for _, command := range definition.Commands {
			if strings.TrimSpace(command) == "" {
				return fmt.Errorf("hooks.%s cannot contain an empty command", event)
			}
		}
	}
	return nil
}

func normalizeHookEvent(name string) (HookEvent, error) {
	event := HookEvent(name)
	if _, supported := supportedHookEvents[event]; supported {
		return event, nil
	}
	if canonical, supported := hookAliases[name]; supported {
		return canonical, nil
	}
	return "", fmt.Errorf("hooks contains unsupported event %q", name)
}

func normalizeHookDefinition(name string, node yaml.Node) (HookDefinition, error) {
	node = dereferenceYAMLNode(node)
	path := "hooks." + name
	switch node.Kind {
	case yaml.ScalarNode, yaml.SequenceNode:
		commands, err := decodeHookStrings(node, path)
		return HookDefinition{Commands: commands}, err
	case yaml.MappingNode:
		definition := HookDefinition{}
		seen := map[string]struct{}{}
		for index := 0; index < len(node.Content); index += 2 {
			field := node.Content[index]
			value := node.Content[index+1]
			if field.Kind != yaml.ScalarNode || field.Tag != "!!str" {
				return HookDefinition{}, fmt.Errorf("%s fields must be strings", path)
			}
			if _, duplicate := seen[field.Value]; duplicate {
				return HookDefinition{}, fmt.Errorf("%s contains duplicate field %q", path, field.Value)
			}
			seen[field.Value] = struct{}{}
			values, err := decodeHookStrings(*value, path+"."+field.Value)
			if err != nil {
				return HookDefinition{}, err
			}
			switch field.Value {
			case "instructions":
				definition.Instructions = values
			case "commands":
				definition.Commands = values
			default:
				return HookDefinition{}, fmt.Errorf("%s contains unknown field %q", path, field.Value)
			}
		}
		return definition, nil
	default:
		return HookDefinition{}, fmt.Errorf("%s must be a command string, command list, or hook object", path)
	}
}

func decodeHookStrings(node yaml.Node, path string) ([]string, error) {
	node = dereferenceYAMLNode(node)
	switch node.Kind {
	case yaml.ScalarNode:
		if node.Tag != "!!str" {
			return nil, fmt.Errorf("%s must be a string or list of strings", path)
		}
		return []string{node.Value}, nil
	case yaml.SequenceNode:
		if len(node.Content) == 0 {
			return nil, fmt.Errorf("%s cannot be an empty list", path)
		}
		values := make([]string, 0, len(node.Content))
		for _, item := range node.Content {
			normalized := dereferenceYAMLNode(*item)
			if normalized.Kind != yaml.ScalarNode || normalized.Tag != "!!str" {
				return nil, fmt.Errorf("%s must contain only strings", path)
			}
			values = append(values, normalized.Value)
		}
		return values, nil
	default:
		return nil, fmt.Errorf("%s must be a string or list of strings", path)
	}
}

func dereferenceYAMLNode(node yaml.Node) yaml.Node {
	for node.Kind == yaml.AliasNode && node.Alias != nil {
		node = *node.Alias
	}
	return node
}

func supportsInstructionHooks(event HookEvent) bool {
	switch event {
	case HookBeforeEverything, HookAfterEverything,
		HookBeforePlan, HookAfterPlan, HookOnPlanError,
		HookBeforeApply, HookAfterApply, HookOnApplyError,
		HookOnError:
		return true
	default:
		return false
	}
}

func JSONSchema() string {
	stringOrList := []any{
		map[string]any{"type": "string", "minLength": 1},
		map[string]any{"type": "array", "minItems": 1, "items": map[string]any{"type": "string", "minLength": 1}},
	}
	hookObject := map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"anyOf": []any{
			map[string]any{"required": []string{"instructions"}},
			map[string]any{"required": []string{"commands"}},
		},
		"properties": map[string]any{
			"instructions": map[string]any{"oneOf": stringOrList},
			"commands":     map[string]any{"oneOf": stringOrList},
		},
	}
	commandHookObject := map[string]any{
		"type":                 "object",
		"additionalProperties": false,
		"required":             []string{"commands"},
		"properties": map[string]any{
			"commands": map[string]any{"oneOf": stringOrList},
		},
	}
	hookValue := func(instructions bool) map[string]any {
		object := commandHookObject
		if instructions {
			object = hookObject
		}
		return map[string]any{
			"oneOf": []any{
				map[string]any{"type": "string", "minLength": 1},
				map[string]any{"type": "array", "minItems": 1, "items": map[string]any{"type": "string", "minLength": 1}},
				object,
			},
		}
	}
	hookProperties := map[string]any{}
	for _, event := range hookEvents {
		hookProperties[string(event)] = hookValue(supportsInstructionHooks(event))
	}
	for alias := range hookAliases {
		hookProperties[alias] = hookValue(false)
	}

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
				"type":                 "object",
				"additionalProperties": false,
				"properties":           hookProperties,
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
