import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { getDb, REPO_ROOT } from "./lib/db.mjs";
import { migrate } from "./migrate.mjs";
import { seed } from "./seed.mjs";
import {
  run,
  commands,
  reports,
  matches,
  parseArgs,
  date,
} from "./routing.mjs";
import { parseCsv } from "./lib/csv.mjs";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "routing-test-"));
process.env.DATA_DIR = path.join(tmp, "db");
process.env.OUTPUT_DIR = tmp;
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "";
const db = await getDb();
let closed = false,
  checks = 0;
const seen = new Set(),
  actor = { actor: "Test operator" };
const eq = (a, b) => {
  assert.deepEqual(a, b);
  checks++;
};
const ok = (v) => {
  assert.ok(v);
  checks++;
};
const call = async (cmd, o = {}, p = []) => {
  seen.add(cmd);
  return run(db, cmd, o, p);
};
const fail = async (cmd, o, re, p = []) => {
  await assert.rejects(() => call(cmd, o, p), re);
  checks++;
};
const put = (name, data) => {
  const file = path.join(tmp, name);
  fs.writeFileSync(
    file,
    typeof data === "string" ? data : JSON.stringify(data),
  );
  return file;
};
const count = async (t) =>
  (await db.query(`select count(*)::int n from ${t}`))[0].n;
