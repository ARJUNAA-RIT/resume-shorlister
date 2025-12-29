/*
  # AI Resume Matcher Schema

  ## Overview
  Creates the complete database schema for an AI-powered resume matching system that allows HR to upload job descriptions and resumes, then uses AI embeddings to match candidates.

  ## 1. New Tables
  
  ### `jobs`
  Stores job descriptions uploaded by HR
  - `id` (uuid, primary key) - Unique job identifier
  - `title` (text) - Job title
  - `description_text` (text) - Extracted text from JD document
  - `file_url` (text) - Original JD file URL in storage
  - `file_name` (text) - Original JD filename
  - `file_type` (text) - File type (pdf, docx, txt)
  - `embedding` (vector(384)) - AI-generated embedding for semantic search
  - `status` (text) - Processing status (pending, processing, completed, failed)
  - `created_by` (uuid) - HR user who uploaded the JD
  - `created_at` (timestamptz) - Upload timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `resumes`
  Stores resumes uploaded by HR for matching against jobs
  - `id` (uuid, primary key) - Unique resume identifier
  - `job_id` (uuid, foreign key) - Associated job posting
  - `candidate_name` (text) - Extracted or provided candidate name
  - `resume_text` (text) - Extracted text from resume document
  - `file_url` (text) - Original resume file URL in storage
  - `file_name` (text) - Original resume filename
  - `file_type` (text) - File type (pdf, docx, txt)
  - `embedding` (vector(384)) - AI-generated embedding for semantic search
  - `status` (text) - Processing status (pending, processing, completed, failed)
  - `created_at` (timestamptz) - Upload timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `matches`
  Stores matching results between jobs and resumes
  - `id` (uuid, primary key) - Unique match identifier
  - `job_id` (uuid, foreign key) - Job being matched
  - `resume_id` (uuid, foreign key) - Resume being evaluated
  - `similarity_score` (float) - AI similarity score (0-1)
  - `is_match` (boolean) - Whether resume meets matching threshold
  - `match_details` (jsonb) - Additional matching metadata
  - `created_at` (timestamptz) - Match timestamp

  ## 2. Security
  - Enable RLS on all tables
  - HR users can manage their own job postings
  - HR users can view and manage resumes for their jobs
  - HR users can view match results for their jobs

  ## 3. Indexes
  - Vector similarity search indexes for embeddings
  - Foreign key indexes for joins
  - Status indexes for filtering
*/

-- Enable vector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description_text text,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  embedding vector(384),
  status text DEFAULT 'pending',
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Resumes table
CREATE TABLE IF NOT EXISTS resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_name text,
  resume_text text,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  embedding vector(384),
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Matches table
CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE,
  resume_id uuid REFERENCES resumes(id) ON DELETE CASCADE,
  similarity_score float NOT NULL,
  is_match boolean DEFAULT false,
  match_details jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(job_id, resume_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_jobs_created_by ON jobs(created_by);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_resumes_job_id ON resumes(job_id);
CREATE INDEX IF NOT EXISTS idx_resumes_status ON resumes(status);
CREATE INDEX IF NOT EXISTS idx_matches_job_id ON matches(job_id);
CREATE INDEX IF NOT EXISTS idx_matches_resume_id ON matches(resume_id);
CREATE INDEX IF NOT EXISTS idx_matches_is_match ON matches(is_match);

-- Enable Row Level Security
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for jobs table
CREATE POLICY "Users can view their own jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create their own jobs"
  ON jobs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete their own jobs"
  ON jobs FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- RLS Policies for resumes table
CREATE POLICY "Users can view resumes for their jobs"
  ON resumes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = resumes.job_id
      AND jobs.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can create resumes for their jobs"
  ON resumes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = resumes.job_id
      AND jobs.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update resumes for their jobs"
  ON resumes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = resumes.job_id
      AND jobs.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = resumes.job_id
      AND jobs.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete resumes for their jobs"
  ON resumes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = resumes.job_id
      AND jobs.created_by = auth.uid()
    )
  );

-- RLS Policies for matches table
CREATE POLICY "Users can view matches for their jobs"
  ON matches FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = matches.job_id
      AND jobs.created_by = auth.uid()
    )
  );

CREATE POLICY "System can create matches"
  ON matches FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = matches.job_id
      AND jobs.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update matches for their jobs"
  ON matches FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = matches.job_id
      AND jobs.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = matches.job_id
      AND jobs.created_by = auth.uid()
    )
  );