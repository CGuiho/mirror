package updater

import (
	"os"
	"testing"
)

func TestCompletionJournalRoundTripAndConsume(t *testing.T) {
	t.Setenv("MIRROR_CACHE_DIR", t.TempDir())
	expected := Completion{
		TargetVersion: "3.8.0", Outcome: "succeeded",
		Verification: "succeeded", Rollback: "not required",
	}
	if err := WriteCompletion(expected); err != nil {
		t.Fatal(err)
	}
	actual, err := ConsumeCompletion()
	if err != nil {
		t.Fatal(err)
	}
	if actual == nil || actual.TargetVersion != expected.TargetVersion || actual.Outcome != expected.Outcome {
		t.Fatalf("unexpected completion: %#v", actual)
	}
	if again, err := ConsumeCompletion(); err != nil || again != nil {
		t.Fatalf("journal was not consumed: %#v %v", again, err)
	}
}

func TestCompletionJournalIsStrict(t *testing.T) {
	t.Setenv("MIRROR_CACHE_DIR", t.TempDir())
	path, err := JournalPath()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(`{"targetVersion":"3.8.0","outcome":"succeeded","verification":"succeeded","rollback":"not required","completedAt":"2026-07-24T00:00:00Z","unknown":true}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := ConsumeCompletion(); err == nil {
		t.Fatal("expected strict journal decoding error")
	}
}
