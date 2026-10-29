insert into reps(id,name,email,capacity,available) values
 ('10000000-0000-4000-8000-000000000001','Mere Rangi','mere@example.test',3,true),
 ('10000000-0000-4000-8000-000000000002','Lin Chen','lin@example.test',2,true),
 ('10000000-0000-4000-8000-000000000003','Alex Reed','alex@example.test',2,false)
 on conflict do nothing;
insert into teams(id,name) values ('20000000-0000-4000-8000-000000000001','ANZ inbound') on conflict do nothing;
insert into memberships(team_id,rep_id) select '20000000-0000-4000-8000-000000000001',id from reps where email in ('mere@example.test','lin@example.test') on conflict do nothing;
insert into rulesets(id,name,active,mapping,digest,source_rows) values
 ('30000000-0000-4000-8000-000000000001','Demo territories',true,'{"assignment":"record_assignment","conditions":[{"column":"Country","field":"country","type":"multiple","op":"in","empty_matches":false}]}','demo-territories-v1','[]') on conflict do nothing;
insert into rules(id,ruleset_id,position,name,conditions,team_id) values
 ('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',1,'ANZ inbound','[{"field":"country","type":"multiple","op":"in","value":["NZ","AU"],"empty_matches":false}]','20000000-0000-4000-8000-000000000001') on conflict do nothing;
insert into leads(id,code,name,attributes,received_at,due_at,purpose,review_on,status,owner_id,accepted_at) values
 ('50000000-0000-4000-8000-000000000001','ENQ-101','Kauri Analytics','{"country":"NZ","employees":35}',now()-interval '3 days',now()-interval '2 days','Requested a product demonstration',current_date+90,'new',null,null),
 ('50000000-0000-4000-8000-000000000002','ENQ-102','Harbour Systems','{"country":"AU","employees":80}',now()-interval '4 days',now()-interval '3 days','Requested product information',current_date+90,'assigned','10000000-0000-4000-8000-000000000001',null),
 ('50000000-0000-4000-8000-000000000003','ENQ-103','Southern Research','{"country":"NZ","employees":12}',now()-interval '2 days',now()+interval '1 day','Requested a demonstration',current_date+30,'accepted','10000000-0000-4000-8000-000000000002',now()-interval '1 day'),
 ('50000000-0000-4000-8000-000000000004','ENQ-104','Pacific Instruments','{"country":"SG","employees":50}',now()-interval '1 day',now()+interval '1 day','Requested a demonstration',current_date+30,'new',null,null),
 ('50000000-0000-4000-8000-000000000005','ENQ-105','Old enquiry for review','{"country":"NZ"}',now()-interval '180 days',now()-interval '179 days','',current_date-30,'assigned','10000000-0000-4000-8000-000000000003',null)
 on conflict do nothing;
insert into assignments(lead_id,rule_id,rep_id,actor,reason,created_at)
 select id,'40000000-0000-4000-8000-000000000001',owner_id,'Demo seed','Fictional earlier assignment',received_at from leads where code in ('ENQ-102','ENQ-103','ENQ-105') on conflict do nothing;
