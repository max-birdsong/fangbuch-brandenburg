// Settings that the app text and the database must agree on.

/**
 * Years without using the app after which an account (email, postcode, club name) is deleted
 * automatically; fishing data is kept only in anonymous form. Placeholder until the data
 * protection officer decides. Must match `retention_years` in the database (supabase/schema.sql,
 * table app_settings).
 */
export const RETENTION_YEARS = 3;
