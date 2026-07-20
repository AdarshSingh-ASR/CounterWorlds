-- Avoid PostgreSQL's CURRENT_TIME keyword, which resolves to time with time zone
-- inside SQL expressions and cannot be assigned to timestamptz columns.
create or replace function public.consume_rate_limit(counter_key text, maximum integer, window_seconds integer)
returns table(allowed boolean, retry_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.rate_limit_counters%rowtype;
  request_now timestamptz := clock_timestamp();
begin
  insert into public.rate_limit_counters(key, count, window_started_at, expires_at)
  values (counter_key, 1, request_now, request_now + make_interval(secs => window_seconds))
  on conflict (key) do update set
    count = case when rate_limit_counters.expires_at <= request_now then 1 else rate_limit_counters.count + 1 end,
    window_started_at = case when rate_limit_counters.expires_at <= request_now then request_now else rate_limit_counters.window_started_at end,
    expires_at = case when rate_limit_counters.expires_at <= request_now then request_now + make_interval(secs => window_seconds) else rate_limit_counters.expires_at end
  returning * into current_row;

  allowed := current_row.count <= maximum;
  retry_after := greatest(1, ceil(extract(epoch from current_row.expires_at - request_now))::integer);
  return next;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;
