-- Housekeeping: remove a throwaway election row created against the live
-- database while verifying that the restored elections INSERT policy works
-- (20260611100500). The row has no authority binding, so the authority-scoped
-- DELETE policy cannot remove it via the API. No-op on any database that does
-- not contain the probe row.

DELETE FROM public.elections
WHERE title = '__rls_probe__'
  AND creator = 'probe'
  AND description = 'probe';
