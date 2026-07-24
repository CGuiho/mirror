/**
 * @copyright Copyright © 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

package versioning

import (
	"fmt"
	"os/exec"
	"strings"

	"github.com/CGuiho/mirror/pkg/config"
	"github.com/CGuiho/mirror/pkg/semver"
)

// VersionPlanAction represents a single mutation in a version plan.
type VersionPlanAction struct {
	Type           string `json:"type"`
	Adapter        string `json:"adapter,omitempty"`
	Path           string `json:"path,omitempty"`
	CurrentVersion string `json:"current_version,omitempty"`
	NextVersion    string `json:"next_version,omitempty"`
	Message        string `json:"message,omitempty"`
	Tag            string `json:"tag,omitempty"`
	IncludeCommit  bool   `json:"include_commit,omitempty"`
	IncludeTags    bool   `json:"include_tags,omitempty"`
}

// VersionPlan is the computed plan for a version bump.
type VersionPlan struct {
	CurrentVersion string              `json:"current"`
	NextVersion    string              `json:"next"`
	Source         string              `json:"source"`
	Output         []string            `json:"output"`
	ProjectName    string              `json:"project"`
	ConfigPath     string              `json:"config"`
	Tag            string              `json:"tag,omitempty"`
	Actions        []VersionPlanAction `json:"actions"`
	DryRun         bool                `json:"dry_run,omitempty"`
	Applied        bool                `json:"applied,omitempty"`
}

// BuildPlan creates a version plan from configuration and target.
func BuildPlan(cfg *config.MirrorConfig, cfgPath string, target string, cwd string) (*VersionPlan, error) {
	currentVersion, err := readCurrentVersion(cfg, cwd)
	if err != nil {
		return nil, fmt.Errorf("failed to read current version: %w", err)
	}

	nextVersion, err := semver.Bump(currentVersion, target, cfg.Version.PrereleaseID)
	if err != nil {
		return nil, fmt.Errorf("failed to calculate next version: %w", err)
	}

	projectName := cfg.Project.Name
	tag := semver.FormatTag(cfg.Git.TagTemplate, projectName, nextVersion)

	plan := &VersionPlan{
		CurrentVersion: currentVersion,
		NextVersion:    nextVersion,
		Source:         cfg.Version.Source,
		Output:         cfg.Version.Output,
		ProjectName:    projectName,
		ConfigPath:     cfgPath,
		Tag:            tag,
	}

	// Build actions
	for _, output := range cfg.Version.Output {
		switch output {
		case "package.json":
			plan.Actions = append(plan.Actions, VersionPlanAction{
				Type:           "write-file",
				Adapter:        "package.json",
				Path:           cfg.Package.Path,
				CurrentVersion: currentVersion,
				NextVersion:    nextVersion,
			})
		case "jsr.json":
			plan.Actions = append(plan.Actions, VersionPlanAction{
				Type:           "write-file",
				Adapter:        "jsr.json",
				Path:           cfg.Jsr.Path,
				CurrentVersion: currentVersion,
				NextVersion:    nextVersion,
			})
		case "git":
			// Git tag action
			plan.Actions = append(plan.Actions, VersionPlanAction{
				Type: "git-tag",
				Tag:  tag,
			})
		}
	}

	// Add commit if any file outputs exist and commit is enabled
	hasFileOutputs := false
	for _, o := range cfg.Version.Output {
		if o == "package.json" || o == "jsr.json" {
			hasFileOutputs = true
			break
		}
	}
	if hasFileOutputs && cfg.Git.Commit {
		commitMsg := fmt.Sprintf("%s@%s", projectName, nextVersion)
		plan.Actions = append(plan.Actions, VersionPlanAction{
			Type:    "git-commit",
			Message: commitMsg,
		})
	}

	// Add push if enabled
	if cfg.Git.Push {
		plan.Actions = append(plan.Actions, VersionPlanAction{
			Type:          "git-push",
			IncludeCommit: hasFileOutputs && cfg.Git.Commit,
			IncludeTags:   true,
		})
	}

	return plan, nil
}

// ApplyPlan executes a version plan.
func ApplyPlan(plan *VersionPlan, cwd string) error {
	for _, action := range plan.Actions {
		switch action.Type {
		case "git-tag":
			cmd := exec.Command("git", "tag", action.Tag)
			cmd.Dir = cwd
			if out, err := cmd.CombinedOutput(); err != nil {
				return fmt.Errorf("failed to create git tag %s: %w\n%s", action.Tag, err, string(out))
			}
		case "git-push":
			args := []string{"push", "origin"}
			if action.IncludeTags {
				args = append(args, "--tags")
			}
			cmd := exec.Command("git", args...)
			cmd.Dir = cwd
			if out, err := cmd.CombinedOutput(); err != nil {
				return fmt.Errorf("failed to push: %w\n%s", err, string(out))
			}
		}
	}
	plan.Applied = true
	return nil
}

func readCurrentVersion(cfg *config.MirrorConfig, cwd string) (string, error) {
	switch cfg.Version.Source {
	case "git":
		return semver.ReadVersionFromGit(cwd, cfg.Git.TagTemplate, cfg.Project.Name)
	default:
		return "", fmt.Errorf("unsupported version source: %s (only 'git' is supported in Go build)", cfg.Version.Source)
	}
}

// FormatPlanText renders a human-readable plan summary.
func FormatPlanText(plan *VersionPlan) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("current: %s\n", plan.CurrentVersion))
	sb.WriteString(fmt.Sprintf("next: %s\n", plan.NextVersion))
	sb.WriteString(fmt.Sprintf("source: %s\n", plan.Source))
	sb.WriteString(fmt.Sprintf("output: %s\n", strings.Join(plan.Output, ", ")))
	sb.WriteString(fmt.Sprintf("project: %s\n", plan.ProjectName))
	sb.WriteString(fmt.Sprintf("config: %s\n", plan.ConfigPath))
	if plan.Tag != "" {
		sb.WriteString(fmt.Sprintf("tag: %s\n", plan.Tag))
	}
	sb.WriteString("actions:\n")
	for _, action := range plan.Actions {
		switch action.Type {
		case "write-file":
			sb.WriteString(fmt.Sprintf("- write %s: %s -> %s\n", action.Adapter, action.CurrentVersion, action.NextVersion))
		case "git-commit":
			sb.WriteString(fmt.Sprintf("- commit %s\n", action.Message))
		case "git-tag":
			sb.WriteString(fmt.Sprintf("- tag %s\n", action.Tag))
		case "git-push":
			sb.WriteString(fmt.Sprintf("- push commit=%v tags=%v\n", action.IncludeCommit, action.IncludeTags))
		}
	}
	if plan.Applied {
		sb.WriteString(fmt.Sprintf("applied: %v\n", plan.Applied))
		sb.WriteString(fmt.Sprintf("version: %s\n", plan.NextVersion))
		sb.WriteString(fmt.Sprintf("tag: %s\n", plan.Tag))
	}
	return sb.String()
}
