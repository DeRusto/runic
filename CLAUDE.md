## Agent skills

### Issue tracker

Issues live in GitHub Issues for DeRusto/runic (via the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Coding standards

Follow `docs/coding-standards.md` when writing or reviewing code.

### Writing style

Only the agent-style rule names load at startup. Before writing prose (docs, ADRs, glossary entries, PR bodies, issues, commit messages), read the relevant rules in `.agent-style/RULES.md`.

<!-- BEGIN agent-style v0.9.0 -->

@.agent-style/claude-code.md
<!-- END agent-style -->
