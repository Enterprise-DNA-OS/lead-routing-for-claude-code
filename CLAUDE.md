# Lead Routing for Claude Code: operating instructions

This is an owned routing desk for an inbound sales operator. Establish the business, named operator and actual routing policy before entering business records. Demo organisations and people are fictional.

Read before writing. Use npm run routing and --json for analysis. Never invent an actor, enquiry, acceptance, deadline, review or outcome. References accept case-insensitive names or partial IDs, and ambiguous matches stop with a candidate list. All mutations are local.

## One path per job

| Job | Command |
|---|---|
| Read representatives and their workload | /reps |
| Read distribution membership counts | /teams |
| Read ordered routing conditions and destinations | /rules |
| Read the enquiry register | /leads |
| Find enquiries waiting for assignment or acceptance | /attention |
| Work through the unassigned enquiry queue | /unassigned |
| Find breached handoff deadlines | /overdue |
| Balance open work against capacity | /workload |
| Read assignment reasons and recorded actors | /history |
| Reconcile imported versions and row counts | /imports |
| Check retention, purpose and routing exceptions | /compliance |
| Review old enquiry records | /retention |
| Read the recorded change history | /activity |
| Find missing routes and blocked destinations | /coverage |
| Read one enquiry with notes and assignment history | /show |
| List all CLI operations | /help |
| Review the queue, workload and record controls | /weekly-review |
| Explain the proposed assignment without changing it | /preview |
| Register a representative and capacity | /add-rep |
| Create a named distribution | /add-team |
| Add a representative to a distribution | /join-team |
| Record whether a representative is available for new assignments | /set-availability |
| Record a supplied enquiry and its purpose | /add |
| Assign one enquiry using current rules and capacity | /route |
| Record the assigned representative accepting the handoff | /accept |
| Close accepted work with its outcome | /close |
| Add a supplied factual note | /log |
| Import a native Chili Piper assignment export as an inactive version | /import |
| Activate a reviewed routing version | /activate |
| Write a complete private record backup | /export |
| Draft the enquiry handoff document without sending | /draft-handoff |
| Draft the weekly routing review without sending | /draft-review |
| Change a field or rule | /customise |
| Add a read-only report | /new-view |

## Boundaries

Never send messages, book meetings, change CRM records, expose the database owner role, or upload exports. Draft to drafts/ for a person to read. Never treat an operator-supplied actor name as authenticated proof. Do not seed a real database. Route only a new enquiry and preserve its first assignment. Record acceptance only after the named owner has actually accepted. No automated deletion; retention findings require a person to decide the legal and business obligations.

## Files and validation

scripts/routing.mjs is the only CLI. supabase/migrations holds versioned schema changes. docs/cli.md documents the commands. docs/replace-chili-piper.md owns import mapping. docs/compliance.md explains the controls and their limits. brand.json, views.json and documents.json define local read-only paperwork. The shared workflow recipes live in .claude/commands for all agent runtimes. Run npm test after changes and npm run demo only on demonstration data.
