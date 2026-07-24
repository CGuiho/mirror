/**
 * @copyright Copyright © 2026 GUIHO Technologies as represented by Cristóvão GUIHO. All Rights Reserved.
 */

package semver

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBumpMajor(t *testing.T) {
	next, err := Bump("1.2.3", "major", "")
	require.NoError(t, err)
	assert.Equal(t, "2.0.0", next)
}

func TestBumpMinor(t *testing.T) {
	next, err := Bump("1.2.3", "minor", "")
	require.NoError(t, err)
	assert.Equal(t, "1.3.0", next)
}

func TestBumpPatch(t *testing.T) {
	next, err := Bump("1.2.3", "patch", "")
	require.NoError(t, err)
	assert.Equal(t, "1.2.4", next)
}

func TestBumpPremajor(t *testing.T) {
	next, err := Bump("1.2.3", "premajor", "alpha")
	require.NoError(t, err)
	assert.Equal(t, "2.0.0-alpha.0", next)
}

func TestBumpPreminor(t *testing.T) {
	next, err := Bump("1.2.3", "preminor", "beta")
	require.NoError(t, err)
	assert.Equal(t, "1.3.0-beta.0", next)
}

func TestBumpPrepatch(t *testing.T) {
	next, err := Bump("1.2.3", "prepatch", "rc")
	require.NoError(t, err)
	assert.Equal(t, "1.2.4-rc.0", next)
}

func TestBumpPrerelease(t *testing.T) {
	next, err := Bump("1.2.3-alpha.0", "prerelease", "")
	require.NoError(t, err)
	assert.Equal(t, "1.2.3-alpha.1", next)
}

func TestBumpPrereleaseFromStable(t *testing.T) {
	next, err := Bump("1.2.3", "prerelease", "alpha")
	require.NoError(t, err)
	assert.Equal(t, "1.2.4-alpha.0", next)
}

func TestBumpExactVersion(t *testing.T) {
	next, err := Bump("1.2.3", "4.0.0", "")
	require.NoError(t, err)
	assert.Equal(t, "4.0.0", next)
}

func TestBumpInvalidCurrent(t *testing.T) {
	_, err := Bump("not-a-version", "major", "")
	assert.Error(t, err)
}

func TestBumpInvalidTarget(t *testing.T) {
	_, err := Bump("1.2.3", "not-valid-semver-target-xyz", "")
	assert.Error(t, err)
}

func TestFormatTag(t *testing.T) {
	tag := FormatTag("{name}/v{version}", "@guiho/mirror", "1.0.0")
	assert.Equal(t, "@guiho/mirror/v1.0.0", tag)
}

func TestFormatTagSimple(t *testing.T) {
	tag := FormatTag("v{version}", "", "2.0.0")
	assert.Equal(t, "v2.0.0", tag)
}

func TestBumpWithVPrefix(t *testing.T) {
	next, err := Bump("v1.2.3", "patch", "")
	require.NoError(t, err)
	assert.Equal(t, "1.2.4", next)
}
