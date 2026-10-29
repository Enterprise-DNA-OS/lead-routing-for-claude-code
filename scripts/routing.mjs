import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { getDb, REPO_ROOT } from "./lib/db.mjs";
import { parseCsv } from "./lib/csv.mjs";
import { table as textTable } from "./lib/format.mjs";
import { page, table, record, writeOut } from "./lib/render.mjs";

export const reports = {
  reps: "select * from rep_workload order by name",
  teams:
    "select t.id,t.name,count(m.id)::int members from teams t left join memberships m on m.team_id=t.id group by t.id order by t.name",
  rules:
    "select s.name as ruleset,s.active,r.position,r.name,r.conditions,coalesce(p.name,t.name) as destination from rules r join rulesets s on s.id=r.ruleset_id left join reps p on p.id=r.rep_id left join teams t on t.id=r.team_id order by s.created_at,r.position",
  leads: "select * from lead_register order by received_at,code",
  attention: "select * from routing_attention order by due_at,code",
  unassigned:
    "select code,name,attributes,received_at,due_at from leads where status='new' order by received_at,code",
  overdue:
    "select code,name,status,owner,due_at from lead_register where status in ('new','assigned') and due_at<now() order by due_at,code",
  workload:
    "select name,available,capacity,open_leads,overdue_handoffs,last_assigned from rep_workload order by open_leads desc,name",
  history:
    "select l.code,r.name as owner,a.actor,a.reason,a.created_at from assignments a join leads l on l.id=a.lead_id join reps r on r.id=a.rep_id order by a.created_at,l.code",
  imports:
    "select i.id,s.name as ruleset,i.row_count,i.digest,i.actor,i.created_at from imports i join rulesets s on s.id=i.ruleset_id order by i.created_at",
  compliance: "select * from routing_compliance order by code,control",
  retention:
    "select code,name,purpose,review_on,status from leads where review_on<current_date order by review_on,code",
  activity:
    "select kind,record_id,actor,details,created_at from activity order by created_at,id",
};
const writes = [
  "add-rep",
  "add-team",
  "join-team",
  "set-availability",
  "add",
  "route",
  "accept",
  "close",
  "log",
  "import",
  "activate",
];
export const commands = [
  ...Object.keys(reports),
  "coverage",
  "show",
  "help",
  "weekly-review",
  "preview",
  ...writes,
  "export",
  "draft-handoff",
  "draft-review",
];
const tables = [
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
];
const required = (o, k) => {
  if (typeof o[k] !== "string" || !o[k].trim())
    throw Error(`--${k} is required`);
  return o[k].trim();
};
const integer = (v, min = 1) => {
  if (
    !/^\d+$/.test(String(v)) ||
    !Number.isSafeInteger(Number(v)) ||
    Number(v) < min
  )
    throw Error("Expected a positive whole number");
  return Number(v);
};
export function date(v) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    new Date(v + "T00:00:00Z").toISOString().slice(0, 10) !== v
  )
    throw Error("Expected a valid YYYY-MM-DD date");
  return v;
}
function timestamp(v) {
  if (
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(Z|[+-]\d\d:\d\d)$/.test(
      v,
    ) ||
    !Number.isFinite(Date.parse(v))
  )
    throw Error("Expected an ISO timestamp with timezone");
  date(v.slice(0, 10));
  return new Date(v).toISOString();
}
function jsonObject(v) {
  const x = JSON.parse(v);
  if (!x || Array.isArray(x) || typeof x !== "object")
    throw Error("Expected a JSON object");
  for (const [k, n] of Object.entries(x)) {
    if (
      !k.trim() ||
      !["string", "boolean", "number"].includes(typeof n) ||
      (typeof n === "number" && !Number.isFinite(n))
    )
      throw Error(
        "Attributes must contain scalar text, boolean or finite numbers",
      );
  }
  return x;
}
function email(v) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
    throw Error("Expected an email address");
  return v.toLowerCase();
}
export async function resolve(db, kind, ref) {
  if (!["reps", "teams", "leads", "rulesets"].includes(kind))
    throw Error("Unsupported record kind");
  if (!String(ref || "").trim()) throw Error("A reference is required");
  const rows = await db.query(`select * from ${kind} order by id`),
    q = String(ref).trim().toLowerCase();
  const exact = rows.filter((r) =>
    [r.id, r.name, r.code, r.email].some(
      (v) => String(v || "").toLowerCase() === q,
    ),
  );
  const found = exact.length
    ? exact
    : rows.filter(
        (r) =>
          r.id.toLowerCase().startsWith(q) ||
          String(r.name).toLowerCase().includes(q),
      );
  if (found.length !== 1)
    throw Error(
      found.length
        ? `Ambiguous ${kind}: ${found.map((r) => `${r.id} ${r.code || r.name}`).join("; ")}`
        : `No ${kind} matches ${ref}`,
    );
  return found[0];
}
async function logActivity(db, kind, id, actor, details) {
  await db.query(
    "insert into activity(kind,record_id,actor,details) values($1,$2,$3,$4)",
    [kind, id, actor, JSON.stringify(details)],
  );
}
export async function matches(conditions, attrs) {
  return conditions.every((c) => {
    const raw = Object.hasOwn(attrs, c.field) ? attrs[c.field] : null;
    if (c.value === null) return c.empty_matches || raw === null || raw === "";
    if (raw === null || raw === "") return false;
    if (c.type === "number") {
      if (typeof raw !== "number" || !Number.isFinite(raw)) return false;
      return {
        eq: () => raw === c.value,
        gt: () => raw > c.value,
        gte: () => raw >= c.value,
        lt: () => raw < c.value,
        lte: () => raw <= c.value,
      }[c.op]();
    }
    if (c.type === "boolean")
      return typeof raw === "boolean" && raw === c.value;
    if (typeof raw !== "string") return false;
    return c.op === "in" ? c.value.includes(raw) : raw === c.value;
  });
}
export async function preview(db, lead, ruleset) {
  const set = ruleset ? await resolve(db, "rulesets", ruleset) : null;
  const rules = await db.query(
    `select r.* from rules r join rulesets s on s.id=r.ruleset_id where ${set ? "s.id=$1" : "s.active"} order by r.position`,
    set ? [set.id] : [],
  );
  if (!rules.length)
    return { code: lead.code, result: "no-rules", rule: null, owner: null };
  for (const r of rules) {
    if (!(await matches(r.conditions, lead.attributes))) continue;
    const reps = await db.query(
      `select w.* from rep_workload w where ${r.rep_id ? "w.id=$1" : "exists(select 1 from memberships m where m.rep_id=w.id and m.team_id=$1)"} and w.available and w.open_leads<w.capacity order by w.last_assigned asc nulls first,w.id`,
      [r.rep_id || r.team_id],
    );
    if (!reps.length)
      return {
        code: lead.code,
        result: "blocked-capacity",
        rule: r.name,
        owner: null,
        rule_id: r.id,
      };
    return {
      code: lead.code,
      result: "ready",
      rule: r.name,
      owner: reps[0].name,
      rep_id: reps[0].id,
      rule_id: r.id,
    };
  }
  return { code: lead.code, result: "no-match", rule: null, owner: null };
}
function validateMapping(m, headers) {
  if (
    !m ||
    typeof m !== "object" ||
    Object.keys(m).some((k) => !["assignment", "conditions"].includes(k))
  )
    throw Error("Mapping supports assignment and AND conditions only");
  if (
    !/^[a-z][a-z0-9_]*$/.test(m.assignment || "") ||
    !headers.includes(m.assignment) ||
    !headers.includes(m.assignment + "_type")
  )
    throw Error("Assignment key must match both native CSV columns");
  if (!Array.isArray(m.conditions) || !m.conditions.length)
    throw Error("Mapping needs explicit conditions");
  const columns = new Set();
  for (const c of m.conditions) {
    if (
      !c ||
      Object.keys(c).some(
        (k) => !["column", "field", "type", "op", "empty_matches"].includes(k),
      ) ||
      !headers.includes(c.column) ||
      typeof c.field !== "string" ||
      !c.field.trim() ||
      typeof c.empty_matches !== "boolean"
    )
      throw Error(
        "Each condition needs a column, field, type, op and explicit empty_matches",
      );
    const ops = {
      text: ["eq"],
      multiple: ["in"],
      number: ["eq", "gt", "gte", "lt", "lte"],
      boolean: ["eq"],
    };
    if (!ops[c.type]?.includes(c.op))
      throw Error("Unsupported condition type or operator");
    columns.add(c.column);
  }
  const allowed = new Set([
    "row_name",
    m.assignment,
    m.assignment + "_type",
    ...columns,
  ]);
  if (headers.some((h) => !allowed.has(h)))
    throw Error(
      "Unmapped CSV columns: account for every column; multiple assignment columns need separate mapping work",
    );
}
async function importRules(db, o, actor) {
  const file = required(o, "file"),
    mapFile = required(o, "map"),
    name = required(o, "name");
  const raw = fs.readFileSync(file, "utf8"),
    mapping = JSON.parse(fs.readFileSync(mapFile, "utf8")),
    rows = parseCsv(raw);
  if (!rows.length) throw Error("CSV has no rows");
  validateMapping(mapping, Object.keys(rows[0]));
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify({ rows, mapping }))
    .digest("hex");
  const existing = await db.query(
    "select id,name from rulesets where digest=$1",
    [hash],
  );
  if (existing.length)
    return [
      {
        result: "unchanged",
        ruleset: existing[0].name,
        rows: rows.length,
        digest: hash,
      },
    ];
  const prepared = [];
  for (const [i, row] of rows.entries()) {
    const kind = row[mapping.assignment + "_type"];
    if (!["user", "distribution"].includes(kind))
      throw Error(`Row ${i + 1}: assignment type must be user or distribution`);
    const dest = row[mapping.assignment].trim();
    if (!dest) throw Error(`Row ${i + 1}: destination is empty`);
    const destRows =
      kind === "user"
        ? await db.query("select id from reps where lower(email)=lower($1)", [
            dest,
          ])
        : await db.query(
            "select id from teams where lower(name)=lower($1) or id::text=$1",
            [dest],
          );
    if (destRows.length !== 1)
      throw Error(`Row ${i + 1}: unknown or ambiguous destination ${dest}`);
    const conditions = mapping.conditions.map((c) => {
      const v = row[c.column];
      let value = v === "" ? null : v;
      if (value !== null) {
        if (c.type === "number") {
          if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(v) || !Number.isFinite(Number(v)))
            throw Error(`Row ${i + 1}: invalid number`);
          value = Number(v);
        }
        if (c.type === "boolean") {
          if (!["true", "false"].includes(v.toLowerCase()))
            throw Error(`Row ${i + 1}: invalid boolean`);
          value = v.toLowerCase() === "true";
        }
        if (c.type === "multiple") {
          value = v.split(",").map((x) => x.trim());
          if (value.some((x) => !x))
            throw Error(`Row ${i + 1}: empty multiple value`);
        }
      }
      return {
        field: c.field,
        type: c.type,
        op: c.op,
        empty_matches: c.empty_matches,
        value,
      };
    });
    prepared.push({
      position: i + 1,
      name: row.row_name || `Row ${i + 1}`,
      conditions,
      rep_id: kind === "user" ? destRows[0].id : null,
      team_id: kind === "distribution" ? destRows[0].id : null,
    });
  }
  if (o["dry-run"])
    return [
      { result: "preview", ruleset: name, rows: rows.length, digest: hash },
    ];
  const [s] = await db.query(
    "insert into rulesets(name,mapping,digest,source_rows) values($1,$2,$3,$4) returning *",
    [name, JSON.stringify(mapping), hash, JSON.stringify(rows)],
  );
  for (const r of prepared)
    await db.query(
      "insert into rules(ruleset_id,position,name,conditions,rep_id,team_id) values($1,$2,$3,$4,$5,$6)",
      [
        s.id,
        r.position,
        r.name,
        JSON.stringify(r.conditions),
        r.rep_id,
        r.team_id,
      ],
    );
  await db.query(
    "insert into imports(ruleset_id,digest,row_count,actor) values($1,$2,$3,$4)",
    [s.id, hash, rows.length, actor],
  );
  await logActivity(db, "import", s.id, actor, {
    rows: rows.length,
    digest: hash,
  });
  return [{ result: "draft", ruleset: name, rows: rows.length, digest: hash }];
}
async function core(db, cmd, o, p) {
  if (reports[cmd]) return db.query(reports[cmd]);
  if (cmd === "help") return commands.map((command) => ({ command }));
  if (cmd === "weekly-review")
    return {
      attention: await core(db, "attention", {}, []),
      workload: await core(db, "workload", {}, []),
      compliance: await core(db, "compliance", {}, []),
    };
  if (cmd === "coverage") {
    const rows = await db.query(
      "select * from leads where status='new' order by received_at,code",
    );
    return Promise.all(
      rows.map(async (l) => {
        const r = await preview(db, l, o.ruleset);
        return { code: r.code, result: r.result, rule: r.rule, owner: r.owner };
      }),
    );
  }
  if (cmd === "show") {
    const kind = o.kind || "leads",
      r = await resolve(db, kind, required(o, "ref"));
    return kind === "leads"
      ? {
          record: r,
          notes: await db.query(
            "select actor,body,created_at from notes where lead_id=$1 order by created_at",
            [r.id],
          ),
          assignments: await db.query(
            "select * from assignments where lead_id=$1",
            [r.id],
          ),
        }
      : [r];
  }
  if (cmd === "preview")
    return [
      await preview(
        db,
        await resolve(db, "leads", required(o, "ref")),
        o.ruleset,
      ),
    ];
  if (cmd === "export") {
    const data = {
      format: "lead-routing-backup-v1",
      exported_at: new Date().toISOString(),
      tables: {},
    };
    for (const t of tables)
      data.tables[t] = await db.query(`select * from ${t} order by id`);
    const file = path.resolve(required(o, "file"));
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    return [
      {
        file,
        tables: tables.length,
        records: Object.values(data.tables).reduce((n, r) => n + r.length, 0),
      },
    ];
  }
  if (cmd === "draft-review") {
    const r = await core(db, "weekly-review", {}, []);
    return [
      {
        file: writeOut(
          "drafts",
          "weekly-routing-review",
          page({
            title: "Weekly routing review",
            subtitle: "Draft for internal review. Nothing sent.",
            sections: Object.entries(r).map(([title, rows]) => ({
              title,
              html: table(rows),
            })),
          }),
        ),
      },
    ];
  }
  if (cmd === "draft-handoff") {
    const l = await resolve(db, "leads", required(o, "ref"));
    const [r] = await db.query("select * from lead_register where id=$1", [
      l.id,
    ]);
    return [
      {
        file: writeOut(
          "drafts",
          `handoff-${l.id}`,
          page({
            title: "Enquiry handoff",
            subtitle: "Draft for the assigned owner. Nothing sent.",
            sections: [
              { title: "Enquiry", html: record(r) },
              {
                title: "Notes",
                html: table(
                  await db.query(
                    "select actor,body,created_at from notes where lead_id=$1 order by created_at",
                    [l.id],
                  ),
                ),
              },
            ],
          }),
        ),
      },
    ];
  }
  const actor = required(o, "actor");
  if (cmd === "add-rep") {
    const [r] = await db.query(
      "insert into reps(name,email,capacity) values($1,$2,$3) returning *",
      [
        required(o, "name"),
        email(required(o, "email")),
        integer(o.capacity || 10),
      ],
    );
    await logActivity(db, cmd, r.id, actor, { name: r.name, email: r.email });
    return [r];
  }
  if (cmd === "add-team") {
    const [r] = await db.query(
      "insert into teams(name) values($1) returning *",
      [required(o, "name")],
    );
    await logActivity(db, cmd, r.id, actor, { name: r.name });
    return [r];
  }
  if (cmd === "join-team") {
    const t = await resolve(db, "teams", required(o, "team")),
      r = await resolve(db, "reps", required(o, "rep"));
    const rows = await db.query(
      "insert into memberships(team_id,rep_id) values($1,$2) on conflict do nothing returning *",
      [t.id, r.id],
    );
    await logActivity(db, cmd, t.id, actor, {
      rep: r.name,
      added: !!rows.length,
    });
    return [{ team: t.name, rep: r.name, added: !!rows.length }];
  }
  if (cmd === "set-availability") {
    const r = await resolve(db, "reps", required(o, "rep"));
    if (!["true", "false"].includes(o.available))
      throw Error("--available must be true or false");
    await db.query("update reps set available=$1 where id=$2", [
      o.available === "true",
      r.id,
    ]);
    await logActivity(db, cmd, r.id, actor, {
      before: r.available,
      after: o.available === "true",
    });
    return [{ name: r.name, available: o.available === "true" }];
  }
  if (cmd === "add") {
    const received = o.received
        ? timestamp(o.received)
        : new Date().toISOString(),
      due = timestamp(required(o, "due"));
    if (Date.parse(due) < Date.parse(received))
      throw Error("Due time precedes receipt");
    const [r] = await db.query(
      "insert into leads(code,name,attributes,received_at,due_at,purpose,review_on) values($1,$2,$3,$4,$5,$6,$7) returning *",
      [
        required(o, "code"),
        required(o, "name"),
        JSON.stringify(jsonObject(required(o, "attributes"))),
        received,
        due,
        required(o, "purpose"),
        date(required(o, "review-on")),
      ],
    );
    await logActivity(db, cmd, r.id, actor, { code: r.code });
    return [r];
  }
  if (cmd === "import") {
    if (p[0] !== "chili-piper") throw Error("Use import chili-piper");
    return importRules(db, o, actor);
  }
  if (cmd === "activate") {
    const s = await resolve(db, "rulesets", required(o, "ref")),
      evidence = required(o, "evidence");
    await db.query("update rulesets set active=false where active");
    await db.query("update rulesets set active=true where id=$1", [s.id]);
    await logActivity(db, cmd, s.id, actor, { evidence });
    return [{ ruleset: s.name, active: true }];
  }
  const l = await resolve(db, "leads", required(o, "ref"));
  if (cmd === "route") {
    if (l.status !== "new")
      throw Error(
        "Only a new enquiry can be routed; existing assignments are preserved",
      );
    const result = await preview(db, l);
    if (result.result !== "ready")
      throw Error(`Routing held: ${result.result}`);
    const reason = required(o, "reason");
    await db.query(
      "update leads set owner_id=$1,status='assigned' where id=$2",
      [result.rep_id, l.id],
    );
    await db.query(
      "insert into assignments(lead_id,rule_id,rep_id,actor,reason) values($1,$2,$3,$4,$5)",
      [l.id, result.rule_id, result.rep_id, actor, reason],
    );
    await logActivity(db, cmd, l.id, actor, { ...result, reason });
    return [result];
  }
  if (cmd === "accept") {
    if (l.status !== "assigned")
      throw Error("Only an assigned enquiry can be accepted");
    const rep = await resolve(db, "reps", required(o, "rep"));
    if (rep.id !== l.owner_id)
      throw Error("Acceptance must name the assigned owner");
    const evidence = required(o, "evidence");
    await db.query(
      "update leads set status='accepted',accepted_at=now() where id=$1",
      [l.id],
    );
    await logActivity(db, cmd, l.id, actor, { owner: rep.name, evidence });
    return [{ code: l.code, status: "accepted" }];
  }
  if (cmd === "close") {
    if (l.status !== "accepted")
      throw Error("Only an accepted enquiry can be closed");
    const outcome = required(o, "outcome");
    await db.query(
      "update leads set status='closed',closed_at=now() where id=$1",
      [l.id],
    );
    await logActivity(db, cmd, l.id, actor, { outcome });
    return [{ code: l.code, status: "closed", outcome }];
  }
  if (cmd === "log") {
    const body = required(o, "body");
    const r = await db.query(
      "insert into notes(lead_id,actor,body) values($1,$2,$3) returning *",
      [l.id, actor, body],
    );
    await logActivity(db, cmd, l.id, actor, { note_id: r[0].id });
    return r;
  }
  throw Error(`Unknown command ${cmd}`);
}
export async function run(db, cmd, o = {}, p = []) {
  if (!commands.includes(cmd)) throw Error(`Unknown command ${cmd}. Use help.`);
  const allowed = {
    show: ["kind", "ref"],
    preview: ["ref", "ruleset"],
    coverage: ["ruleset"],
    "add-rep": ["name", "email", "capacity"],
    "add-team": ["name"],
    "join-team": ["team", "rep"],
    "set-availability": ["rep", "available"],
    add: [
      "code",
      "name",
      "attributes",
      "received",
      "due",
      "purpose",
      "review-on",
    ],
    route: ["ref", "reason"],
    accept: ["ref", "rep", "evidence"],
    close: ["ref", "outcome"],
    log: ["ref", "body"],
    import: ["file", "map", "name"],
    activate: ["ref", "evidence"],
    export: ["file"],
    "draft-handoff": ["ref"],
  };
  for (const k of Object.keys(o))
    if (
      ![
        "json",
        ...(writes.includes(cmd) ? ["actor", "dry-run"] : []),
        ...(allowed[cmd] || []),
      ].includes(k)
    )
      throw Error(`Unsupported option --${k} for ${cmd}`);
  for (const k of ["json", "dry-run"])
    if (k in o && typeof o[k] !== "boolean")
      throw Error(`--${k} is a bare flag`);
  if (p.length && (cmd !== "import" || p.length !== 1))
    throw Error("Unexpected positional arguments");
  if (!writes.includes(cmd)) {
    await db.exec("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    try {
      return await core(db, cmd, o, p);
    } finally {
      await db.exec("ROLLBACK");
    }
  }
  await db.exec("BEGIN");
  try {
    // Serialize routing, roster and policy writes. Database constraints are the second line of defence.
    await db.exec(
      "LOCK TABLE reps,teams,memberships,rulesets,rules,leads,assignments IN SHARE ROW EXCLUSIVE MODE",
    );
    const result = await core(db, cmd, o, p);
    await db.exec(o["dry-run"] ? "ROLLBACK" : "COMMIT");
    return result;
  } catch (e) {
    await db.exec("ROLLBACK");
    throw e;
  }
}
export function parseArgs(args) {
  const options = {},
    pos = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const at = a.indexOf("=");
      let k, v;
      if (at > 0) {
        k = a.slice(2, at);
        v = a.slice(at + 1);
      } else {
        k = a.slice(2);
        v = ["json", "dry-run"].includes(k) ? true : args[++i];
        if (v === undefined || (typeof v === "string" && v.startsWith("--")))
          throw Error(`Missing value for --${k}`);
      }
      if (Object.hasOwn(options, k)) throw Error(`Duplicate --${k}`);
      options[k] = v;
    } else pos.push(a);
  }
  return { cmd: pos.shift() || "help", options, pos };
}
export function human(value) {
  if (!Array.isArray(value))
    return Object.entries(value)
      .map(([k, v]) => `${k}\n${human(Array.isArray(v) ? v : [v])}`)
      .join("\n\n");
  if (!value.length) return "(none)";
  const rows = value.map((r) =>
    Object.fromEntries(
      Object.entries(r).map(([k, v]) => [
        k,
        v instanceof Date
          ? v.toISOString()
          : v && typeof v === "object"
            ? JSON.stringify(v)
            : v,
      ]),
    ),
  );
  return textTable(
    rows,
    Object.keys(rows[0]).map((key) => ({ key, label: key, width: 65 })),
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  let db;
  try {
    const { cmd, options, pos } = parseArgs(process.argv.slice(2));
    db = await getDb();
    const result = await run(db, cmd, options, pos);
    console.log(options.json ? JSON.stringify(result, null, 2) : human(result));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    if (db) await db.close();
  }
}
