package cmd

import (
	"fmt"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/CGuiho/mirror/pkg/update"
	"github.com/spf13/cobra"
)

const (
	ansiReset  = "\x1b[0m"
	ansiBold   = "\x1b[1m"
	ansiDim    = "\x1b[2m"
	ansiOrange = "\x1b[38;5;208m"
	ansiPink   = "\x1b[38;5;204m"
	ansiCyan   = "\x1b[36m"
	ansiGreen  = "\x1b[32m"
	ansiYellow = "\x1b[33m"
	ansiGray   = "\x1b[90m"
)

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

// RenderHello returns the complete hello window as a string, without a
// trailing newline. The caller is responsible for writing it.
func RenderHello(info BuildInfo, latestVersion string, hasUpdate bool, useColor bool) string {
	var b strings.Builder

	// Determine box width: widest logo line + 4 spaces padding (2 each side)
	innerWidth := 0
	for _, line := range mirrorLogo {
		// logo lines contain only block characters counted as width 1 each in
		// monospace. Use rune count (all single-width in this alphabet).
		if l := len([]rune(line)); l > innerWidth {
			innerWidth = l
		}
	}
	// Add 4 for "  " padding on each side
	innerWidth += 4
	// Tagline inside box must fit; guarantee at least 52.
	if innerWidth < 56 {
		innerWidth = 56
	}

	tagline := "Deterministic semantic versioning"
	borderColor := ansiOrange
	logoColor := ansiPink

	// Top border
	b.WriteString(colorize(useColor, "╭"+strings.Repeat("─", innerWidth)+"╮", borderColor))
	b.WriteString("\n")
	// Empty line
	b.WriteString(colorize(useColor, "│"+strings.Repeat(" ", innerWidth)+"│", borderColor))
	b.WriteString("\n")
	// Logo lines centered
	for _, line := range mirrorLogo {
		lineRunes := []rune(line)
		lineLen := len(lineRunes)
		totalPad := innerWidth - lineLen
		left := totalPad / 2
		right := totalPad - left
		inner := strings.Repeat(" ", left) + line + strings.Repeat(" ", right)
		b.WriteString(colorize(useColor, "│", borderColor))
		b.WriteString(colorize(useColor, inner, logoColor))
		b.WriteString(colorize(useColor, "│", borderColor))
		b.WriteString("\n")
	}
	// Empty line between logo and tagline
	b.WriteString(colorize(useColor, "│"+strings.Repeat(" ", innerWidth)+"│", borderColor))
	b.WriteString("\n")
	// Tagline centered
	tagPad := innerWidth - len([]rune(tagline))
	left := tagPad / 2
	right := tagPad - left
	tagInner := strings.Repeat(" ", left) + tagline + strings.Repeat(" ", right)
	b.WriteString(colorize(useColor, "│", borderColor))
	b.WriteString(colorize(useColor, tagInner, ansiDim))
	b.WriteString(colorize(useColor, "│", borderColor))
	b.WriteString("\n")
	// Empty line
	b.WriteString(colorize(useColor, "│"+strings.Repeat(" ", innerWidth)+"│", borderColor))
	b.WriteString("\n")
	// Bottom border
	b.WriteString(colorize(useColor, "╰"+strings.Repeat("─", innerWidth)+"╯", borderColor))

	// ── Metadata outside the box ─────────────────────────────
	// Blank line after box
	b.WriteString("\n\n")
	b.WriteString(colorize(useColor, "GUIHO", ansiYellow+ansiBold))
	b.WriteString(colorize(useColor, "  —  Deterministic semantic versioning  —  Go/Cobra Powered", ansiGray))
	b.WriteString("\n\n")

	// Creator
	b.WriteString(colorize(useColor, fmt.Sprintf("%-9s", "Creator"), ansiGray))
	b.WriteString("  ")
	b.WriteString(colorize(useColor, "Cristóvão GUIHO", ansiCyan+ansiBold))
	b.WriteString("\n")

	// Version
	versionLabel := colorize(useColor, fmt.Sprintf("%-9s", "version"), ansiGray)
	versionValue := colorize(useColor, "v"+info.Version, ansiGreen+ansiBold)
	b.WriteString(fmt.Sprintf("%s  %s\n", versionLabel, versionValue))
	b.WriteString("\n")

	// Help hint
	b.WriteString("Run ")
	b.WriteString(colorize(useColor, "mirror --help", ansiCyan+ansiBold))
	b.WriteString(" to see available commands.")

	// Update notice (inside the hello window, not stderr)
	if hasUpdate {
		b.WriteString("\n\n")
		if latestVersion != "" {
			b.WriteString(colorize(useColor, "▲  New version available: v"+latestVersion, ansiYellow+ansiBold))
		} else {
			b.WriteString(colorize(useColor, "▲  New version available", ansiYellow+ansiBold))
		}
		b.WriteString("\n")
		b.WriteString(colorize(useColor, "   run ", ansiGray))
		b.WriteString(colorize(useColor, "mirror upgrade", ansiCyan+ansiBold))
		b.WriteString(colorize(useColor, " to update", ansiGray))
	}

	return b.String()
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
	text := RenderHello(info, latest, hasUpdate, useColor)
	_, err := fmt.Fprintln(deps.Out, text)
	return err
}

var versionInNotice = regexp.MustCompile(`v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?`)

func extractVersionFromNotice(notice string) string {
	match := versionInNotice.FindString(notice)
	if match == "" {
		return ""
	}
	return strings.TrimPrefix(match, "v")
}
