# enforce

A Claude Code mod that compiles your `CLAUDE.md` rules into live hooks.

Rules Claude ignores become rules it *cannot* break.

## Install

```
/plugin install enforce --marketplace st6rgazing/enforce
```

## Usage

Run once per project (or whenever you update `CLAUDE.md`):

```
/enforce
```

It reads your `CLAUDE.md`, classifies each rule, and activates hooks for the ones it can enforce mechanically:

- **file-protect** — blocks `Edit` and `Write` to matched paths (e.g. `.env`, `*.lock`)
- **bash-deny** — blocks `Bash` commands matching a pattern (e.g. `rm -rf`, `git push --force`)
- **behavioral** — noted but not enforced (style, process, judgment calls)

To see what it blocked:

```
/enforce-violations
```

## How it works

`/enforce` sends your `CLAUDE.md` to a Haiku model call, gets back a JSON rule manifest, and stores it in the session. Three `tool.call` hooks — one each for `Edit`, `Write`, and `Bash` — check every tool call against the manifest and return `{ deny }` on a match.

No `settings.json` changes. No restarts. Rules are live immediately and persist across sessions via `$.store`.
