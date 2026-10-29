# Lead Routing for Claude Code

**The open-source lead routing desk that is just a database and Claude Code.** Built by Enterprise DNA. Works with Claude Code, Codex, OpenCode or Cursor.

| Do it yourself | We customise it | We run it for you |
|---|---|---|
| Free, MIT. Follow the quick start below. | Your fields, territories and Chili Piper routing values brought across. [Get your version built](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=chili-piper). | Installed and operated through Omni by Enterprise DNA. One setup fee, then a monthly retainer. [Talk to Sam](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=chili-piper). |

Chili Piper lists Routing & Scheduling from $1,250 per month, billed annually, or $15,000 a year. [Vendor pricing](https://www.chilipiper.com/pricing), checked 29 October 2026. This is a public starting price, not a customer invoice or an equivalent-service savings claim.

Own the daily assignment record: who should receive an enquiry, why they matched, whether they have capacity, and whether the handoff was accepted on time. The free base operates on local records. It does not book calendars, update Salesforce, monitor forms or send notifications. Enterprise DNA scopes and tests those connections for a managed version.

## Quick start

Node 20 or later.

```bash
git clone https://github.com/Enterprise-DNA-OS/lead-routing-for-claude-code.git
cd lead-routing-for-claude-code
npm install
npm test
npm run demo
npm run view
npm run docs
```

Open the folder in your coding agent and ask for /weekly-review. Seed only a demo database. The people and businesses are fictional. Demo records include stale enquiries, an overdue handoff, an unavailable owner and a country without coverage.

Embedded PGlite persists under .data/db by default. DATA_DIR selects another location. DATABASE_URL selects your Postgres database. Use an empty database and npm run migrate for real records. Tests always use disposable data and override DATABASE_URL. Optional TEST_DATABASE_URL must point to an empty disposable Postgres database. Never commit credentials or customer exports.

## Weekly rituals

/attention, /coverage, /workload, /overdue and /weekly-review answer the operating questions. Preview one assignment, route it locally, then record the actual owner's acceptance. The CLI prevents routing the same enquiry twice and never exceeds configured active capacity. An unavailable or full destination is held for review.

```bash
npm run routing -- preview --ref=ENQ-101
npm run routing -- route --ref=ENQ-101 --reason="Demo territory review complete" --actor="Demo operator"
npm run routing -- accept --ref=ENQ-101 --rep="Mere Rangi" --evidence="Fictional demonstration acceptance" --actor="Demo operator"
```

The demo follows the oldest assignment among available representatives. Read the preview for the actual selected person before recording acceptance in real use. Names in --actor are recorded declarations, not authentication.

## Commands

32 CLI operations and 34 agent command recipes. All operations support --json. Names match case-insensitively; partial identifiers work; ambiguous references list candidates and exit 1. [Full CLI](docs/cli.md).

- /reps: Read representatives and their workload.
- /teams: Read distribution membership counts.
- /rules: Read ordered routing conditions and destinations.
- /leads: Read the enquiry register.
- /attention: Find enquiries waiting for assignment or acceptance.
- /unassigned: Work through the unassigned enquiry queue.
- /overdue: Find breached handoff deadlines.
- /workload: Balance open work against capacity.
- /history: Read assignment reasons and recorded actors.
- /imports: Reconcile imported versions and row counts.
- /compliance: Check retention, purpose and routing exceptions.
- /retention: Review old enquiry records.
- /activity: Read the recorded change history.
- /coverage: Find missing routes and blocked destinations.
- /show: Read one enquiry with notes and assignment history.
- /help: List all CLI operations.
- /weekly-review: Review the queue, workload and record controls.
- /preview: Explain the proposed assignment without changing it.
- /add-rep: Register a representative and capacity.
- /add-team: Create a named distribution.
- /join-team: Add a representative to a distribution.
- /set-availability: Record whether a representative is available for new assignments.
- /add: Record a supplied enquiry and its purpose.
- /route: Assign one enquiry using current rules and capacity.
- /accept: Record the assigned representative accepting the handoff.
- /close: Close accepted work with its outcome.
- /log: Add a supplied factual note.
- /import: Import a native Chili Piper assignment export as an inactive version.
- /activate: Activate a reviewed routing version.
- /export: Write a complete private record backup.
- /draft-handoff: Draft the enquiry handoff document without sending.
- /draft-review: Draft the weekly routing review without sending.
- /customise: add fields or change a documented rule with a migration.
- /new-view: create a read-only report.

## Ten questions your own records answer

These combine your ownership, capacity and retention policies. They are executable questions, not an unsupported claim that a vendor can never answer them.

| Question | Read command |
|---|---|
| Which unassigned enquiries have already missed our handoff deadline? | overdue |
| Which countries have no matching route in our current enquiry list? | coverage |
| Which matching routes are blocked by representative capacity? | coverage |
| Which unavailable representatives still own open enquiries? | compliance |
| Who has the most open enquiries and overdue handoffs together? | workload |
| Which enquiries are still awaiting a named owner? | unassigned |
| Which enquiries need a retention review under our chosen policy? | retention |
| Who recorded each assignment and what reason did they give? | history |
| Which imported routing version came from this source digest? | imports |
| What changed in availability, ownership or handoff acceptance this week? | activity |

## Your first hour: ten things to ask for

1. Show enquiries awaiting an owner.
2. Find the oldest overdue handoff.
3. Preview the owner for an enquiry.
4. Explain a blocked routing decision.
5. Show everyone's remaining capacity.
6. Record a supplied acceptance.
7. Draft an internal handoff without sending.
8. Trial my native routing export.
9. Add a product field and a matching rule.
10. Build a weekly territory coverage report.

## Switching

[Bring your Chili Piper assignment export across](docs/replace-chili-piper.md) in one command with explicit mapping. CSV values are preserved and imported as an inactive version. A trial import writes nothing; malformed or unsupported input stops with a reason. Lead history, meeting records, proprietary distribution rules and live service connections require separate work. Test those before cancelling the incumbent.

## Documents and controls

Set business name, logo and colours in brand.json. npm run docs renders enquiry handoffs and assignment decision records. npm run view renders the weekly queue and control findings. Draft commands write private HTML under drafts/. Nothing sends.

[Compliance](docs/compliance.md) cites NZ privacy principles and Australian privacy guidance, separates legal duties from our operating checks and explains the limits. Records have purpose and review dates, and old records are flagged for a human decision. No legal certification, authenticated approval or automatic deletion is claimed.

Ten domain tables and four reporting views share one CLI. Versioned migrations work with Postgres syntax and embedded PGlite. The trusted operator role owns the database, and public access is denied. A shared deployment requires authenticated access, backups and operational controls. [Why no front end](docs/why-no-front-end.md).

MIT. Copyright 2026 Enterprise DNA. Independent project, not affiliated with Chili Piper.
