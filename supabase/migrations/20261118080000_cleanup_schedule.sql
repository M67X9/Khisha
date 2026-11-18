-- Cleanup schedule (milestone M9): every 5 minutes the `cleanup` Edge Function deletes expired temporary uploads
-- (and their unfinished drafts) and marks stuck extraction jobs as failed.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'khisha-cleanup',
  '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://hfijbeuefuiucbtsshwl.supabase.co/functions/v1/cleanup',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb
     ); $$
);
