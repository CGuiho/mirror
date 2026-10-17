package cmd

import (
	"fmt"
	"os"
	"regexp"
	"runtime"
	"strings"
	"time"

	"github.com/CGuiho/mirror/pkg/update"
	"github.com/spf13/cobra"
)

const (
	ansiReset = "\x1b[0m"
	ansiBold  = "\x1b[1m"
	ansiDim   = "\x1b[2m"
	// Palette from user: 001524, 15616D, FFECD1, FF7D00, 78290F — truecolor
	ansiNavy   = "\x1b[38;2;0;21;36m"
	ansiTeal   = "\x1b[38;2;21;97;109m"
	ansiCream  = "\x1b[38;2;255;236;209m"
	ansiOrange = "\x1b[38;2;255;125;0m"
	ansiBrown  = "\x1b[38;2;120;41;15m"
	// Legacy aliases mapped to palette for compatibility
	ansiPink   = ansiOrange
	ansiCyan   = ansiTeal
	ansiGreen  = ansiTeal
	ansiYellow = ansiOrange
	ansiGray   = ansiCream + ansiDim // muted cream for secondary text

	// ansiAccent is Mirror's primary brand colour, used for the GUIHO
	// attribution, the version and the website in the Author detail.
	ansiAccent = ansiOrange + ansiBold
)

var helloPlatformLabels = map[string]string{
	"darwin":  "macOS",
	"linux":   "Linux",
	"windows": "Windows",
	"win32":   "Windows",
}

var helloArchLabels = map[string]string{
	"amd64": "x64",
	"386":   "x86",
	"arm64": "arm64",
	"arm":   "arm",
}

// mirrorLogo is the ANSI Shadow rendering of "MIRROR" (6 letters, 6 rows).
var mirrorLogo = []string{
	"███╗   ███╗██╗██████╗ ██████╗  ██████╗ ██████╗ ",
	"████╗ ████║██║██╔══██╗██╔══██╗██╔═══██╗██╔══██╗",
	"██╔████╔██║██║██████╔╝██████╔╝██║   ██║██████╔╝",
	"██║╚██╔╝██║██║██╔══██╗██╔══██╗██║   ██║██╔══██╗",
	"██║ ╚═╝ ██║██║██║  ██║██║  ██║╚██████╔╝██║  ██║",
	"╚═╝     ╚═╝╚═╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝",
}

func helloUseColor(command *cobra.Command, deps Dependencies) bool {
	if v, err := command.Flags().GetBool("color"); err == nil && v {
		return true
	}
	if os.Getenv("NO_COLOR") != "" {
		return false
	}
	if os.Getenv("TERM") == "dumb" {
		return false
	}
	return deps.IsTerminal()
}

func colorize(enabled bool, s, code string) string {
	if !enabled || code == "" {
		return s
	}
	return code + s + ansiReset
}

func latestAvailable(currentVersion string, now time.Time) (string, bool) {
	cache, err := update.LoadCache("")
	if err != nil || cache == nil {
		return "", false
	}
	if update.IsExpiredAt(cache, update.CacheMaxAge, now) {
		return "", false
	}
	if !cache.UpdateAvailable {
		return "", false
	}
	if update.CompareVersions(cache.LatestVersion, currentVersion) <= 0 {
		return "", false
	}
	return cache.LatestVersion, true
}

// RenderHello returns the complete left-aligned hello window as a string,
// framed by exactly one leading and one trailing blank line. The caller is
// responsible for writing it.
func RenderHello(info BuildInfo, latestVersion string, hasUpdate bool, useColor bool) string {
	return renderHello(runtime.GOOS, runtime.GOARCH, info.Version, useColor)
}

