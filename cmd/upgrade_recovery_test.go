package cmd

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/CGuiho/mirror/pkg/updater"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

func TestUpgradeRecoveryCommandIsPlatformSpecific(t *testing.T) {
	command := upgradeRecoveryCommand("4.2.6")
	if runtime.GOOS == "windows" {
		if !strings.Contains(command, "powershell.exe") || !strings.Contains(command, "-Version '4.2.6'") || strings.Contains(command, "curl ") {
			t.Fatalf("unexpected Windows recovery command: %s", command)
		}
	} else if !strings.HasPrefix(command, "curl -fsSL ") || !strings.Contains(command, "--version 4.2.6") || strings.Contains(command, "powershell") {
		t.Fatalf("unexpected Unix recovery command: %s", command)
	}
	defaultCommand := upgradeRecoveryCommand("")
	if strings.Contains(defaultCommand, "4.2.6") || strings.Contains(defaultCommand, "--version") || strings.Contains(defaultCommand, "-Version") {
		t.Fatalf("default recovery command must retain latest-stable selection: %s", defaultCommand)
	}
}

func TestUpgradeUpToDatePrintsRecoveryBeforeAndAfter(t *testing.T) {
	stdout := &bytes.Buffer{}
	deps := testDependenciesAt(t.TempDir(), stdout, &bytes.Buffer{})
	asset := updater.GetCurrentTargetAssetName()
	deps.HTTPClient = &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		body := fmt.Sprintf(`[{"tag_name":"mirror/v4.2.5","assets":[{"name":%q,"browser_download_url":"https://example.invalid/%s"},{"name":"checksums.txt","browser_download_url":"https://example.invalid/checksums.txt"}]}]`, asset, asset)
		return &http.Response{
			StatusCode: http.StatusOK,
			Status:     "200 OK",
			Header:     make(http.Header),
			Body:       io.NopCloser(strings.NewReader(body)),
			Request:    request,
		}, nil
	})}
	err := ExecuteContext(context.Background(), deps, BuildInfo{Version: "4.2.5", Target: asset}, []string{"upgrade"})
	if err != nil {
		t.Fatal(err)
	}
	block := "If the upgrade fails, reinstall Mirror with this command:\n" + upgradeRecoveryCommand("4.2.5") + "\n"
	if strings.Count(stdout.String(), "If the upgrade fails, reinstall Mirror with this command:\n") != 2 {
		t.Fatalf("expected two recovery blocks:\n%s", stdout.String())
	}
	if !strings.HasSuffix(stdout.String(), block) || !strings.Contains(stdout.String(), "already up to date at 4.2.5") {
		t.Fatalf("unexpected up-to-date output:\n%s", stdout.String())
	}
}

func TestUpgradePrintsRecoveryBeforeNetworkAndAfterFailure(t *testing.T) {
	stdout := &bytes.Buffer{}
	stderr := &bytes.Buffer{}
	deps := testDependenciesAt(t.TempDir(), stdout, stderr)
	deps.ReadUpdateNotice = func(string, time.Time) string { return "unexpected update notice\n" }
	deps.HTTPClient = &http.Client{Transport: roundTripFunc(func(*http.Request) (*http.Response, error) {
		if !strings.HasPrefix(stdout.String(), "If the upgrade fails, reinstall Mirror with this command:\n") {
			t.Fatalf("network started before recovery block: %q", stdout.String())
		}
		return nil, errors.New("catalog unavailable")
	})}
	err := ExecuteContext(context.Background(), deps, BuildInfo{Version: "4.2.5", Target: "mirror-linux-amd64"}, []string{"upgrade"})
	if err == nil {
		t.Fatal("expected upgrade failure")
	}
	if !WriteFinalRecovery(err, stdout) {
		t.Fatal("expected final recovery output")
	}
	block := "If the upgrade fails, reinstall Mirror with this command:\n" + upgradeRecoveryCommand("") + "\n"
	if strings.Count(stdout.String(), block) != 2 {
		t.Fatalf("expected recovery block exactly twice, got:\n%s", stdout.String())
	}
	if !strings.HasSuffix(stdout.String(), block) {
		t.Fatalf("recovery block is not final output:\n%s", stdout.String())
	}
	if strings.Contains(stdout.String(), "4.2.5") {
		t.Fatalf("unresolved default recovery incorrectly pinned current version:\n%s", stdout.String())
	}
	if strings.Contains(stderr.String(), "unexpected update notice") {
		t.Fatalf("upgrade emitted startup update notice before recovery block: %q", stderr.String())
	}
}
