import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ExcelJS from 'exceljs';
import { supabase, Job, Resume, Match } from '../lib/supabase';
import { useAuth } from '../contexts/auth-utils';
import { X, Upload, Play, Download, Loader2, FileText, CheckCircle2, AlertCircle, HelpCircle, Trash2 } from 'lucide-react';

interface JobDetailsProps {
  job: Job;
  onClose: () => void;
  onUpdate: () => void;
}

export default function JobDetails({ job, onClose }: Omit<JobDetailsProps, 'onUpdate'>) {
  const { user } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [matching, setMatching] = useState(false);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState('');
  // Session-only uploads (cleared when modal closes)
  const [sessionUploaded, setSessionUploaded] = useState<Resume[]>([]);
  const [threshold, setThreshold] = useState(0.6);

  // UI state for improved JobDetails
  const [tab, setTab] = useState<'upload' | 'matches' | 'history'>('upload');
  const [progress, setProgress] = useState<Record<string, number>>({});
  const timersRef = useRef<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Matches UI state: filtering and sorting
  const [sortBy, setSortBy] = useState<'score' | 'date' | 'name'>('score');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [minScore, setMinScore] = useState(0);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);

  // History deletion state
  const [selectedResumeIds, setSelectedResumeIds] = useState<Set<string>>(new Set());
  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const toggleResumeSelection = (id: string) => {
    const newSelected = new Set(selectedResumeIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedResumeIds(newSelected);
  };

  const toggleMatchSelection = (id: string) => {
    const newSelected = new Set(selectedMatchIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedMatchIds(newSelected);
  };

  const toggleAllResumes = () => {
    if (selectedResumeIds.size === resumes.length) {
      setSelectedResumeIds(new Set());
    } else {
      setSelectedResumeIds(new Set(resumes.map(r => r.id)));
    }
  };

  const toggleAllMatches = () => {
    if (selectedMatchIds.size === matches.length) {
      setSelectedMatchIds(new Set());
    } else {
      setSelectedMatchIds(new Set(matches.map(m => m.id)));
    }
  };

  const handleDeleteResumes = async (idsToDelete: string[]) => {
    const message = idsToDelete.length === 1 
      ? 'Are you sure you want to delete this file? This cannot be undone.' 
      : `Are you sure you want to delete these ${idsToDelete.length} files? This cannot be undone.`;
      
    if (!confirm(message)) return;
    
    setDeleting(true);
    try {
      // 1. Delete from storage (optional, but good practice if we have path)
      // Since we don't track storage path easily here without extra query, we'll skip storage delete for now 
      // or rely on a Supabase trigger/cascade if configured. 
      // Assuming database delete is primary goal.

      const { error } = await supabase
        .from('resumes')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;

      // Clear selection
      const newSelected = new Set(selectedResumeIds);
      idsToDelete.forEach(id => newSelected.delete(id));
      setSelectedResumeIds(newSelected);

      await loadResumes();
      await loadMatches(); // Matches might be deleted via cascade
    } catch (err) {
      console.error('Error deleting resumes:', err);
      setError('Failed to delete resumes');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteMatches = async (idsToDelete: string[]) => {
    const message = idsToDelete.length === 1 
      ? 'Are you sure you want to delete this match?' 
      : `Are you sure you want to delete these ${idsToDelete.length} matches?`;

    if (!confirm(message)) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('matches')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;

      // Clear selection
      const newSelected = new Set(selectedMatchIds);
      idsToDelete.forEach(id => newSelected.delete(id));
      setSelectedMatchIds(newSelected);

      await loadMatches();
    } catch (err) {
      console.error('Error deleting matches:', err);
      setError('Failed to delete matches');
    } finally {
      setDeleting(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files || []);
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain'
    ];
    const validFiles = dropped.filter(f => validTypes.includes(f.type));
    if (validFiles.length !== dropped.length) {
      setError('Some dropped files were skipped — only PDF, DOCX, DOC, and TXT are supported.');
    }
    setFiles(prev => [...prev, ...validFiles]);
    setTab('upload');
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const startSimulatedProgress = (fileName: string) => {
    setProgress(prev => ({ ...prev, [fileName]: 0 }));
    const id = window.setInterval(() => {
      setProgress(prev => {
        const current = prev[fileName] ?? 0;
        const next = Math.min(95, current + Math.floor(Math.random() * 10) + 5);
        return { ...prev, [fileName]: next };
      });
    }, 400);
    timersRef.current[fileName] = id;
  };

  const stopSimulatedProgress = (fileName: string) => {
    const id = timersRef.current[fileName];
    if (id) window.clearInterval(id);
    setProgress(prev => ({ ...prev, [fileName]: 100 }));
    delete timersRef.current[fileName];
  };

  const clearAllProgressTimers = () => {
    Object.values(timersRef.current).forEach(id => window.clearInterval(id));
    timersRef.current = {};
  };

  useEffect(() => {
    return () => clearAllProgressTimers();
  }, []);

  const displayedMatches = useMemo(() => {
    const filtered = matches.filter(m => (m.similarity_score ?? 0) >= minScore);
    const comparator = (a: Match, b: Match) => {
      if (sortBy === 'score') return (b.similarity_score ?? 0) - (a.similarity_score ?? 0);
      if (sortBy === 'date') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      const an = (a.resume?.file_name || '').toLowerCase();
      const bn = (b.resume?.file_name || '').toLowerCase();
      return an.localeCompare(bn);
    };
    const sorted = filtered.sort(comparator);
    return sortDir === 'desc' ? sorted : [...sorted].reverse();
  }, [matches, sortBy, sortDir, minScore]);

  const matchesAboveThresholdCount = useMemo(() => matches.filter(m => (m.similarity_score ?? 0) >= threshold).length, [matches, threshold]);


  const loadResumes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('job_id', job.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setResumes(data || []);
    } catch (err) {
      console.error('Error loading resumes:', err);
    }
  }, [job.id]);

  const loadMatches = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          *,
          resume:resumes(*)
        `)
        .eq('job_id', job.id)
        .eq('is_match', true)
        .order('similarity_score', { ascending: false });

      if (error) throw error;
      setMatches(data || []);
    } catch (err) {
      console.error('Error loading matches:', err);
    }
  }, [job.id]);

  useEffect(() => {
    loadResumes();
    loadMatches();
  }, [loadResumes, loadMatches]);

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain'
    ];

    const validFiles = selectedFiles.filter(file => validTypes.includes(file.type));

    if (validFiles.length !== selectedFiles.length) {
      setError('Some files were skipped. Only PDF, DOCX, DOC, and TXT files are supported.');
    } else {
      setError('');
    }

    setFiles(prevFiles => [...prevFiles, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const removeSessionUploaded = (id: string) => {
    setSessionUploaded(prev => prev.filter(r => r.id !== id));
  };

  const handleUploadResumes = async () => {
    if (files.length === 0 || !user) return;

    setUploading(true);
    setError('');

    try {
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${job.id}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(fileName);

        const { data: resumeData, error: insertError } = await supabase
          .from('resumes')
          .insert({
            job_id: job.id,
            file_url: publicUrl,
            file_name: file.name,
            file_type: file.type,
            status: 'processing'
          })
          .select()
          .single();

        if (insertError) throw insertError;

        // Add to session-only uploaded list (so Quick Preview shows these only for this session)
        setSessionUploaded(prev => [resumeData, ...prev]);

        fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-document`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileUrl: publicUrl,
              fileType: file.type,
              documentId: resumeData.id,
              documentType: 'resume'
            })
          }
        );
      }

      setFiles([]);
      await loadResumes();
    } catch (err) {
      console.error('Error uploading resumes:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload resumes');
    } finally {
      setUploading(false);
    }
  };

  const handleMatchResumes = async () => {
    setMatching(true);
    setError('');

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/match-resumes`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jobId: job.id,
            threshold
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to match resumes');
      }

      await loadMatches();
    } catch (err) {
      console.error('Error matching resumes:', err);
      setError(err instanceof Error ? err.message : 'Failed to match resumes');
    } finally {
      setMatching(false);
    }
  };

  const handleDownloadMatches = async () => {
    if (matches.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Matches');

    worksheet.columns = [
      { header: 'Candidate Name', key: 'candidate_name', width: 25 },
      { header: 'File Name', key: 'file_name', width: 30 },
      { header: 'Match Score', key: 'similarity_score', width: 15 },
      { header: 'File URL', key: 'file_url', width: 50 }
    ];

    // Add rows
    matches.forEach(match => {
      worksheet.addRow({
        candidate_name: match.resume?.candidate_name || 'Unknown',
        file_name: match.resume?.file_name || '',
        similarity_score: (match.similarity_score * 100).toFixed(1) + '%',
        file_url: match.resume?.file_url || ''
      });
    });

    // Style the header row
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4CAF50' } // Medium green (darker than light green)
      };
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' } // White text for better contrast on darker green
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Write to buffer
    const buffer = await workbook.xlsx.writeBuffer();
    
    // Download
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `matched_resumes_${job.title.replace(/\s+/g, '_')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900">{job.title}</h2>
            <p className="text-sm text-gray-500 mt-1">{resumes.length} resumes • {matches.length} matches</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm text-gray-500">Job ID</div>
              <div className="font-mono text-xs text-gray-400 truncate w-48">{job.id}</div>
            </div>
            <button onClick={() => { setFiles([]); setSessionUploaded([]); onClose(); }} className="p-2 rounded-full hover:bg-gray-100">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          <div className="mt-4">
            <div className="flex items-center gap-3 border-b">
              <button onClick={() => setTab('upload')} className={`px-3 py-2 -mb-px ${tab === 'upload' ? 'border-b-2 border-yellow-500 text-yellow-600' : 'text-gray-600'}`}>
                Upload
              </button>
              <button onClick={() => setTab('matches')} className={`px-3 py-2 -mb-px ${tab === 'matches' ? 'border-b-2 border-green-500 text-green-600' : 'text-gray-600'}`}>
                Matches
              </button>
              <button onClick={() => setTab('history')} className={`px-3 py-2 -mb-px ${tab === 'history' ? 'border-b-2 border-gray-400 text-gray-700' : 'text-gray-600'}`}>
                History
              </button>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-6">
              {tab === 'upload' && (
              <div className="md:col-span-5">
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="rounded-xl border border-dashed border-yellow-200 p-6 bg-gradient-to-b from-white to-yellow-50 text-center"
                >
                  <input ref={fileInputRef} id="resume-upload" type="file" className="hidden" onChange={handleFilesChange} multiple={true} accept=".pdf,.doc,.docx,.txt" />
                  {files.length === 0 ? (
                    <label htmlFor="resume-upload" className="cursor-pointer">
                      <Upload className="w-12 h-12 mx-auto text-yellow-500" />
                      <div className="mt-3 text-sm font-medium text-gray-900">Drag & drop resumes here, or <span className="text-yellow-600 underline">browse files</span></div>
                      <div className="text-xs text-gray-500 mt-1">Supports PDF, DOCX, DOC, TXT — bulk upload</div>
                    </label>
                  ) : null }

                  {files.length === 0 ? (
                    <div className="mt-4 text-sm text-gray-500">No files selected yet</div>
                  ) : (
                    <div className="mt-4 space-y-3 text-left">
                      {files.map((file, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 rounded-md bg-white border">
                          <div className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-md text-gray-600">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <div className="truncate font-medium text-gray-900">{file.name}</div>
                              <div className="text-xs text-gray-500 ml-3">{formatBytes(file.size)}</div>
                            </div>
                            <div className="mt-2">
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-2 bg-yellow-500 rounded-full" style={{ width: `${progress[file.name] ?? 0}%` }} />
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-3">
                            <button onClick={() => removeFile(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-md">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4">
                    {files.length === 0 ? (
                      <button onClick={() => { if (fileInputRef.current) { fileInputRef.current.value = ''; fileInputRef.current.click(); } }} title="Hold Ctrl/Cmd to select multiple files" className="mt-3 w-full inline-flex items-center justify-center gap-3 rounded-full bg-gradient-to-r from-yellow-500 to-yellow-600 text-white px-6 py-3 shadow-lg transform transition-transform duration-150 hover:-translate-y-0.5 hover:scale-[1.01] focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-200/50 font-semibold">
                        <Upload className="w-5 h-5" /> <span className="font-semibold">Select file(s)</span>
                      </button>
                    ) : (
                      <div className="mt-3 flex gap-3">
                        <button
                          onClick={() => { if (fileInputRef.current) { fileInputRef.current.value = ''; fileInputRef.current.click(); } }}
                          title="Hold Ctrl/Cmd to select multiple files"
                          disabled={uploading}
                          className={`flex-1 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 ${uploading ? 'bg-yellow-300 text-white cursor-not-allowed shadow-sm' : 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:to-yellow-700 text-white shadow-md transform transition duration-150 hover:-translate-y-0.5 hover:scale-105 font-semibold'} focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-yellow-100`}
                        >
                          <span className="font-medium">Select</span>
                        </button>

                        <button
                          onClick={async () => {
                            files.forEach(f => startSimulatedProgress(f.name));
                            await handleUploadResumes();
                            files.forEach(f => stopSimulatedProgress(f.name));
                            setTimeout(() => setProgress({}), 800);
                          }}
                          disabled={uploading}
                          className={`flex-1 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 ${uploading ? 'bg-yellow-300 text-white shadow-sm cursor-not-allowed' : 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:to-yellow-700 text-white shadow-md transform transition duration-150 hover:-translate-y-0.5 hover:scale-105 font-semibold'}`}
                        >
                          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          <span>{uploading ? `Uploading ${files.length}...` : `Upload ${files.length} file(s)`}</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <button onClick={() => setTab('matches')} disabled={matches.length === 0} className={`w-full inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 ${matches.length === 0 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:to-yellow-700 text-white shadow-md transform transition duration-150 hover:-translate-y-0.5 hover:scale-105 font-semibold'} focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-200/50`}>
                    <CheckCircle2 className="w-4 h-4" /> <span>{matches.length === 0 ? 'No matches yet' : `View Matches (${matches.length})`}</span>
                  </button>
                </div>
              </div>
            )}

            <div className={tab !== 'upload' ? 'md:col-span-12' : 'md:col-span-7'}> 
                {tab === 'matches' ? (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">Matched Resumes ({matches.length})</h3>
                      <div className="flex items-center gap-2">
                        <button onClick={handleMatchResumes} disabled={matching || resumes.length === 0} className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm flex items-center gap-2">
                          {matching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Re-run
                        </button>
                        <button onClick={handleDownloadMatches} disabled={matches.length === 0} className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-3 py-2 rounded-lg text-sm">
                          <Download className="w-4 h-4" /> Download
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mb-4">
                      <label className="text-sm text-gray-600">Sort</label>
                      <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'score' | 'date' | 'name')} className="px-2 py-1 border rounded text-sm">
                        <option value="score">Score</option>
                        <option value="date">Date</option>
                        <option value="name">File name</option>
                      </select>
                      <button onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')} className="px-2 py-1 border rounded text-sm">
                        {sortDir === 'desc' ? '↓' : '↑'}
                      </button>

                      <label className="text-sm text-gray-600 ml-4 flex items-center">
                        Threshold
                        <span title="Minimum similarity score to include a match (0-1). Adjust and click Re-run to apply."><HelpCircle className="w-4 h-4 text-gray-400 ml-2" /></span>
                      </label>
                      <input type="number" min="0" max="1" step="0.05" value={threshold} onChange={(e) => setThreshold(parseFloat(e.target.value))} className="w-20 px-2 py-1 border rounded text-sm" />
                      <div className="text-sm text-gray-600 ml-2">{matchesAboveThresholdCount} match{matchesAboveThresholdCount !== 1 ? 'es' : ''} ≥ {Math.round(threshold * 100)}%</div>

                      <label className="text-sm text-gray-600 ml-4">Min score</label>
                      <input type="range" min="0" max="1" step="0.01" value={minScore} onChange={(e) => setMinScore(parseFloat(e.target.value))} className="mx-2" />
                      <div className="text-sm text-gray-600">{Math.round(minScore * 100)}%</div>
                    </div>

                    {displayedMatches.length === 0 ? (
                      <div className="bg-gray-50 rounded-xl p-6 text-center">
                        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600">No matches yet. Upload resumes and run matching.</p>
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-[48vh] overflow-y-auto pr-2">
                        {displayedMatches.map((match) => (
                          <div key={match.id} className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md cursor-pointer" onClick={() => setSelectedMatch(match)}>
                            <div className="flex items-start gap-4">
                              <div className="w-14 h-14 rounded-lg bg-green-50 flex items-center justify-center">
                                <CheckCircle2 className="w-6 h-6 text-green-600" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="font-semibold text-gray-900">{match.resume?.candidate_name || 'Unknown Candidate'}</div>
                                    <div className="text-sm text-gray-500">{match.resume?.file_name}</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-2xl font-bold text-green-600">{(match.similarity_score * 100).toFixed(0)}%</div>
                                    <div className="text-xs text-gray-500">Match score</div>
                                  </div>
                                </div>

                                <div className="mt-3">
                                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-2 bg-green-500 rounded-full" style={{ width: `${Math.min(100, (match.similarity_score * 100))}%` }} />
                                  </div>
                                  <div className="mt-3 flex items-center gap-3">
                                    <a href={match.resume?.file_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-sm text-yellow-600 hover:text-yellow-700 font-medium inline-flex items-center gap-1">
                                      <Download className="w-4 h-4" /> Download
                                    </a>
                                    <span className="text-xs text-gray-500">·</span>
                                    <span className="text-xs text-gray-500">Added {match.created_at ? new Date(match.created_at).toLocaleDateString() : ''}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : tab === 'history' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Uploaded Files Section */}
                    <div className="bg-gray-50 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-gray-900">Uploaded Files ({resumes.length})</h4>
                        {selectedResumeIds.size > 0 && (
                          <button 
                            onClick={() => handleDeleteResumes(Array.from(selectedResumeIds))} 
                            className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 transition-colors"
                            disabled={deleting}
                          >
                            <Trash2 className="w-3 h-3" /> Delete ({selectedResumeIds.size})
                          </button>
                        )}
                      </div>
                      
                      {resumes.length === 0 ? (
                        <p className="text-sm text-gray-500">No files uploaded yet</p>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 p-2 mb-1">
                             <input 
                               type="checkbox" 
                               checked={selectedResumeIds.size === resumes.length && resumes.length > 0} 
                               onChange={toggleAllResumes}
                               className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                             />
                             <span className="text-xs text-gray-500 font-medium">Select All</span>
                          </div>
                          <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                            {resumes.map(r => (
                              <div key={r.id} className={`flex items-center justify-between p-2 rounded bg-white border hover:shadow-sm ${selectedResumeIds.has(r.id) ? 'ring-2 ring-yellow-500 border-yellow-500' : ''}`}>
                                <div className="flex items-center gap-3">
                                  <input 
                                    type="checkbox" 
                                    checked={selectedResumeIds.has(r.id)} 
                                    onChange={() => toggleResumeSelection(r.id)}
                                    className="rounded border-gray-300 text-yellow-600 focus:ring-yellow-500"
                                  />
                                  <div className="w-8 h-8 bg-gray-50 rounded flex items-center justify-center text-gray-600"><FileText className="w-4 h-4" /></div>
                                  <div className="text-sm">
                                    <div className="font-medium text-gray-900 truncate w-48 lg:w-32">{r.file_name}</div>
                                    <div className="text-xs text-gray-500">Uploaded {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-yellow-600 hover:text-yellow-700">Open</a>
                                  <button onClick={() => handleDeleteResumes([r.id])} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors" disabled={deleting} title="Delete file">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Matched Files Section */}
                    <div className="bg-gray-50 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-gray-900">Matched Files ({matches.length})</h4>
                        {selectedMatchIds.size > 0 && (
                          <button 
                            onClick={() => handleDeleteMatches(Array.from(selectedMatchIds))} 
                            className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 transition-colors"
                            disabled={deleting}
                          >
                            <Trash2 className="w-3 h-3" /> Delete ({selectedMatchIds.size})
                          </button>
                        )}
                      </div>
                      
                      {matches.length === 0 ? (
                        <p className="text-sm text-gray-500">No matched files yet</p>
                      ) : (
                        <div className="space-y-2">
                           <div className="flex items-center gap-2 p-2 mb-1">
                             <input 
                               type="checkbox" 
                               checked={selectedMatchIds.size === matches.length && matches.length > 0} 
                               onChange={toggleAllMatches}
                               className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                             />
                             <span className="text-xs text-gray-500 font-medium">Select All</span>
                          </div>
                          <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                            {matches.map(m => (
                              <div key={m.id} className={`flex items-center justify-between p-2 rounded bg-white border hover:shadow-sm ${selectedMatchIds.has(m.id) ? 'ring-2 ring-green-500 border-green-500' : ''}`}>
                                <div className="flex items-center gap-3">
                                  <input 
                                    type="checkbox" 
                                    checked={selectedMatchIds.has(m.id)} 
                                    onChange={() => toggleMatchSelection(m.id)}
                                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                  />
                                  <div className="w-8 h-8 bg-gray-50 rounded flex items-center justify-center text-gray-600"><FileText className="w-4 h-4" /></div>
                                  <div className="text-sm">
                                    <div className="font-medium text-gray-900 truncate w-48 lg:w-32">{m.resume?.file_name}</div>
                                    <div className="text-xs text-gray-500">Matched {(m.similarity_score * 100).toFixed(0)}% • {m.created_at ? new Date(m.created_at).toLocaleDateString() : ''}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <a href={m.resume?.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-yellow-600 hover:text-yellow-700">Open</a>
                                  <button onClick={() => handleDeleteMatches([m.id])} className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors" disabled={deleting} title="Delete match">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl p-6">
                    <h4 className="text-lg font-semibold mb-4">Quick Preview</h4>
                    <p className="text-sm text-gray-600">Select files on the left to see a preview and start uploads. After uploading, run the matcher to find the best candidates.</p>

                    <div className="mt-4">
                      <h5 className="text-sm font-medium text-gray-700 mb-2">
                        {files.length > 0 ? `Files Selected (${files.length})` : sessionUploaded.length > 0 ? `Uploaded this session (${sessionUploaded.length} file${sessionUploaded.length !== 1 ? 's' : ''})` : 'Session Files'}
                      </h5>

                      {files.length > 0 ? (
                        <div className="space-y-2">
                          {files.map((f, i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded-lg border bg-white">
                              <div className="text-sm">
                                <div className="font-medium text-gray-900 truncate w-64">{f.name}</div>
                                <div className="text-xs text-gray-500">{formatBytes(f.size)}</div>
                              </div>
                              {/* No Remove button before upload */}
                            </div>
                          ))}
                        </div>
                      ) : sessionUploaded.length > 0 ? (
                        <div className="space-y-2">
                          {sessionUploaded.map(r => (
                            <div key={r.id} className="flex items-center justify-between p-2 rounded-lg border bg-white">
                              <div className="text-sm">
                                <div className="font-medium text-gray-900 truncate w-64">{r.file_name}</div>
                                <div className="text-xs text-gray-500">Uploaded {r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</div>
                              </div>
                              <div className="flex items-center gap-3">
                                <a href={r.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full px-4 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:to-yellow-700 text-white shadow-md transform transition duration-150 hover:-translate-y-0.5 hover:scale-105 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200">
                                  <span className="text-sm">Open</span>
                                </a>
                                <button onClick={() => removeSessionUploaded(r.id)} className="inline-flex items-center gap-2 rounded-full px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:to-red-700 text-white shadow-md transform transition duration-150 hover:-translate-y-0.5 hover:scale-105 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200">
                                  <span className="text-sm">Remove</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500">No files selected this session</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Match detail modal */}
                {selectedMatch && (
                  <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">{selectedMatch.resume?.candidate_name || 'Candidate'}</h3>
                          <p className="text-sm text-gray-500">{selectedMatch.resume?.file_name}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-green-600">{(selectedMatch.similarity_score * 100).toFixed(0)}%</div>
                          <div className="text-xs text-gray-500">Match score</div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="text-sm text-gray-700">Details:</p>
                        <p className="text-sm text-gray-500 mt-2">File: {selectedMatch.resume?.file_name}</p>
                        <p className="text-sm text-gray-500">Added: {selectedMatch.created_at ? new Date(selectedMatch.created_at).toLocaleString() : ''}</p>
                      </div>

                      <div className="mt-4 flex items-center justify-end gap-3">
                        <a href={selectedMatch.resume?.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-yellow-600 hover:text-yellow-700 font-medium inline-flex items-center gap-1">
                          <Download className="w-4 h-4" /> Open File
                        </a>
                        <button onClick={() => setSelectedMatch(null)} className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300">Close</button>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
