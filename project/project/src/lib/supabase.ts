import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface Job {
  id: string;
  title: string;
  description_text: string | null;
  file_url: string;
  file_name: string;
  file_type: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Resume {
  id: string;
  job_id: string;
  candidate_name: string | null;
  resume_text: string | null;
  file_url: string;
  file_name: string;
  file_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Match {
  id: string;
  job_id: string;
  resume_id: string;
  similarity_score: number;
  is_match: boolean;
  match_details: Record<string, unknown>;
  created_at: string;
  resume?: Resume;
}
