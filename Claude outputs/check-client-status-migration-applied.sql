-- Quick check: did client-status-migration.sql actually run? This is almost
-- certainly why the Dashboard's active/inactive toggle looks like it's doing
-- nothing - the app tries to update a `status` column that doesn't exist yet
-- on the live `clients` table, the update fails, and the toggle silently
-- reverts. If this comes back empty, run client-status-migration.sql (once)
-- in the SQL editor, then re-run this to confirm.

select column_name, column_default, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'clients'
  and column_name = 'status';
