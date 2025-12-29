
import { createClient } from '@supabase/supabase-js';
import '@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface MatchRequest {
  jobId: string;
  threshold?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { jobId, threshold = 0.6 }: MatchRequest = await req.json();

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      throw new Error('Job not found');
    }

    let jobEmbedding = job.embedding;
    if (!jobEmbedding && job.description_text) {
      jobEmbedding = await generateEmbedding(job.description_text);
      await supabase
        .from('jobs')
        .update({ embedding: jobEmbedding })
        .eq('id', jobId);
    }

    const { data: resumes, error: resumesError } = await supabase
      .from('resumes')
      .select('*')
      .eq('job_id', jobId);

    if (resumesError) throw resumesError;

    const matches = [];

    for (const resume of resumes || []) {
      if (!resume.resume_text && resume.status !== 'completed') {
        console.log(`Skipping resume ${resume.id} as it is not yet parsed.`);
        continue;
      }

      let resumeEmbedding = resume.embedding;

      if (!resumeEmbedding && resume.resume_text) {
        console.log(`Generating embedding for resume ${resume.id}...`);
        resumeEmbedding = await generateEmbedding(resume.resume_text);

        if (resumeEmbedding) {
          const { error: updateError } = await supabase
            .from('resumes')
            .update({ embedding: resumeEmbedding })
            .eq('id', resume.id);

          if (updateError) {
            console.error(`Failed to update embedding for resume ${resume.id}:`, updateError);
          }
        }
      }

      if (jobEmbedding && resumeEmbedding) {
        const similarity = calculateCosineSimilarity(
          Array.isArray(jobEmbedding) ? jobEmbedding : JSON.parse(jobEmbedding),
          Array.isArray(resumeEmbedding) ? resumeEmbedding : JSON.parse(resumeEmbedding)
        );

        const isMatch = similarity >= threshold;

        await supabase
          .from('matches')
          .upsert({
            job_id: jobId,
            resume_id: resume.id,
            similarity_score: similarity,
            is_match: isMatch,
            match_details: {
              threshold,
              processed_at: new Date().toISOString()
            }
          }, {
            onConflict: 'job_id,resume_id'
          });

        if (isMatch) {
          matches.push({
            resume_id: resume.id,
            candidate_name: resume.candidate_name,
            file_name: resume.file_name,
            similarity_score: similarity
          });
        }
      }
    }

    matches.sort((a, b) => b.similarity_score - a.similarity_score);

    return new Response(
      JSON.stringify({
        success: true,
        job_id: jobId,
        total_resumes: resumes?.length || 0,
        matched_resumes: matches.length,
        threshold,
        matches
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error matching resumes:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // @ts-expect-error - Supabase AI session type not fully typed
    const model = new Supabase.ai.Session('gte-small');
    const embedding = await model.run(text, { mean_pool: true, normalize: true });
    return embedding as number[];
  } catch (error) {
    console.error('Error generating embedding:', error);
    return generateFallbackEmbedding(text);
  }
}

function generateFallbackEmbedding(text: string): number[] {
  const words = text.toLowerCase().split(/\s+/);
  const embedding = new Array(384).fill(0);

  for (let i = 0; i < words.length && i < embedding.length; i++) {
    const word = words[i];
    for (let j = 0; j < word.length; j++) {
      const charCode = word.charCodeAt(j);
      embedding[(i + j) % embedding.length] += charCode / 1000;
    }
  }

  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => magnitude > 0 ? val / magnitude : 0);
}

function calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    return 0;
  }

  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    magnitude1 += vec1[i] * vec1[i];
    magnitude2 += vec2[i] * vec2[i];
  }

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  return dotProduct / (magnitude1 * magnitude2);
}