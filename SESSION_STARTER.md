# SESSION_STARTER.md

Paste this at the start of each new Claude Code session to restore full context quickly.

---

## Prompt to paste

```
We are building Finboard — a self-hosted personal finance dashboard running on a Synology DS920+ NAS.

Please read the following files before we start:
- CLAUDE.md (project rules and conventions)
- PROGRESS.md (what's built, what's next)
- SCHEMA.md (database schema)
- README.md (full project overview)

Once you've read them, confirm:
1. What phase we are in
2. What was completed last session
3. What we should tackle this session

Today's session goal: [FILL IN — e.g. "Phase 1: write db_init.py and ingest_frollo.py"]
```

---

## Tips for productive sessions

- **One phase at a time.** Don't start Phase 2 work in a Phase 1 session.
- **Test before moving on.** Each script should be tested with real data before calling a phase complete.
- **Update PROGRESS.md at the end of every session.** This is the handoff document.
- **If something is unclear in CLAUDE.md**, fix CLAUDE.md — don't work around it.
- **Share the actual error message / stack trace.** Don't paraphrase — paste it.
- **If a decision changes**, update the Decisions Made table in PROGRESS.md and the relevant section of CLAUDE.md.

---

## What to have ready each session

- [ ] Latest Frollo CSV export saved to `data/exports/frollo/` (for Phase 1 testing)
- [ ] Sharesight API credentials in `.env` (for Phase 2)
- [ ] VS Code or Cursor open on the `finboard/` directory
- [ ] Terminal with `cd /path/to/finboard` already done
- [ ] Docker Desktop running (if testing the dashboard container)
