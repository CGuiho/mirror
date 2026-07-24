/**
 * @copyright Copyright © 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

package semver

import (
	"fmt"
	"os/exec"
	"regexp"
	"sort"
	"strings"

	sv "github.com/Masterminds/semver/v3"
)

// Bump calculates the next version from the current version and target.
// Target can be: major, premajor, minor, preminor, patch, prepatch, prerelease, or an exact version string.
func Bump(current string, target string, prereleaseID string) (string, error) {
	cur, err := sv.NewVersion(strings.TrimPrefix(current, "v"))
	if err != nil {
		return "", fmt.Errorf("invalid current version %q: %w", current, err)
	}

	switch target {
	case "major":
		next := cur.IncMajor()
		return next.String(), nil
	case "premajor":
		next := cur.IncMajor()
		pre, _ := sv.NewVersion(fmt.Sprintf("%s-0", next.String()))
		if prereleaseID != "" {
			pre, _ = sv.NewVersion(fmt.Sprintf("%s-%s.0", next.String(), prereleaseID))
		}
		return pre.String(), nil
	case "minor":
		next := cur.IncMinor()
		return next.String(), nil
	case "preminor":
		next := cur.IncMinor()
		pre, _ := sv.NewVersion(fmt.Sprintf("%s-0", next.String()))
		if prereleaseID != "" {
			pre, _ = sv.NewVersion(fmt.Sprintf("%s-%s.0", next.String(), prereleaseID))
		}
		return pre.String(), nil
	case "patch":
		next := cur.IncPatch()
		return next.String(), nil
	case "prepatch":
		next := cur.IncPatch()
		pre, _ := sv.NewVersion(fmt.Sprintf("%s-0", next.String()))
		if prereleaseID != "" {
			pre, _ = sv.NewVersion(fmt.Sprintf("%s-%s.0", next.String(), prereleaseID))
		}
		return pre.String(), nil
	case "prerelease":
		pre := cur.Prerelease()
		if pre == "" {
			next := cur.IncPatch()
			p, _ := sv.NewVersion(fmt.Sprintf("%s-0", next.String()))
			if prereleaseID != "" {
				p, _ = sv.NewVersion(fmt.Sprintf("%s-%s.0", next.String(), prereleaseID))
			}
			return p.String(), nil
		}
		// Increment the last numeric segment of the prerelease
		parts := strings.Split(pre, ".")
		for i := len(parts) - 1; i >= 0; i-- {
			if n := parseNumber(parts[i]); n >= 0 {
				parts[i] = fmt.Sprintf("%d", n+1)
				break
			}
		}
		base := fmt.Sprintf("%d.%d.%d", cur.Major(), cur.Minor(), cur.Patch())
		p, _ := sv.NewVersion(fmt.Sprintf("%s-%s", base, strings.Join(parts, ".")))
		return p.String(), nil
	default:
		// Exact version target
		next, err := sv.NewVersion(strings.TrimPrefix(target, "v"))
		if err != nil {
			return "", fmt.Errorf("invalid version target %q: %w", target, err)
		}
		return next.String(), nil
	}
}

// FormatTag formats a version string using a tag template.
// Template variables: {name}, {version}
func FormatTag(template string, name string, version string) string {
	tag := strings.ReplaceAll(template, "{name}", name)
	tag = strings.ReplaceAll(tag, "{version}", version)
	return tag
}

// ReadVersionFromGit reads the latest semver tag from the Git repository at the given cwd.
func ReadVersionFromGit(cwd string, tagTemplate string, projectName string) (string, error) {
	cmd := exec.Command("git", "tag", "--list", "--sort=-v:refname")
	cmd.Dir = cwd
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("failed to list git tags: %w\n%s", err, string(out))
	}

	tags := strings.Split(strings.TrimSpace(string(out)), "\n")
	semverRegex := regexp.MustCompile(`v?(\d+\.\d+\.\d+.*)`)

	// Build expected prefix from template
	prefix := ""
	if tagTemplate != "" && projectName != "" {
		// e.g., template "{name}/v{version}" + name "@guiho/mirror" → prefix "@guiho/mirror/v"
		prefix = strings.ReplaceAll(tagTemplate, "{version}", "")
		prefix = strings.ReplaceAll(prefix, "{name}", projectName)
	}

	var versions []*sv.Version
	for _, tag := range tags {
		tag = strings.TrimSpace(tag)
		if tag == "" {
			continue
		}

		versionStr := tag
		if prefix != "" && strings.HasPrefix(tag, prefix) {
			versionStr = strings.TrimPrefix(tag, prefix)
		} else if prefix != "" {
			continue
		}

		matches := semverRegex.FindStringSubmatch(versionStr)
		if len(matches) < 2 {
			continue
		}
		v, err := sv.NewVersion(matches[1])
		if err == nil {
			versions = append(versions, v)
		}
	}

	if len(versions) == 0 {
		return "0.0.0", nil
	}

	sort.Sort(sort.Reverse(sv.Collection(versions)))
	return versions[0].String(), nil
}

func parseNumber(s string) int {
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return -1
		}
		n = n*10 + int(c-'0')
	}
	return n
}
