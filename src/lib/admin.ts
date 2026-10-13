// Data for the research dashboard (#/admin).
// Admins (listed in the `admins` table) get every angler's data from Supabase.
// Everyone else, and demo mode, sees only the data on this device, so the page is safe to open.
import { db, getKV, surveyKey, type Profile, type SurveyResponse } from './db';
import { supabase } from './supabase';
import { SURVEY } from '../data/survey';

export interface ATrip {
  id: string;
  userId: string;
  waterId: string | null;
  waterName: string;
  startedAt: string;
  endedAt: string | null;
  method: string | null;
  platform: string | null;
  satisfaction: number | null;
  loggedLive: boolean;
}
export interface ACatch {
  tripId: string;
  species: string;
  count: number;
  lengthCm: number | null;
  kept: boolean;
}
export interface ASurvey {
  userId: string;
  answers: Record<string, number | string>;
  completedAt: string | null;
}
export interface AProfile {
  userId: string;
  homeCountry: string | null;
  homePostcode: string | null;
  clubStatus: string | null;
  yearsFishing: number | null;
}
export interface AdminData {
  source: 'all' | 'own' | 'example';
  trips: ATrip[];
  catches: ACatch[];
  surveys: ASurvey[];
  profiles: AProfile[];
  loadedAt: Date;
}

export async function isAdmin(): Promise<boolean> {
  if (!supabase) return false;
  const { data: s } = await supabase.auth.getSession();
  if (!s.session || s.session.user.is_anonymous) return false;
  const { data, error } = await supabase.rpc('is_admin');
  return !error && data === true;
}

/** Supabase returns at most 1000 rows per request: page through. */
async function fetchAll<T>(table: string, columns: string, filter?: (q: any) => any): Promise<T[]> {
  const out: T[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    let q = supabase!.from(table).select(columns).range(from, from + page - 1);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < page) break;
  }
  return out;
}

async function loadAll(): Promise<AdminData> {
  const [trips, catches, surveys, profiles] = await Promise.all([
    fetchAll<any>('trips', 'id,user_id,water_id,water_name,started_at,ended_at,method,platform,satisfaction,logged_live', (q) => q.eq('deleted', false)),
    fetchAll<any>('catches', 'trip_id,species,count,length_cm,kept', (q) => q.eq('deleted', false)),
    fetchAll<any>('survey_responses', 'user_id,answers,completed_at', (q) => q.eq('survey_id', SURVEY.id)),
    fetchAll<any>('profiles', 'id,home_country,home_postcode,club_status,years_fishing')
  ]);
  return {
    source: 'all',
    trips: trips.map((r) => ({
      id: r.id, userId: r.user_id, waterId: r.water_id, waterName: r.water_name, startedAt: r.started_at,
      endedAt: r.ended_at, method: r.method, platform: r.platform, satisfaction: r.satisfaction, loggedLive: r.logged_live
    })),
    catches: catches.map((r) => ({ tripId: r.trip_id, species: r.species, count: r.count, lengthCm: r.length_cm === null ? null : Number(r.length_cm), kept: r.kept })),
    surveys: surveys.map((r) => ({ userId: r.user_id, answers: r.answers ?? {}, completedAt: r.completed_at })),
    profiles: profiles.map((r) => ({ userId: r.id, homeCountry: r.home_country, homePostcode: r.home_postcode, clubStatus: r.club_status, yearsFishing: r.years_fishing })),
    loadedAt: new Date()
  };
}

async function loadOwn(): Promise<AdminData> {
  const me = 'me';
  const trips = (await db.trips.toArray()).filter((t) => !t.deleted);
  const ids = new Set(trips.map((t) => t.id));
  const catches = (await db.catches.toArray()).filter((c) => !c.deleted && ids.has(c.tripId));
  const survey = await getKV<SurveyResponse | null>(surveyKey(SURVEY.id), null);
  const profile = await getKV<Profile | null>('profile', null);
  return {
    source: 'own',
    trips: trips.map((t) => ({
      id: t.id, userId: me, waterId: t.waterId, waterName: t.waterOther || t.waterName, startedAt: t.startedAt,
      endedAt: t.endedAt, method: t.method, platform: t.platform, satisfaction: t.satisfaction, loggedLive: t.loggedLive
    })),
    catches: catches.map((c) => ({ tripId: c.tripId, species: c.species, count: c.count, lengthCm: c.lengthCm, kept: c.kept })),
    surveys: survey ? [{ userId: me, answers: survey.answers, completedAt: survey.completedAt }] : [],
    profiles: profile ? [{ userId: me, homeCountry: profile.homeCountry, homePostcode: profile.homePostcode, clubStatus: profile.clubStatus, yearsFishing: profile.yearsFishing }] : [],
    loadedAt: new Date()
  };
}

export async function loadAdminData(): Promise<AdminData> {
  if (await isAdmin().catch(() => false)) return loadAll();
  return loadOwn();
}