func renderHello(goos, goarch, version string, useColor bool) string {
	platform := helloPlatformLabels[goos]
	if platform == "" {
		platform = goos
	}
	architecture := helloArchLabels[goarch]
	if architecture == "" {
		architecture = goarch
	}
	version = strings.TrimPrefix(strings.TrimSpace(version), "v")

	tagline := "Deterministic semantic versioning"
	logoColor := ansiOrange + ansiBold
	taglineColor := ansiCream + ansiDim

	var b strings.Builder
	// One blank line before, so the hello never touches the prompt line
	b.WriteString("\n")

	// Logo rows flush left — palette: FF7D00 orange on dark bg
	for _, line := range mirrorLogo {
		b.WriteString(colorize(useColor, line, logoColor))
		b.WriteString("\n")
	}
	// Tagline flush left below logo — palette: FFECD1 cream dimmed
	b.WriteString(colorize(useColor, tagline, taglineColor))
	b.WriteString("\n")
	b.WriteString(colorize(useColor, "GUIHO \u00b7 Crist\u00f3v\u00e3o GUIHO", ansiAccent))
	b.WriteString("\n\n")

	// Details — platform, version, author
	writeHelloDetail(&b, useColor, "Platform", colorize(useColor, platform+" "+architecture, ansiCream))
	writeHelloDetail(&b, useColor, "Version", colorize(useColor, "v"+version, ansiAccent))
	writeHelloDetail(&b, useColor, "Author",
		colorize(useColor, "GUIHO (", ansiCream)+
			colorize(useColor, "www.guiho.co", ansiAccent)+
			colorize(useColor, ")", ansiCream))
	b.WriteString("\n")

	// Help hint
	b.WriteString("Run ")
	b.WriteString(colorize(useColor, "mirror --help", ansiCyan+ansiBold))
	b.WriteString(" to see available commands.")
	b.WriteString("\n")
	// One blank line after, so the hello never touches the next prompt
	b.WriteString("\n")

	return b.String()
}

// detailLabelWidth fits the longest detail label ("Platform") so values align.
const detailLabelWidth = 8

// writeHelloDetail writes one left-aligned detail row; value is already
// colorized by the caller when colour is enabled.
func writeHelloDetail(b *strings.Builder, useColor bool, label, value string) {
	padded := colorize(useColor, fmt.Sprintf("%-*s", detailLabelWidth, label), ansiGray)
	fmt.Fprintf(b, "%s  %s\n", padded, value)
}

func writeHello(deps Dependencies, command *cobra.Command, info BuildInfo) error {
	useColor := helloUseColor(command, deps)
	// Derive update state from the same cached-notice path that drives the
	// generic stderr notice. This keeps hello in sync with that contract and
	// keeps tests mockable via deps.ReadUpdateNotice.
	notice := deps.ReadUpdateNotice(info.Version, deps.Now())
	latest, hasUpdate := "", false
	if notice != "" {
		hasUpdate = true
		if c, err := update.LoadCache(""); err == nil && c != nil && c.LatestVersion != "" && c.UpdateAvailable && update.CompareVersions(c.LatestVersion, info.Version) > 0 {
			latest = c.LatestVersion
		} else {
			latest = extractVersionFromNotice(notice)
		}
		if latest == "" {
			// Generic notice without a parseable version — show a banner without a
			// specific version number rather than dropping the notice entirely.
			latest = ""
		}
	} else {
		latest, hasUpdate = latestAvailable(info.Version, deps.Now())
	}
	text := RenderHello(info, "", false, useColor)
	// The hello window carries its own one-blank-line framing.
	if _, err := fmt.Fprint(deps.Out, text); err != nil {
		return err
	}
	if hasUpdate {
		if latest != "" {
			fmt.Fprintf(deps.Err, "⚠ New version available: v%s\n  run mirror upgrade to update\n", latest)
		} else {
			fmt.Fprintln(deps.Err, "⚠ New version available")
			fmt.Fprintln(deps.Err, "  run mirror upgrade to update")
		}
	}
	return nil
}

var versionInNotice = regexp.MustCompile(`v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?`)

func extractVersionFromNotice(notice string) string {
	match := versionInNotice.FindString(notice)
	if match == "" {
		return ""
	}
	return strings.TrimPrefix(match, "v")
}
