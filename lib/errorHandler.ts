import { PostgrestError } from '@supabase/supabase-js';

// Fungsi helper untuk validasi tipe error Supabase secara aman
export function isPostgrestError(error: unknown): error is PostgrestError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}