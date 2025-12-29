import { createClient } from '@supabase/supabase-js';
import '@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ParseRequest {
  fileUrl: string;
  fileType: string;
  documentId: string;
  documentType: 'job' | 'resume';
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

    const { fileUrl, fileType, documentId, documentType }: ParseRequest = await req.json();

    const response = await fetch(fileUrl);
    const buffer = await response.arrayBuffer();
    let extractedText = '';

    if (fileType === 'txt' || fileType === 'text/plain') {
      extractedText = new TextDecoder().decode(buffer);
    } else if (fileType === 'pdf' || fileType === 'application/pdf') {
      extractedText = await parsePDF(buffer);
    } else if (fileType === 'docx' || fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      extractedText = await parseDOCX(buffer);
    } else if (fileType === 'doc' || fileType === 'application/msword') {
      extractedText = 'Legacy DOC format - please convert to DOCX or PDF';
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }

    const cleanedText = cleanText(extractedText);

    const tableName = documentType === 'job' ? 'jobs' : 'resumes';
    const updateField = documentType === 'job' ? 'description_text' : 'resume_text';

    const { error: updateError } = await supabase
      .from(tableName)
      .update({
        [updateField]: cleanedText,
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({
        success: true,
        text: cleanedText,
        length: cleanedText.length
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error parsing document:', error);
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

async function parsePDF(buffer: ArrayBuffer): Promise<string> {
  try {
    // Using a more robust approach for PDF text extraction
    // Since we are in a Deno environment, we can try to use pdf-parse via npm
    const { default: pdfParse } = await import('pdf-parse');
    const data = await pdfParse(new Uint8Array(buffer));
    return data.text || 'No text content found in PDF.';
  } catch (error) {
    console.error('Error in parsePDF:', error);

    // Fallback to basic extraction if library fails
    const uint8Array = new Uint8Array(buffer);
    const text = new TextDecoder().decode(uint8Array);
    const textRegex = /\((.*?)\)/g;
    let extractedText = '';
    let match;
    while ((match = textRegex.exec(text)) !== null) {
      extractedText += match[1] + ' ';
    }
    return extractedText || 'Failed to parse PDF and fallback failed.';
  }
}

async function parseDOCX(buffer: ArrayBuffer): Promise<string> {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);
    const doc = await zip.file('word/document.xml')?.async('text');

    if (!doc) {
      return 'Could not extract text from DOCX file.';
    }

    // Better regex for DOCX to handle nested tags and spacing
    const text = doc
      .replace(/<w:p[^>]*>/g, '\n') // Paragraph breaks
      .replace(/<w:tab[^>]*\/>/g, ' ') // Tabs
      .replace(/<[^>]+>/g, '') // Remove all other tags
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .trim();

    return text;
  } catch (error) {
    return 'Error parsing DOCX file: ' + (error instanceof Error ? error.message : 'Unknown error');
  }
}

function cleanText(text: string): string {
  return text
    .replace(/[^\x20-\x7E\s]/g, ' ') // Remove non-printable ASCII and non-ASCII
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/\n+/g, ' ') // Replace newlines with spaces for embeddings
    .trim();
}