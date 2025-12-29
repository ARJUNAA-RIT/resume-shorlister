import { useState, useEffect } from 'react';
import { supabase, Job } from '../lib/supabase';
import { Loader2, ArrowLeft, Trash2 } from 'lucide-react';
import JobCard from './JobCard';

interface HistoryProps {
  onBack: () => void;
}

export default function History({ onBack }: HistoryProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error loading jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteJob = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this job? This action cannot be undone.')) return;

    try {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setJobs(jobs.filter(job => job.id !== id));
      setSelectedJobs(selectedJobs.filter(jobId => jobId !== id));
    } catch (error) {
      console.error('Error deleting job:', error);
      alert('Failed to delete job. Please try again.');
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedJobs.length} selected jobs? This action cannot be undone.`)) return;

    try {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .in('id', selectedJobs);

      if (error) throw error;

      setJobs(jobs.filter(job => !selectedJobs.includes(job.id)));
      setSelectedJobs([]);
    } catch (error) {
      console.error('Error deleting jobs:', error);
      alert('Failed to delete jobs. Please try again.');
    }
  };

  const handleSelectJob = (id: string, selected: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selected) {
      setSelectedJobs([...selectedJobs, id]);
    } else {
      setSelectedJobs(selectedJobs.filter(jobId => jobId !== id));
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm group"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-500 group-hover:text-gray-900" />
          </button>
          <div>
            <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Job History</h2>
            <p className="text-gray-500 font-medium">Manage and track all your recruitment postings</p>
          </div>
        </div>

        {selectedJobs.length > 0 && (
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-semibold animate-in fade-in slide-in-from-right-4"
          >
            <Trash2 className="w-4 h-4" />
            Delete Selected ({selectedJobs.length})
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 text-yellow-500 animate-spin" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-gray-100 max-w-2xl mx-auto">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Trash2 className="w-10 h-10 text-gray-300" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No history available</h3>
          <p className="text-gray-500 max-w-sm mx-auto">
            You haven't posted any jobs yet (or you've deleted them all). Head back to the dashboard to create a new listing.
          </p>
          <button
            onClick={onBack}
            className="mt-6 text-yellow-600 font-semibold hover:text-yellow-700"
          >
            Return to Dashboard
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onDelete={handleDeleteJob}
              selected={selectedJobs.includes(job.id)}
              onSelect={handleSelectJob}
              selectionMode={selectedJobs.length > 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
