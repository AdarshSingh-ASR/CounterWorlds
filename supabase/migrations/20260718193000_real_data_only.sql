-- Remove the original seeded demonstration classroom and disallow synthetic fallback jobs.
delete from public.sessions
where code = 'ORBIT7'
  and teacher_token = 'demo-teacher-token';

alter table public.generation_jobs
  drop constraint if exists generation_jobs_status_check;

alter table public.generation_jobs
  add constraint generation_jobs_status_check
  check (status in ('queued', 'analyzing', 'generating', 'validating', 'ready', 'failed'));