const newLead = {
  ...actor,
  code: "TEST-1",
  name: "Test customer",
  attributes: '{"country":"NZ"}',
  received: "2026-01-01T00:00:00Z",
  due: "2026-01-02T00:00:00Z",
  purpose: "Requested a call",
  "review-on": "2027-01-01",
};
try {
  if (db.mode === "postgres")
    eq(
      (
        await db.query(
          "select count(*)::int n from information_schema.tables where table_schema='public'",
        )
      )[0].n,
      0,
    );
  eq((await migrate(db)).ran.length, 1);
  eq((await migrate(db)).ran.length, 0);
  await seed(db);
  await seed(db);
  eq(await count("leads"), 5);
  eq(await count("assignments"), 3);
  for (const cmd of Object.keys(reports)) ok(Array.isArray(await call(cmd)));
  eq((await call("help")).length, commands.length);
  ok((await call("weekly-review")).attention.length > 0);
  eq((await call("show", { ref: "enq-101" })).record.code, "ENQ-101");
  eq(
    (await call("show", { kind: "reps", ref: "MERE RANGI" }))[0].email,
    "mere@example.test",
  );
  await fail(
    "show",
    { kind: "reps", ref: "10000000-0000-4000-8000-00000000000" },
    /Ambiguous/,
  );
  await fail("show", { ref: "missing" }, /No leads/);
  await fail("show", { kind: "bad", ref: "x" }, /Unsupported/);
  const initial = await call("coverage");
  eq(initial.find((r) => r.code === "ENQ-104").result, "no-match");
  eq((await call("preview", { ref: "ENQ-101" }))[0].owner, "Mere Rangi");
  const before = await count("activity");
  await call("route", {
    ...actor,
    ref: "ENQ-101",
    reason: "Preview",
    "dry-run": true,
  });
  eq(await count("activity"), before);
  eq((await call("show", { ref: "ENQ-101" })).record.status, "new");
  await call("route", {
    ...actor,
    ref: "ENQ-101",
    reason: "Approved local assignment",
  });
  eq((await call("show", { ref: "ENQ-101" })).record.status, "assigned");
  await fail(
    "route",
    { ...actor, ref: "ENQ-101", reason: "Repeat" },
    /Only a new/,
  );
  await fail(
    "route",
    { ...actor, ref: "ENQ-104", reason: "No territory" },
    /no-match/,
  );
  await fail(
    "accept",
    { ...actor, ref: "ENQ-101", rep: "Lin", evidence: "Wrong owner" },
    /assigned owner/,
  );
  await fail(
    "close",
    { ...actor, ref: "ENQ-101", outcome: "Too early" },
    /Only an accepted/,
  );
  await call("accept", {
    ...actor,
    ref: "ENQ-101",
    rep: "Mere",
    evidence: "Supplied acceptance",
  });
  await call("log", {
    ...actor,
    ref: "ENQ-101",
    body: "<script>do not execute</script>",
  });
  eq((await call("show", { ref: "ENQ-101" })).notes.length, 1);
  await call("close", {
    ...actor,
    ref: "ENQ-101",
    outcome: "Demonstration complete",
  });
  eq((await call("show", { ref: "ENQ-101" })).record.status, "closed");
  await fail(
    "accept",
    { ...actor, ref: "ENQ-101", rep: "Mere", evidence: "Repeat" },
    /Only an assigned/,
  );
  await call("add-rep", {
    ...actor,
    name: "Morgan Test",
    email: "MORGAN@example.test",
    capacity: "1",
  });
  await call("add-rep", {
    ...actor,
    name: "Morgan Trial",
    email: "morgan2@example.test",
    capacity: "1",
  });
  await fail("show", { kind: "reps", ref: "Morgan" }, /Ambiguous/);
  await fail(
    "add-rep",
    { ...actor, name: "Invalid", email: "not-an-email" },
    /email/,
  );
  await fail(
    "add-rep",
    { ...actor, name: "Zero", email: "zero@example.test", capacity: "0" },
    /positive/,
  );
  await call("add-team", { ...actor, name: "Test distribution" });
  await call("join-team", {
    ...actor,
    team: "Test distribution",
    rep: "morgan@example.test",
  });
  eq(
    (
      await call("join-team", {
        ...actor,
        team: "Test distribution",
        rep: "morgan@example.test",
      })
    )[0].added,
    false,
  );
  await call("set-availability", {
    ...actor,
    rep: "morgan@example.test",
    available: "false",
  });
  eq(
    (await call("show", { kind: "reps", ref: "morgan@example.test" }))[0]
      .available,
    false,
  );
  await fail(
    "set-availability",
    { ...actor, rep: "Mere", available: "maybe" },
    /true or false/,
  );
  await call("add", newLead);
  await fail(
    "add",
    { ...newLead, code: "BAD", due: "2025-01-01T00:00:00Z" },
    /precedes/,
  );
  await fail(
    "add",
    { ...newLead, code: "BAD", attributes: "[]" },
    /JSON object/,
  );
  await fail(
    "add",
    { ...newLead, code: "BAD", "review-on": "2026-02-30" },
    /valid/,
  );
  await fail(
    "add",
    { ...newLead, code: "BAD", received: "2026-02-30T00:00:00Z" },
    /valid/,
  );
  await fail(
    "add",
    { ...newLead, code: "BAD", due: "2027-01-01" },
    /timestamp/,
  );
  await fail("add", { ...newLead, code: "BAD", purpose: "" }, /purpose/);
  await fail("add", { ...newLead, code: "NOACTOR", actor: "" }, /actor/);
  eq(await count("leads"), 6);
  // Real native CSV contract: quoted comma values, destinations, row order and separate predicates.
  const opts = {
    ...actor,
    file: path.join(REPO_ROOT, "fixtures/chili-piper.csv"),
    map: path.join(REPO_ROOT, "fixtures/chili-piper-map.json"),
    name: "Imported territories",
  };
  eq(
    (await call("import", { ...opts, "dry-run": true }, ["chili-piper"]))[0]
      .result,
    "preview",
  );
  eq(await count("rulesets"), 1);
  eq((await call("import", opts, ["chili-piper"]))[0].result, "draft");
  eq(await count("rulesets"), 2);
  eq((await call("import", opts, ["chili-piper"]))[0].result, "unchanged");
  eq(await count("rulesets"), 2);
  eq(
    (
      await call("preview", { ref: "ENQ-104", ruleset: "Imported territories" })
    )[0].result,
    "ready",
  );
  eq((await call("preview", { ref: "ENQ-104" }))[0].result, "no-match");
  const src = (
    await call("show", { kind: "rulesets", ref: "Imported territories" })
  )[0];
  eq(src.source_rows[0].Country, "NZ,AU");
  await fail("activate", { ...actor, ref: "Imported territories" }, /evidence/);
  await call("activate", {
    ...actor,
    ref: "Imported territories",
    evidence: "Tested NZ, AU and SG boundaries",
  });
  eq((await call("preview", { ref: "ENQ-104" }))[0].result, "ready");
  await fail("import", opts, /Use import/, ["unknown"]);
  const bad = put(
    "bad.csv",
    "row_name,Country,record_assignment_type,record_assignment\nvalid,NZ,user,mere@example.test\nbad,AU,user,unknown@example.test\n",
  );
  await fail(
    "import",
    { ...opts, file: bad, name: "Bad partial" },
    /unknown or ambiguous/,
    ["chili-piper"],
  );
  eq(await count("rulesets"), 2);
  eq(await count("imports"), 1);
  const unsupported = put(
    "extra.csv",
    "row_name,Country,Hidden,record_assignment_type,record_assignment\nx,NZ,something,user,mere@example.test\n",
  );
  await fail(
    "import",
    { ...opts, file: unsupported, name: "Unsupported" },
    /Unmapped/,
    ["chili-piper"],
  );
  const invalidMap = put("bad-map.json", {
    assignment: "record_assignment",
    conditions: [
      {
        column: "Country",
        field: "country",
        type: "text",
        op: "contains",
        empty_matches: false,
      },
    ],
  });
  await fail(
    "import",
    { ...opts, map: invalidMap, name: "Bad comparison" },
    /Unsupported/,
    ["chili-piper"],
  );
  // Importing a full destination must hold, never fall through to the less-specific row.
  const cap = put(
    "capacity.csv",
    "row_name,Country,record_assignment_type,record_assignment\nFirst,NZ,user,morgan@example.test\nFallback,NZ,user,mere@example.test\n",
  );
  await call("import", { ...opts, file: cap, name: "Capacity boundary" }, [
    "chili-piper",
  ]);
  await call("activate", {
    ...actor,
    ref: "Capacity boundary",
    evidence: "Test unavailable and full owner",
  });
  eq((await call("preview", { ref: "TEST-1" }))[0].result, "blocked-capacity");
  await fail(
    "route",
    { ...actor, ref: "TEST-1", reason: "Unavailable" },
    /blocked-capacity/,
  );
  await call("set-availability", {
    ...actor,
    rep: "morgan@example.test",
    available: "true",
  });
  await call("route", { ...actor, ref: "TEST-1", reason: "Ready" });
  await call("add", { ...newLead, code: "TEST-2" });
  eq((await call("preview", { ref: "TEST-2" }))[0].result, "blocked-capacity");
  await fail(
    "route",
    { ...actor, ref: "TEST-2", reason: "Would exceed capacity" },
    /blocked-capacity/,
  );
  eq(
    (await call("show", { kind: "reps", ref: "morgan@example.test" }))[0]
      .capacity,
    1,
  );
  // Matching uses typed values and explicit empty-cell semantics.
  const c = {
    field: "n",
    type: "number",
    op: "lt",
    value: 100,
    empty_matches: false,
  };
  eq(await matches([c], {}), false);
  eq(await matches([c], { n: 0 }), true);
  eq(await matches([c], { n: "0" }), false);
  eq(await matches([{ ...c, value: null }], {}), true);
  eq(await matches([{ ...c, value: null }], { n: 30 }), false);
  eq(
    await matches([{ ...c, value: null, empty_matches: true }], { n: 30 }),
    true,
  );
  eq(
    await matches([{ field: "ok", type: "boolean", op: "eq", value: false }], {
      ok: false,
    }),
    true,
  );
  eq(
    await matches([{ field: "country", type: "text", op: "eq", value: "NZ" }], {
      country: "nz",
    }),
    false,
  );
  eq(parseCsv('\uFEFFa,b\r\n"line\nnext","a""b"\r\n')[0], {
    a: "line\nnext",
    b: 'a"b',
  });
  assert.throws(() => parseCsv("a,a\nx,y"), /unique/);
  checks++;
  assert.throws(() => parseCsv("a,b\nx"), /expected/);
  checks++;
  assert.throws(() => parseCsv('a\n"x'), /unclosed/);
  checks++;
  assert.throws(() => date("2026-02-30"), /valid/);
  checks++;
  eq(parseArgs(["show", "--ref", "ENQ-101", "--json"]).options, {
    ref: "ENQ-101",
    json: true,
  });
  assert.throws(() => parseArgs(["show", "--ref"]), /Missing/);
  checks++;
  const draft = (await call("draft-handoff", { ref: "ENQ-101" }))[0].file;
  ok(fs.readFileSync(draft, "utf8").includes("&lt;script&gt;"));
  ok(!fs.readFileSync(draft, "utf8").includes("<script>"));
  ok(fs.existsSync((await call("draft-review"))[0].file));
  const backup = path.join(tmp, "exports", "all.json");
  await call("export", { file: backup });
  const snapshot = JSON.parse(fs.readFileSync(backup));
  eq(Object.keys(snapshot.tables).length, 10);
  eq(snapshot.tables.leads.length, 7);
  await fail("export", { file: backup }, /EEXIST/);
  eq(
    (
      await db.query(
        "select count(*)::int n from pg_class where relname=any($1) and relrowsecurity",
        [
          [
            "reps",
            "teams",
            "memberships",
            "rulesets",
            "rules",
            "leads",
            "assignments",
            "notes",
            "imports",
            "activity",
          ],
        ],
      )
    )[0].n,
    10,
  );
  eq([...seen].sort(), [...commands].sort());
  // Close PGlite before subprocesses; this also proves the persisted file can reopen.
  await db.close();
  closed = true;
  const proc = (file, args = [], status = 0) => {
    const r = spawnSync(
      process.execPath,
      [path.join(REPO_ROOT, "scripts", file), ...args],
      { cwd: REPO_ROOT, env: process.env, encoding: "utf8" },
    );
    assert.equal(r.status, status, r.stderr || r.stdout);
    checks++;
    return r;
  };
  eq(
    JSON.parse(proc("routing.mjs", ["show", "--ref=ENQ-101", "--json"]).stdout)
      .record.status,
    "closed",
  );
  ok(
    proc(
      "routing.mjs",
      ["show", "--kind=reps", "--ref=Morgan"],
      1,
    ).stderr.includes("Ambiguous"),
  );
  ok(proc("routing.mjs", ["nonsense"], 1).stderr.includes("Unknown command"));
  proc("view.mjs");
  proc("docs.mjs");
  ok(fs.existsSync(path.join(tmp, "views", "week.html")));
  ok(fs.existsSync(path.join(tmp, "views", "controls.html")));
  const documents = fs.readdirSync(
    path.join(tmp, "docs-out", "routing-decision"),
  );
  ok(documents.length >= 4);
  console.log(
    `PASS: ${checks} checks; ${commands.length} CLI operations exercised; ${db.mode}; isolated data, import rollback, routing capacity, private documents and subprocess exits`,
  );
} finally {
  if (!closed) await db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
