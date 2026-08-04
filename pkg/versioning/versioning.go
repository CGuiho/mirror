/**
 * @copyright Copyright © 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

package versioning

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/CGuiho/mirror/pkg/config"
	mirrorhooks "github.com/CGuiho/mirror/pkg/hooks"
	mirrorsemver "github.com/CGuiho/mirror/pkg/semver"
	mastersemver "github.com/Masterminds/semver/v3"
)

type VersionPlanAction struct {
	Type           string   `json:"type"`
	Adapter        string   `json:"adapter,omitempty"`
	Path           string   `json:"path,omitempty"`
	Paths          []string `json:"paths,omitempty"`
	CurrentVersion string   `json:"current_version,omitempty"`
	NextVersion    string   `json:"next_version,omitempty"`
	Message        string   `json:"message,omitempty"`
	Tag            string   `json:"tag,omitempty"`
	IncludeCommit  bool     `json:"include_commit,omitempty"`
	IncludeTags    bool     `json:"include_tags,omitempty"`
}

type VersionPlan struct {
	CurrentVersion string               `json:"current"`
	NextVersion    string               `json:"next"`
	Initial        bool                 `json:"initial,omitempty"`
	Source         string               `json:"source"`
	Output         []string             `json:"output"`
	ProjectName    string               `json:"project,omitempty"`
	ConfigPath     string               `json:"config"`
	Tag            string               `json:"tag,omitempty"`
	Actions        []VersionPlanAction  `json:"actions"`
	AllowDirty     bool                 `json:"allow_dirty"`
	CommitEnabled  bool                 `json:"commit_enabled"`
	PushEnabled    bool                 `json:"push_enabled"`
	DryRun         bool                 `json:"dry_run"`
	Applied        bool                 `json:"applied"`
	Completed      []string             `json:"completed,omitempty"`
	HookResults    []mirrorhooks.Result `json:"hooks,omitempty"`
}

var errNoGitVersion = errors.New("no Git version tag")

type Runner interface {
	Run(cwd, name string, args ...string) ([]byte, error)
}

type ExecRunner struct{}

func (ExecRunner) Run(cwd, name string, args ...string) ([]byte, error) {
	command := exec.Command(name, args...)
	command.Dir = cwd
	output, err := command.CombinedOutput()
	if err != nil {
		return output, fmt.Errorf("%s %s: %w: %s", name, strings.Join(args, " "), err, strings.TrimSpace(string(output)))
	}
	return output, nil
}

type ApplyOptions struct {
	Confirmed bool
	Runner    Runner
	Context   context.Context
	Hooks     *mirrorhooks.Session
}

func BuildPlan(cfg *config.MirrorConfig, cfgPath, target, cwd string) (*VersionPlan, error) {
	return BuildPlanWithRunner(cfg, cfgPath, target, cwd, ExecRunner{})
}

func BuildPlanWithRunner(cfg *config.MirrorConfig, cfgPath, target, cwd string, runner Runner) (*VersionPlan, error) {
	if cfg == nil {
		return nil, errors.New("configuration is required")
	}
	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("validate configuration: %w", err)
	}
	if !mirrorsemver.IsSupportedTarget(target) {
		return nil, fmt.Errorf("unsupported version target %q", target)
	}
	absoluteCWD, err := filepath.Abs(cwd)
	if err != nil {
		return nil, fmt.Errorf("resolve working directory %q: %w", cwd, err)
	}
	if runner == nil {
		runner = ExecRunner{}
	}

	projectName, err := resolveProjectName(cfg, absoluteCWD)
	if err != nil {
		return nil, err
	}
	currentVersion, err := readCurrentVersion(cfg, absoluteCWD, projectName, runner)
	initial := false
	var nextVersion string
	if err != nil && errors.Is(err, errNoGitVersion) && cfg.Version.Source == "git" && gitOnlyOutput(cfg.Version.Output) {
		exact, exactErr := mastersemver.StrictNewVersion(strings.TrimPrefix(target, "v"))
		if exactErr != nil {
			return nil, fmt.Errorf("read current version: no Git version tags exist; use an exact semantic version for the initial release instead of relative target %q", target)
		}
		currentVersion = ""
		nextVersion = exact.String()
		initial = true
	} else if err != nil {
		return nil, fmt.Errorf("read current version: %w", err)
	}
	if !initial {
		nextVersion, err = mirrorsemver.Bump(currentVersion, target, cfg.Version.PrereleaseID)
		if err != nil {
			return nil, fmt.Errorf("calculate next version: %w", err)
		}
		currentParsed, _ := mastersemver.StrictNewVersion(currentVersion)
		nextParsed, _ := mastersemver.StrictNewVersion(nextVersion)
		if !nextParsed.GreaterThan(currentParsed) {
			return nil, fmt.Errorf("next version %s must be greater than current version %s", nextVersion, currentVersion)
		}
	}

	plan := &VersionPlan{
		CurrentVersion: currentVersion,
		NextVersion:    nextVersion,
		Initial:        initial,
		Source:         cfg.Version.Source,
		Output:         append([]string(nil), cfg.Version.Output...),
		ProjectName:    projectName,
		ConfigPath:     cfgPath,
		Actions:        []VersionPlanAction{},
		AllowDirty:     cfg.Git.AllowDirty,
		CommitEnabled:  cfg.Git.Commit || cfg.Git.Push,
		PushEnabled:    cfg.Git.Push,
	}

	filePaths := make([]string, 0)
	for _, output := range cfg.Version.Output {
		switch output {
		case "package.json":
			paths := append([]string{cfg.Package.Path}, cfg.Package.AuxiliaryPaths...)
			for _, path := range paths {
				absolutePath := resolvePath(absoluteCWD, path)
				version, _, err := readVersionDocument(absolutePath, "package.json")
				if err != nil {
					return nil, err
				}
				plan.Actions = append(plan.Actions, VersionPlanAction{
					Type: "write-file", Adapter: "package.json", Path: absolutePath,
					CurrentVersion: version, NextVersion: nextVersion,
				})
				filePaths = appendUnique(filePaths, absolutePath)
			}
		case "jsr.json":
			absolutePath := resolvePath(absoluteCWD, cfg.JSR.Path)
			version, _, err := readVersionDocument(absolutePath, "jsr.json")
			if err != nil {
				return nil, err
			}
			plan.Actions = append(plan.Actions, VersionPlanAction{
				Type: "write-file", Adapter: "jsr.json", Path: absolutePath,
				CurrentVersion: version, NextVersion: nextVersion,
			})
			filePaths = appendUnique(filePaths, absolutePath)
		case "git":
			tag, err := mirrorsemver.RenderTag(cfg.Git.TagTemplate, projectName, nextVersion)
			if err != nil {
				return nil, err
			}
			plan.Tag = tag
		}
	}

	if len(filePaths) > 0 && plan.Tag != "" && !plan.CommitEnabled {
		return nil, errors.New("Git output with file outputs requires git.commit or git.push so the tag points at the version commit")
	}
	if len(filePaths) > 0 && plan.CommitEnabled {
		relativePaths := make([]string, 0, len(filePaths))
		for _, path := range filePaths {
			relative, err := filepath.Rel(absoluteCWD, path)
			if err != nil || strings.HasPrefix(relative, "..") {
				return nil, fmt.Errorf("version output path must be inside the working directory: %s", path)
			}
			relativePaths = append(relativePaths, filepath.ToSlash(relative))
		}
		plan.Actions = append(plan.Actions, VersionPlanAction{
			Type: "git-commit", Message: releaseLabel(nextVersion, projectName), Paths: relativePaths,
		})
	}
	if plan.Tag != "" {
		plan.Actions = append(plan.Actions, VersionPlanAction{Type: "git-tag", Tag: plan.Tag})
	}
	if plan.PushEnabled {
		plan.Actions = append(plan.Actions, VersionPlanAction{
			Type: "git-push", IncludeCommit: len(filePaths) > 0 && plan.CommitEnabled, IncludeTags: plan.Tag != "",
		})
	}

	if usesGit(cfg) {
		if _, err := runner.Run(absoluteCWD, "git", "rev-parse", "--is-inside-work-tree"); err != nil {
			return nil, fmt.Errorf("not a Git repository: %s", absoluteCWD)
		}
		if plan.Tag != "" {
			if _, err := runner.Run(absoluteCWD, "git", "check-ref-format", "refs/tags/"+plan.Tag); err != nil {
				return nil, fmt.Errorf("invalid Git tag %s: %w", plan.Tag, err)
			}
		}
		if cfg.Version.Source == "git" && !plan.Initial {
			currentTag, err := mirrorsemver.RenderTag(cfg.Git.TagTemplate, projectName, currentVersion)
			if err != nil {
				return nil, err
			}
			if _, err := runner.Run(absoluteCWD, "git", "merge-base", "--is-ancestor", currentTag, "HEAD"); err != nil {
				tags, listErr := runner.Run(absoluteCWD, "git", "tag", "--list")
				if listErr != nil {
					return nil, fmt.Errorf("list legacy Git tags: %w", listErr)
				}
				reachableLegacy := false
				for _, tag := range strings.Fields(string(tags)) {
					version, ok := versionFromLegacyTag(tag)
					if !ok || version != currentVersion {
						continue
					}
					if _, ancestorErr := runner.Run(absoluteCWD, "git", "merge-base", "--is-ancestor", tag, "HEAD"); ancestorErr == nil {
						reachableLegacy = true
						break
					}
				}
				if !reachableLegacy {
					return nil, fmt.Errorf("current version tag %s is not reachable from HEAD and no reachable legacy tag identifies %s", currentTag, currentVersion)
				}
			}
		}
	}
	return plan, nil
}

func ApplyPlan(plan *VersionPlan, cwd string) error {
	return ApplyPlanWithOptions(plan, cwd, ApplyOptions{Confirmed: true})
}

func HookContextForPlan(plan *VersionPlan) mirrorhooks.Context {
	if plan == nil {
		return mirrorhooks.Context{}
	}
	hookContext := mirrorhooks.Context{
		Stage:          "plan",
		Source:         plan.Source,
		Output:         append([]string(nil), plan.Output...),
		CurrentVersion: plan.CurrentVersion,
		NextVersion:    plan.NextVersion,
		ProjectName:    plan.ProjectName,
		GitTag:         plan.Tag,
		Applied:        plan.Applied,
		DryRun:         plan.DryRun,
		Completed:      append([]string(nil), plan.Completed...),
	}
	for _, action := range plan.Actions {
		switch action.Type {
		case "write-file":
			hookContext.FilePaths = append(hookContext.FilePaths, action.Path)
		case "git-commit":
			hookContext.CommitMessage = action.Message
			hookContext.CommitPaths = append([]string(nil), action.Paths...)
		case "git-tag":
			hookContext.Tag = action.Tag
		case "git-push":
			hookContext.PushCommit = action.IncludeCommit
			hookContext.PushTag = action.IncludeTags
		}
	}
	return hookContext
}

func ApplyPlanWithOptions(plan *VersionPlan, cwd string, options ApplyOptions) error {
	if plan == nil {
		return errors.New("version plan is required")
	}
	if !options.Confirmed {
		return errors.New("refusing to apply without confirmation; pass --yes")
	}
	if options.Runner == nil {
		options.Runner = ExecRunner{}
	}
	if options.Context == nil {
		options.Context = context.Background()
	}
	absoluteCWD, err := filepath.Abs(cwd)
	if err != nil {
		return fmt.Errorf("resolve working directory: %w", err)
	}

	if !plan.AllowDirty && planUsesGit(plan) {
		status, err := options.Runner.Run(absoluteCWD, "git", "status", "--porcelain")
		if err != nil {
			return fmt.Errorf("inspect Git worktree: %w", err)
		}
		if len(bytes.TrimSpace(status)) > 0 {
			return errors.New("Git worktree is dirty; commit changes or pass --allow-dirty")
		}
	}
	if plan.Tag != "" {
		output, err := options.Runner.Run(absoluteCWD, "git", "tag", "--list", plan.Tag)
		if err != nil {
			return fmt.Errorf("inspect local Git tag %s: %w", plan.Tag, err)
		}
		if len(bytes.TrimSpace(output)) > 0 {
			return fmt.Errorf("Git tag already exists: %s", plan.Tag)
		}
		if plan.PushEnabled {
			output, err := options.Runner.Run(absoluteCWD, "git", "ls-remote", "--tags", "origin", "refs/tags/"+plan.Tag)
			if err != nil {
				return fmt.Errorf("inspect remote Git tag %s: %w", plan.Tag, err)
			}
			if len(bytes.TrimSpace(output)) > 0 {
				return fmt.Errorf("remote Git tag already exists: %s", plan.Tag)
			}
		}
	}

	backups := map[string][]byte{}
	for _, action := range plan.Actions {
		if action.Type != "write-file" {
			continue
		}
		data, err := os.ReadFile(action.Path)
		if err != nil {
			return fmt.Errorf("read version output %s: %w", action.Path, err)
		}
		backups[action.Path] = data
		current, _, err := readVersionDocument(action.Path, action.Adapter)
		if err != nil {
			return err
		}
		if current != action.CurrentVersion {
			return fmt.Errorf("version output changed since planning: %s contains %s, planned %s", action.Path, current, action.CurrentVersion)
		}
	}

	filesCommitted := false
	tagCreated := false
	completed := append([]string(nil), plan.Completed...)
	rollbackFiles := func() {
		if filesCommitted {
			return
		}
		for path, data := range backups {
			_ = atomicWrite(path, data)
		}
		retained := completed[:0]
		for _, effect := range completed {
			if effect != "write" {
				retained = append(retained, effect)
			}
		}
		completed = retained
		plan.Completed = append([]string(nil), completed...)
	}
	rollbackStaging := func(paths []string) {
		if len(paths) == 0 {
			return
		}
		args := []string{"reset", "--quiet", "--"}
		args = append(args, paths...)
		_, _ = options.Runner.Run(absoluteCWD, "git", args...)
	}
	baseHookContext := HookContextForPlan(plan)
	runStage := func(
		stage string,
		before, after, onError config.HookEvent,
		hookContext mirrorhooks.Context,
		action func() error,
	) error {
		hookContext.Stage = stage
		hookContext.Completed = append([]string(nil), completed...)
		if options.Hooks != nil {
			if err := options.Hooks.Run(options.Context, before, hookContext); err != nil {
				hookContext.ErrorStage = stage
				hookContext.ErrorMessage = err.Error()
				hookContext.ErrorExitCode = mirrorhooks.ExitCode(err)
				options.Hooks.RunBestEffort(options.Context, onError, hookContext)
				return err
			}
		}
		if err := action(); err != nil {
			hookContext.Completed = append([]string(nil), completed...)
			hookContext.ErrorStage = stage
			hookContext.ErrorMessage = err.Error()
			hookContext.ErrorExitCode = mirrorhooks.ExitCode(err)
			if options.Hooks != nil {
				options.Hooks.RunBestEffort(options.Context, onError, hookContext)
			}
			return err
		}
		completed = append(completed, stage)
		plan.Completed = append([]string(nil), completed...)
		hookContext.Completed = append([]string(nil), completed...)
		if options.Hooks != nil {
			if err := options.Hooks.Run(options.Context, after, hookContext); err != nil {
				hookContext.ErrorStage = stage
				hookContext.ErrorMessage = err.Error()
				hookContext.ErrorExitCode = mirrorhooks.ExitCode(err)
				options.Hooks.RunBestEffort(options.Context, onError, hookContext)
				return err
			}
		}
		return nil
	}

	for index := 0; index < len(plan.Actions); {
		action := plan.Actions[index]
		if action.Type == "write-file" {
			end := index
			writeContext := baseHookContext
			writeContext.FilePaths = []string{}
			for end < len(plan.Actions) && plan.Actions[end].Type == "write-file" {
				writeContext.FilePaths = append(writeContext.FilePaths, plan.Actions[end].Path)
				end++
			}
			err := runStage("write", config.HookBeforeWrite, config.HookAfterWrite, config.HookOnWriteError, writeContext, func() error {
				for _, writeAction := range plan.Actions[index:end] {
					if err := writeVersionDocument(writeAction.Path, writeAction.Adapter, plan.NextVersion); err != nil {
						return err
					}
				}
				return nil
			})
			if err != nil {
				rollbackFiles()
				return err
			}
			index = end
			continue
		}

		switch action.Type {
		case "git-commit":
			commitContext := baseHookContext
			commitContext.CommitMessage = action.Message
			commitContext.CommitPaths = append([]string(nil), action.Paths...)
			err := runStage("commit", config.HookBeforeCommit, config.HookAfterCommit, config.HookOnCommitError, commitContext, func() error {
				for _, path := range action.Paths {
					if _, err := options.Runner.Run(absoluteCWD, "git", "add", "--", path); err != nil {
						rollbackStaging(action.Paths)
						return fmt.Errorf("stage version output %s: %w", path, err)
					}
				}
				commitArgs := []string{"commit", "-m", action.Message, "--"}
				commitArgs = append(commitArgs, action.Paths...)
				if _, err := options.Runner.Run(absoluteCWD, "git", commitArgs...); err != nil {
					rollbackStaging(action.Paths)
					return fmt.Errorf("create release commit: %w", err)
				}
				filesCommitted = true
				return nil
			})
			if err != nil {
				rollbackFiles()
				return err
			}
		case "git-tag":
			tagContext := baseHookContext
			tagContext.Tag = action.Tag
			if err := runStage("tag", config.HookBeforeTag, config.HookAfterTag, config.HookOnTagError, tagContext, func() error {
				if _, err := options.Runner.Run(absoluteCWD, "git", "tag", "-a", action.Tag, "-m", "Release "+action.Tag); err != nil {
					return fmt.Errorf("create Git tag %s: %w", action.Tag, err)
				}
				tagCreated = true
				return nil
			}); err != nil {
				rollbackFiles()
				return err
			}
		case "git-push":
			pushContext := baseHookContext
			pushContext.PushCommit = action.IncludeCommit
			pushContext.PushTag = action.IncludeTags
			if err := runStage("push", config.HookBeforePush, config.HookAfterPush, config.HookOnPushError, pushContext, func() error {
				if action.IncludeCommit {
					if _, err := options.Runner.Run(absoluteCWD, "git", "push", "origin", "HEAD"); err != nil {
						return fmt.Errorf("push release commit: %w", err)
					}
					completed = append(completed, "push:commit")
					plan.Completed = append([]string(nil), completed...)
				}
				if action.IncludeTags {
					ref := "refs/tags/" + plan.Tag
					if _, err := options.Runner.Run(absoluteCWD, "git", "push", "origin", ref+":"+ref); err != nil {
						return fmt.Errorf("push exact Git tag %s: %w", plan.Tag, err)
					}
					completed = append(completed, "push:tag")
					plan.Completed = append([]string(nil), completed...)
				}
				return nil
			}); err != nil {
				return err
			}
		default:
			if tagCreated {
				_, _ = options.Runner.Run(absoluteCWD, "git", "tag", "-d", plan.Tag)
			}
			rollbackFiles()
			return fmt.Errorf("unsupported version plan action %q", action.Type)
		}
		index++
	}
	plan.Applied = true
	return nil
}

func resolveProjectName(cfg *config.MirrorConfig, cwd string) (string, error) {
	if cfg.Project.Name != "" {
		return cfg.Project.Name, nil
	}
	switch cfg.Project.NameSource {
	case "package.json":
		_, name, err := readVersionDocument(resolvePath(cwd, cfg.Package.Path), "package.json")
		if err == nil && name == "" {
			err = fmt.Errorf("package.json selected by project.name_source requires a string name field")
		}
		return name, err
	case "jsr.json":
		_, name, err := readVersionDocument(resolvePath(cwd, cfg.JSR.Path), "jsr.json")
		if err == nil && name == "" {
			err = fmt.Errorf("jsr.json selected by project.name_source requires a string name field")
		}
		return name, err
	default:
		return "", nil
	}
}

func readCurrentVersion(cfg *config.MirrorConfig, cwd, projectName string, runner Runner) (string, error) {
	switch cfg.Version.Source {
	case "package.json":
		version, _, err := readVersionDocument(resolvePath(cwd, cfg.Package.Path), "package.json")
		return version, err
	case "jsr.json":
		version, _, err := readVersionDocument(resolvePath(cwd, cfg.JSR.Path), "jsr.json")
		return version, err
	case "git":
		output, err := runner.Run(cwd, "git", "tag", "--list")
		if err != nil {
			return "", err
		}
		var latest *mastersemver.Version
		for _, tag := range strings.Fields(string(output)) {
			versionText, ok := mirrorsemver.VersionFromTag(cfg.Git.TagTemplate, tag, projectName)
			if !ok {
				continue
			}
			version, _ := mastersemver.StrictNewVersion(versionText)
			if latest == nil || version.GreaterThan(latest) {
				latest = version
			}
		}
		if latest == nil {
			for _, tag := range strings.Fields(string(output)) {
				versionText, ok := versionFromLegacyTag(tag)
				if !ok {
					continue
				}
				version, _ := mastersemver.StrictNewVersion(versionText)
				if latest == nil || version.GreaterThan(latest) {
					latest = version
				}
			}
		}
		if latest == nil {
			return "", fmt.Errorf("%w: no Git tags match template %q or a supported legacy tag shape", errNoGitVersion, cfg.Git.TagTemplate)
		}
		return latest.String(), nil
	default:
		return "", fmt.Errorf("unsupported version source %q", cfg.Version.Source)
	}
}

func gitOnlyOutput(outputs []string) bool {
	return len(outputs) == 1 && outputs[0] == "git"
}

func versionFromLegacyTag(tag string) (string, bool) {
	candidates := []string{tag}
	if strings.HasPrefix(tag, "v") {
		candidates = append(candidates, strings.TrimPrefix(tag, "v"))
	}
	if index := strings.LastIndex(tag, "/v"); index >= 0 {
		candidates = append(candidates, tag[index+2:])
	}
	if index := strings.LastIndex(tag, "@"); index >= 0 {
		candidates = append(candidates, tag[index+1:])
	}
	for _, candidate := range candidates {
		version, err := mastersemver.StrictNewVersion(strings.TrimPrefix(candidate, "v"))
		if err == nil {
			return version.String(), true
		}
	}
	return "", false
}

func readVersionDocument(path, label string) (string, string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", "", fmt.Errorf("read %s %s: %w", label, path, err)
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	var document map[string]any
	if err := decoder.Decode(&document); err != nil {
		return "", "", fmt.Errorf("decode %s %s: %w", label, path, err)
	}
	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		if err == nil {
			return "", "", fmt.Errorf("%s %s contains more than one JSON value", label, path)
		}
		return "", "", fmt.Errorf("decode %s %s: %w", label, path, err)
	}
	version, ok := document["version"].(string)
	if !ok {
		return "", "", fmt.Errorf("%s %s requires a string version field", label, path)
	}
	if _, err := mastersemver.StrictNewVersion(version); err != nil {
		return "", "", fmt.Errorf("%s %s contains invalid semantic version %q", label, path, version)
	}
	name, _ := document["name"].(string)
	if name == "" && label != "" {
		// A name is only required when this document is selected as name_source.
	}
	return version, name, nil
}

func writeVersionDocument(path, label, version string) error {
	_, _, err := readVersionDocument(path, label)
	if err != nil {
		return err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	var document map[string]any
	if err := json.Unmarshal(data, &document); err != nil {
		return err
	}
	document["version"] = version
	rendered, err := json.MarshalIndent(document, "", "  ")
	if err != nil {
		return fmt.Errorf("encode %s %s: %w", label, path, err)
	}
	rendered = append(rendered, '\n')
	return atomicWrite(path, rendered)
}

func atomicWrite(path string, data []byte) error {
	directory := filepath.Dir(path)
	temp, err := os.CreateTemp(directory, "."+filepath.Base(path)+".mirror-*")
	if err != nil {
		return fmt.Errorf("create temporary file for %s: %w", path, err)
	}
	tempPath := temp.Name()
	defer os.Remove(tempPath)
	if _, err := temp.Write(data); err != nil {
		temp.Close()
		return fmt.Errorf("write temporary file for %s: %w", path, err)
	}
	if err := temp.Sync(); err != nil {
		temp.Close()
		return fmt.Errorf("sync temporary file for %s: %w", path, err)
	}
	if err := temp.Close(); err != nil {
		return fmt.Errorf("close temporary file for %s: %w", path, err)
	}
	mode := os.FileMode(0o644)
	if info, err := os.Stat(path); err == nil {
		mode = info.Mode()
	}
	if err := os.Chmod(tempPath, mode); err != nil {
		return fmt.Errorf("set temporary file mode for %s: %w", path, err)
	}
	backup := tempPath + ".backup"
	if _, err := os.Stat(path); err == nil {
		if err := os.Rename(path, backup); err != nil {
			return fmt.Errorf("stage existing %s for replacement: %w", path, err)
		}
	}
	if err := os.Rename(tempPath, path); err != nil {
		_ = os.Rename(backup, path)
		return fmt.Errorf("replace %s: %w", path, err)
	}
	_ = os.Remove(backup)
	return nil
}

func FormatPlanText(plan *VersionPlan) string {
	var output strings.Builder
	if plan.Initial {
		output.WriteString("current: (none)\ninitial: true\n")
	} else {
		fmt.Fprintf(&output, "current: %s\n", plan.CurrentVersion)
	}
	fmt.Fprintf(&output, "next: %s\n", plan.NextVersion)
	fmt.Fprintf(&output, "source: %s\n", plan.Source)
	fmt.Fprintf(&output, "output: %s\n", strings.Join(plan.Output, ", "))
	if plan.ProjectName != "" {
		fmt.Fprintf(&output, "project: %s\n", plan.ProjectName)
	}
	fmt.Fprintf(&output, "config: %s\n", plan.ConfigPath)
	if plan.Tag != "" {
		fmt.Fprintf(&output, "tag: %s\n", plan.Tag)
	}
	output.WriteString("actions:\n")
	for _, action := range plan.Actions {
		switch action.Type {
		case "write-file":
			fmt.Fprintf(&output, "- write %s %s: %s -> %s\n", action.Adapter, action.Path, action.CurrentVersion, action.NextVersion)
		case "git-commit":
			fmt.Fprintf(&output, "- commit %s\n", action.Message)
		case "git-tag":
			fmt.Fprintf(&output, "- tag %s\n", action.Tag)
		case "git-push":
			fmt.Fprintf(&output, "- push commit=%t exact_tag=%t\n", action.IncludeCommit, action.IncludeTags)
		}
	}
	if plan.Applied {
		output.WriteString("applied: true\n")
	}
	if len(plan.HookResults) > 0 {
		output.WriteString("hooks:\n")
		for _, result := range plan.HookResults {
			fmt.Fprintf(&output, "- %s[%d] %s exit=%s duration_ms=%d\n",
				result.Event, result.Index, result.Status, formatHookExitCode(result.ExitCode), result.DurationMS)
		}
	}
	return output.String()
}

func formatHookExitCode(exitCode *int) string {
	if exitCode == nil {
		return "-"
	}
	return strconv.Itoa(*exitCode)
}

func resolvePath(cwd, path string) string {
	if filepath.IsAbs(path) {
		return filepath.Clean(path)
	}
	return filepath.Join(cwd, path)
}

func appendUnique(values []string, value string) []string {
	for _, existing := range values {
		if existing == value {
			return values
		}
	}
	return append(values, value)
}

func releaseLabel(version, projectName string) string {
	if projectName == "" {
		return "v" + version
	}
	return projectName + "@" + version
}

func usesGit(cfg *config.MirrorConfig) bool {
	if cfg.Version.Source == "git" {
		return true
	}
	for _, output := range cfg.Version.Output {
		if output == "git" {
			return true
		}
	}
	return false
}

func planUsesGit(plan *VersionPlan) bool {
	for _, action := range plan.Actions {
		if strings.HasPrefix(action.Type, "git-") {
			return true
		}
	}
	return plan.Source == "git"
}
