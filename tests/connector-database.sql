-- Run inside BEGIN/ROLLBACK after connector.sql. All fixtures are synthetic.
insert into auth.users(id,email) values
 ('f1000000-0000-4000-a000-000000000001','index-test-owner@example.invalid'),
 ('f1000000-0000-4000-a000-000000000002','index-test-other@example.invalid');
insert into auth.oauth_clients(id,registration_type,redirect_uris,grant_types,client_type,token_endpoint_auth_method,client_name)
values('f1000000-0000-4000-a000-000000000003','dynamic','https://example.invalid/callback','authorization_code,refresh_token','public','none','Index rollback test');
insert into auth.sessions(id,user_id,oauth_client_id,created_at,scopes) values('f1000000-0000-4000-a000-000000000004','f1000000-0000-4000-a000-000000000001','f1000000-0000-4000-a000-000000000003',now(),'openid');
insert into auth.oauth_consents(id,user_id,client_id,scopes) values('f1000000-0000-4000-a000-000000000005','f1000000-0000-4000-a000-000000000001','f1000000-0000-4000-a000-000000000003','openid');
insert into public.study_connector_grants(user_id,client_id) values('f1000000-0000-4000-a000-000000000001','f1000000-0000-4000-a000-000000000003');
insert into public.study_sets(id,owner_id,title,visibility,cards) values
 ('f1000000-0000-4000-a000-000000000006','f1000000-0000-4000-a000-000000000002','Other private set','private','[{"id":"other1","term":"x","definition":"y"},{"id":"other2","term":"a","definition":"b"}]'),
 ('f1000000-0000-4000-a000-000000000007','f1000000-0000-4000-a000-000000000002','Other public set','public','[{"id":"other1","term":"x","definition":"y"},{"id":"other2","term":"a","definition":"b"}]');
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-a000-000000000001","role":"authenticated","client_id":"f1000000-0000-4000-a000-000000000003","session_id":"f1000000-0000-4000-a000-000000000004","aud":["authenticated","https://wvaouepnnlqlxftrvjpf.supabase.co/functions/v1/index-mcp"]}',true);
set local role authenticated;
do $$
declare made jsonb; duplicate jsonb; readback jsonb; edited jsonb; request jsonb; id uuid; revision text; old_card text; created_card text;
begin
  request := '{"request_id":"f1000000-0000-4000-a000-000000000010","title":"Connector test","cards":[{"term":"A","definition":"Alpha"},{"term":"B","definition":"Beta"},{"term":"C","definition":"Gamma"}]}';
  made := public.index_study_connector('create_study_set',request);
  id := (made->>'id')::uuid;
  assert made->>'visibility'='private', 'Creation must be private';
  duplicate := public.index_study_connector('create_study_set',request);
  assert duplicate=made, 'Retry duplicated a set';
  begin
    perform public.index_study_connector('create_study_set',request||'{"title":"Changed"}');
    raise exception 'Reused idempotency key accepted';
  exception when sqlstate '22023' then null; end;
  assert jsonb_array_length(public.index_study_connector('find_study_sets','{}')->'sets')=1, 'Search leaked other users sets';
  assert (select count(*) from public.study_sets)=0, 'OAuth direct table access leaked rows';
  assert (select count(*) from public.study_progress)=0, 'OAuth progress readable';
  assert (select count(*) from public.study_stars)=0, 'OAuth stars readable';
  readback := public.index_study_connector('get_study_set',jsonb_build_object('set_id',id));
  assert jsonb_array_length(readback->'cards')=3, 'Read failed';
  assert jsonb_array_length(public.index_study_connector('get_study_set',jsonb_build_object('set_id',id,'offset',1,'limit',1))->'cards')=1, 'Pagination failed';
  revision := readback->>'updated_at'; old_card := readback->'cards'->0->>'id';
  request := jsonb_build_object('request_id','f1000000-0000-4000-a000-000000000011','set_id',id,'expected_updated_at',revision,'add','[{"term":"D","definition":"Delta"}]'::jsonb,'remove_card_ids',jsonb_build_array(old_card));
  edited := public.index_study_connector('edit_study_cards',request);
  assert (edited->>'card_count')::integer=3, 'Edit changed wrong number';
  assert jsonb_array_length(edited->'removed_cards')=1, 'Removed wrong cards';
  assert public.index_study_connector('edit_study_cards',request)=edited, 'Retry repeated edit';
  begin
    perform public.index_study_connector('edit_study_cards',request||'{"request_id":"f1000000-0000-4000-a000-000000000012"}');
    raise exception 'Stale revision accepted';
  exception when sqlstate '40001' then null; end;
  readback := public.index_study_connector('get_study_set',jsonb_build_object('set_id',id));
  assert readback->'cards'->0->>'term'='B' and readback->'cards'->1->>'term'='C', 'Unrelated cards changed';
  begin
    perform public.index_study_connector('edit_study_cards',jsonb_build_object('request_id','f1000000-0000-4000-a000-000000000013','set_id',id,'expected_updated_at',readback->>'updated_at','remove_card_ids',jsonb_build_array(readback->'cards'->0->>'id',readback->'cards'->1->>'id')));
    raise exception 'Allowed fewer than two cards';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.index_study_connector('get_study_set','{"set_id":"f1000000-0000-4000-a000-000000000006"}');
    raise exception 'Read someone else private set';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.index_study_connector('get_study_set','{"set_id":"f1000000-0000-4000-a000-000000000007"}');
    raise exception 'Read someone else public set through connector';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.index_study_connector('delete_set',jsonb_build_object('set_id',id));
    raise exception 'Allowed whole set deletion';
  exception when sqlstate '22023' then null; end;
