create function touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create table reps (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name))>0), email text not null,
 capacity integer not null default 10 check(capacity>0), available boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index reps_email on reps(lower(email));
create table teams (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name))>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index teams_name on teams(lower(name));
create table memberships (
 id uuid primary key default gen_random_uuid(), team_id uuid not null references teams, rep_id uuid not null references reps,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(team_id,rep_id)
);
create table rulesets (
 id uuid primary key default gen_random_uuid(), name text not null unique, active boolean not null default false,
 mapping jsonb not null, digest text not null unique, source_rows jsonb not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index only_one_active_ruleset on rulesets(active) where active;
create table rules (
 id uuid primary key default gen_random_uuid(), ruleset_id uuid not null references rulesets,
 position integer not null check(position>0), name text not null, conditions jsonb not null,
 rep_id uuid references reps, team_id uuid references teams,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((rep_id is null) <> (team_id is null)), unique(ruleset_id,position)
);
create table leads (
 id uuid primary key default gen_random_uuid(), code text not null unique, name text not null,
 attributes jsonb not null default '{}', received_at timestamptz not null default now(),
 due_at timestamptz not null, purpose text not null, review_on date not null,
 status text not null default 'new' check(status in ('new','assigned','accepted','closed')),
 owner_id uuid references reps, accepted_at timestamptz, closed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(due_at>=received_at), check(status='new' or owner_id is not null),
 check(status not in ('accepted','closed') or accepted_at is not null),
 check((status='closed')=(closed_at is not null))
);
create table assignments (
 id uuid primary key default gen_random_uuid(), lead_id uuid not null references leads, rule_id uuid not null references rules,
 rep_id uuid not null references reps, actor text not null, reason text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(lead_id)
);
create table notes (
 id uuid primary key default gen_random_uuid(), lead_id uuid not null references leads, actor text not null, body text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table imports (
 id uuid primary key default gen_random_uuid(), ruleset_id uuid not null references rulesets, digest text not null,
 row_count integer not null, actor text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table activity (
 id uuid primary key default gen_random_uuid(), kind text not null, record_id uuid, actor text not null, details jsonb not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
do $$ declare t text; begin
 foreach t in array array['reps','teams','memberships','rulesets','rules','leads','assignments','notes','imports','activity'] loop
 execute format('create trigger touch before update on %I for each row execute function touch_updated_at()',t);
 execute format('alter table %I enable row level security',t);
 execute format('revoke all on %I from public',t);
 end loop;
end $$;
create view lead_register as
 select l.id,l.code,l.name,l.status,r.name as owner,l.received_at,l.due_at,l.accepted_at,l.review_on,l.purpose,l.attributes
 from leads l left join reps r on r.id=l.owner_id;
create view rep_workload as
 select r.id,r.name,r.email,r.available,r.capacity,
 count(l.id) filter(where l.status in ('assigned','accepted'))::int as open_leads,
 count(l.id) filter(where l.status='assigned' and l.due_at<now())::int as overdue_handoffs,
 (select max(a.created_at) from assignments a where a.rep_id=r.id) as last_assigned
 from reps r left join leads l on l.owner_id=r.id group by r.id;
create view routing_attention as
 select code,name,status,owner,due_at,
 case when status='new' then 'No assignment' else 'Handoff not accepted' end as reason
 from lead_register where status='new' or (status='assigned' and due_at<now());
create view routing_compliance as
 select code,'RETENTION-REVIEW' as control,'Review whether these details are still needed' as finding
 from leads where review_on<current_date
 union all select code,'PURPOSE','Record why this enquiry is held' from leads where trim(purpose)=''
 union all select l.code,'UNAVAILABLE-OWNER','Reconcile open work with owner availability' from leads l join reps r on r.id=l.owner_id where not r.available and l.status<>'closed'
 union all select code,'HANDOFF-DUE','Local handoff deadline passed' from leads where status in ('new','assigned') and due_at<now();
revoke all on lead_register,rep_workload,routing_attention,routing_compliance from public;
