# CLI reference

Every operation supports --json. All writes require --actor, which records a supplied name without authenticating it. Every write also supports --dry-run, which rolls back the whole transaction. Human names are case-insensitive during lookup. Matching routing attribute values is case-sensitive, following the explicit mapping.

## reps

Read representatives and their workload.

```bash
npm run routing -- reps
```

## teams

Read distribution membership counts.

```bash
npm run routing -- teams
```

## rules

Read ordered routing conditions and destinations.

```bash
npm run routing -- rules
```

## leads

Read the enquiry register.

```bash
npm run routing -- leads
```

## attention

Find enquiries waiting for assignment or acceptance.

```bash
npm run routing -- attention
```

## unassigned

Work through the unassigned enquiry queue.

```bash
npm run routing -- unassigned
```

## overdue

Find breached handoff deadlines.

```bash
npm run routing -- overdue
```

## workload

Balance open work against capacity.

```bash
npm run routing -- workload
```

## history

Read assignment reasons and recorded actors.

```bash
npm run routing -- history
```

## imports

Reconcile imported versions and row counts.

```bash
npm run routing -- imports
```

## compliance

Check retention, purpose and routing exceptions.

```bash
npm run routing -- compliance
```

## retention

Review old enquiry records.

```bash
npm run routing -- retention
```

## activity

Read the recorded change history.

```bash
npm run routing -- activity
```

## coverage

Find missing routes and blocked destinations.

```bash
npm run routing -- coverage
```

## show

Read one enquiry with notes and assignment history.

```bash
npm run routing -- show --ref="<reference>"
```

## help

List all CLI operations.

```bash
npm run routing -- help
```

## weekly-review

Review the queue, workload and record controls.

```bash
npm run routing -- weekly-review
```

## preview

Explain the proposed assignment without changing it.

```bash
npm run routing -- preview --ref="<reference>"
```

## add-rep

Register a representative and capacity.

```bash
npm run routing -- add-rep --name="<name>" --email="<email>" --capacity=10 --actor="<operator>"
```

## add-team

Create a named distribution.

```bash
npm run routing -- add-team --name="<name>" --actor="<operator>"
```

## join-team

Add a representative to a distribution.

```bash
npm run routing -- join-team --team="<team>" --rep="<representative>" --actor="<operator>"
```

## set-availability

Record whether a representative is available for new assignments.

```bash
npm run routing -- set-availability --rep="<representative>" --available=false --actor="<operator>"
```

## add

Record a supplied enquiry and its purpose.

```bash
npm run routing -- add --code="<code>" --name="<business>" --attributes='{"country":"NZ"}' --due="<ISO timestamp with zone>" --purpose="<reason held>" --review-on="<YYYY-MM-DD>" --actor="<operator>"
```

## route

Assign one enquiry using current rules and capacity.

```bash
npm run routing -- route --ref="<reference>" --reason="<reason>" --actor="<operator>"
```

## accept

Record the assigned representative accepting the handoff.

```bash
npm run routing -- accept --ref="<reference>" --rep="<representative>" --evidence="<actual acceptance>" --actor="<operator>"
```

## close

Close accepted work with its outcome.

```bash
npm run routing -- close --ref="<reference>" --outcome="<outcome>" --actor="<operator>"
```

## log

Add a supplied factual note.

```bash
npm run routing -- log --ref="<reference>" --body="<note>" --actor="<operator>"
```

## import

Import a native Chili Piper assignment export as an inactive version.

```bash
npm run routing -- import chili-piper --file="<export.csv>" --map="<mapping.json>" --name="<version>" --actor="<operator>" --dry-run
```

## activate

Activate a reviewed routing version.

```bash
npm run routing -- activate --ref="<version>" --evidence="<review evidence>" --actor="<operator>"
```

## export

Write a complete private record backup.

```bash
npm run routing -- export --file="exports/<new-backup-name>.json"
```

## draft-handoff

Draft the enquiry handoff document without sending.

```bash
npm run routing -- draft-handoff --ref="<reference>"
```

## draft-review

Draft the weekly routing review without sending.

```bash
npm run routing -- draft-review
```

## Routing semantics

The first matching row wins. AND-only predicates support text equality, comma-delimited multiple text values, boolean equality and numeric comparisons. Missing numeric input never becomes zero. Empty source cells match only missing or empty values unless empty_matches is explicitly true. Unsupported OR groups, integrations and flow nodes are not silently approximated.

Available representatives below capacity are selected by the oldest recorded assignment, then ID. This is an unweighted local rotation, not Chili Piper's full distribution algorithm. Capacity counts assigned and accepted enquiries until close. A blocked destination stops routing rather than assigning the enquiry to a less-specific row. Writes are serialized by a database lock. Preview does not reserve capacity.

Use preview or coverage with --ruleset="<inactive version>" to review a draft import before activation. The active version is used when omitted. An activation changes future routing only. Existing ownership is preserved. Handoff deadlines are explicit timezone-bearing timestamps supplied per enquiry, not a business-hours calendar.

Enquiries are added through add. The Chili Piper import covers assignment CSVs, not lead history, meeting records, calendars or audit logs. export writes all ten domain entities to a new private JSON file and refuses overwrites. A backup is not a tested restore procedure; verify a database backup and recovery process before production.