end; $$;
reset role;
-- Deleted clients, expired sessions and revoked provider consents fail closed too.
update auth.oauth_clients set deleted_at=now() where id='f1000000-0000-4000-a000-000000000003';
set local role authenticated;
do $$ begin begin perform public.index_study_connector('find_study_sets','{}'); raise exception 'Deleted client still works'; exception when sqlstate '42501' then null; end; end; $$;
reset role;
update auth.oauth_clients set deleted_at=null where id='f1000000-0000-4000-a000-000000000003';
update auth.sessions set not_after=now()-interval '1 minute' where id='f1000000-0000-4000-a000-000000000004';
set local role authenticated;
do $$ begin begin perform public.index_study_connector('find_study_sets','{}'); raise exception 'Expired session still works'; exception when sqlstate '42501' then null; end; end; $$;
reset role;
update auth.sessions set not_after=null where id='f1000000-0000-4000-a000-000000000004';
update auth.oauth_consents set revoked_at=now() where id='f1000000-0000-4000-a000-000000000005';
set local role authenticated;
do $$ begin begin perform public.index_study_connector('find_study_sets','{}'); raise exception 'Revoked consent still works'; exception when sqlstate '42501' then null; end; end; $$;
reset role;
update auth.oauth_consents set revoked_at=null where id='f1000000-0000-4000-a000-000000000005';
-- Immediate disconnection, even while the JWT is otherwise valid.
delete from public.study_connector_grants where user_id='f1000000-0000-4000-a000-000000000001';
set local role authenticated;
do $$ begin
  begin perform public.index_study_connector('find_study_sets','{}'); raise exception 'Disconnected grant still works';
  exception when sqlstate '42501' then null; end;
end; $$;
reset role;
-- Direct Google sessions retain ordinary owned-set access and cannot call connector RPC.
select set_config('request.jwt.claims','{"sub":"f1000000-0000-4000-a000-000000000001","role":"authenticated","aud":"authenticated"}',true);
set local role authenticated;
do $$ begin
  assert (select count(*) from public.study_sets where owner_id=auth.uid())=1, 'Normal app access regressed';
  begin perform public.index_study_connector('find_study_sets','{}'); raise exception 'Normal session accepted as connector';
  exception when sqlstate '42501' then null; end;
end; $$;
reset role;
-- Auth hook binds OAuth tokens; browser claims stay untouched.
do $$ declare hooked jsonb; begin
  hooked := public.index_connector_token_hook('{"claims":{"aud":"authenticated","client_id":"f1000000-0000-4000-a000-000000000003"}}');
  assert hooked->'claims'->'aud' ? 'https://wvaouepnnlqlxftrvjpf.supabase.co/functions/v1/index-mcp', 'Missing resource audience';
  assert public.index_connector_token_hook('{"claims":{"aud":"authenticated"}}')='{"claims":{"aud":"authenticated"}}'::jsonb, 'Changed direct browser audience';
end; $$;
select 'Connector isolation, edits, retries, conflicts, revocation and direct-app checks passed' as result;
