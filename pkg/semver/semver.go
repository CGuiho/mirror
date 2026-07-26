/**
 * @copyright Copyright © 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

package semver

import (
	"fmt"
	"os/exec"
	"regexp"
	"sort"
	"strconv"
	"strings"

	sv "github.com/Masterminds/semver/v3"
)

var supportedTargets = map[string]struct{}{
	"major": {}, "premajor": {}, "minor": {}, "preminor": {},
	"patch": {}, "prepatch": {}, "prerelease": {},
}

func Bump(current, target, prereleaseID string) (string, error) {
	cur, err := sv.StrictNewVersion(strings.TrimPrefix(current, "v"))
	if err != nil {
		return "", fmt.Errorf("invalid current version %q: %w", current, err)
	}
	if prereleaseID != "" && !validPrereleaseIdentifier(prereleaseID) {
		return "", fmt.Errorf("invalid prerelease identifier %q", prereleaseID)
	}

	var next sv.Version
	switch target {
	case "major":
		next = cur.IncMajor()
	case "premajor":
		next = withPrerelease(cur.IncMajor(), prereleaseID)
	case "minor":
		next = cur.IncMinor()
	case "preminor":
		next = withPrerelease(cur.IncMinor(), prereleaseID)
	case "patch":
		next = cur.IncPatch()
	case "prepatch":
		next = withPrerelease(cur.IncPatch(), prereleaseID)
	case "prerelease":
		return incrementPrerelease(cur, prereleaseID)
	default:
		exact, err := sv.StrictNewVersion(strings.TrimPrefix(target, "v"))
		if err != nil {
			return "", fmt.Errorf("invalid version target %q: %w", target, err)
		}
		return exact.String(), nil
	}
	return next.String(), nil
}

func withPrerelease(base sv.Version, prereleaseID string) sv.Version {
	pre := "0"
	if prereleaseID != "" {
		pre = prereleaseID + ".0"
	}
	next, _ := base.SetPrerelease(pre)
	return next
}

func incrementPrerelease(current *sv.Version, prereleaseID string) (string, error) {
	if current.Prerelease() == "" {
		return withPrerelease(current.IncPatch(), prereleaseID).String(), nil
	}

	parts := strings.Split(current.Prerelease(), ".")
	if prereleaseID != "" && parts[0] != prereleaseID {
		parts = []string{prereleaseID, "0"}
	} else {
		incremented := false
		for index := len(parts) - 1; index >= 0; index-- {
			number, err := strconv.ParseUint(parts[index], 10, 64)
			if err != nil {
				continue
			}
			parts[index] = strconv.FormatUint(number+1, 10)
			incremented = true
			break
		}
		if !incremented {
			parts = append(parts, "0")
		}
	}

	base, _ := current.SetPrerelease("")
	next, err := base.SetPrerelease(strings.Join(parts, "."))
	if err != nil {
		return "", fmt.Errorf("calculate prerelease from %s: %w", current, err)
	}
	return next.String(), nil
}

func RenderTag(template, name, version string) (string, error) {
	if template != "v{version}" && template != "{name}@{version}" && template != "{name}/v{version}" {
		return "", fmt.Errorf("unsupported Git tag template %q", template)
	}
	parsed, err := sv.StrictNewVersion(strings.TrimPrefix(version, "v"))
	if err != nil {
		return "", fmt.Errorf("invalid Git tag version %q: %w", version, err)
	}
	if strings.Contains(template, "{name}") && strings.TrimSpace(name) == "" {
		return "", fmt.Errorf("Git tag template %q requires a project name", template)
	}
	tag := strings.ReplaceAll(template, "{name}", name)
	tag = strings.ReplaceAll(tag, "{version}", parsed.String())
	return tag, nil
}

// FormatTag is the compatibility form of RenderTag for callers with validated data.
func FormatTag(template, name, version string) string {
	tag, _ := RenderTag(template, name, version)
	return tag
}

func VersionFromTag(template, tag, projectName string) (string, bool) {
	if template != "v{version}" && template != "{name}@{version}" && template != "{name}/v{version}" {
		return "", false
	}
	if strings.Contains(template, "{name}") && projectName == "" {
		return "", false
	}
	pattern := regexp.QuoteMeta(template)
	pattern = strings.ReplaceAll(pattern, regexp.QuoteMeta("{name}"), regexp.QuoteMeta(projectName))
	pattern = strings.ReplaceAll(pattern, regexp.QuoteMeta("{version}"), `(?P<version>[^/]+)`)
	match := regexp.MustCompile("^" + pattern + "$").FindStringSubmatch(tag)
	if match == nil {
		return "", false
	}
	versionIndex := regexp.MustCompile("^" + pattern + "$").SubexpIndex("version")
	if versionIndex < 0 {
		return "", false
	}
	version, err := sv.StrictNewVersion(match[versionIndex])
	if err != nil {
		return "", false
	}
	return version.String(), true
}

func ReadVersionFromGit(cwd, tagTemplate, projectName string) (string, error) {
	command := exec.Command("git", "tag", "--list")
	command.Dir = cwd
	output, err := command.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("list Git tags: %w: %s", err, strings.TrimSpace(string(output)))
	}

	var versions []*sv.Version
	for _, tag := range strings.Fields(string(output)) {
		versionText, ok := VersionFromTag(tagTemplate, tag, projectName)
		if !ok {
			continue
		}
		version, _ := sv.StrictNewVersion(versionText)
		versions = append(versions, version)
	}
	if len(versions) == 0 {
		return "", fmt.Errorf("no Git tags match template %q", tagTemplate)
	}
	sort.Sort(sort.Reverse(sv.Collection(versions)))
	return versions[0].String(), nil
}

func IsSupportedTarget(target string) bool {
	if _, ok := supportedTargets[target]; ok {
		return true
	}
	_, err := sv.StrictNewVersion(strings.TrimPrefix(target, "v"))
	return err == nil
}

func validPrereleaseIdentifier(identifier string) bool {
	return regexp.MustCompile(`^[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*$`).MatchString(identifier)
}
