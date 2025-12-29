import { useState, useRef, useEffect } from 'react';
import { Job } from '../lib/supabase';
import { FileText, CheckCircle, Loader2, ArrowRight, MoreVertical, Trash2, CheckSquare, Square } from 'lucide-react';
import JobDetails from './JobDetails';

interface JobCardProps {
  job: Job;
  onDelete: (id: string, e: React.MouseEvent) => void;
  selected: boolean;
  onSelect: (id: string, selected: boolean, e: React.MouseEvent) => void;
  selectionMode: boolean;
}

export default function JobCard({ job, onDelete, selected, onSelect, selectionMode }: JobCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'processing':
        return 'bg-yellow-50 text-yellow-700 border-yellow-100';
      case 'failed':
        return 'bg-rose-50 text-rose-700 border-rose-100';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-3.5 h-3.5" />;
      case 'processing':
        return <Loader2 className="w-3.5 h-3.5 animate-spin" />;
      default:
        return <FileText className="w-3.5 h-3.5" />;
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // If in selection mode or clicking specifically to select
    if (selectionMode) {
      onSelect(job.id, !selected, e);
      return;
    }
    setShowDetails(true);
  };

  return (
    <>
      <div
        onClick={handleCardClick}
        className={`group relative bg-white rounded-2xl p-6 hover:shadow-xl hover:shadow-yellow-500/10 border transition-all duration-300 cursor-pointer flex flex-col h-full ${selected ? 'border-yellow-400 ring-2 ring-yellow-400 ring-offset-2' : 'border-gray-100 hover:border-yellow-200'
          }`}
      >
        {/* Selection Checkbox (Visible on hover or when selected) */}
        <div
          onClick={(e) => onSelect(job.id, !selected, e)}
          className={`absolute top-4 left-4 z-10 transition-opacity duration-200 ${selected || selectionMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
        >
          <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${selected ? 'bg-yellow-500' : 'bg-gray-100 hover:bg-gray-200'
            }`}>
            {selected ? (
              <CheckSquare className="w-4 h-4 text-white" />
            ) : (
              <Square className="w-4 h-4 text-gray-400" />
            )}
          </div>
        </div>

        {/* Menu Button */}
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100 data-[open=true]:opacity-100"
            data-open={showMenu}
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {showMenu && (
            <div
              ref={menuRef}
              className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-30 animate-in fade-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={(e) => {
                  setShowMenu(false);
                  onDelete(job.id, e);
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
              >
                <Trash2 className="w-4 h-4" />
                Delete Job
              </button>
            </div>
          )}
        </div>

        <div className="flex items-start justify-between mb-6 pl-8">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-yellow-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
              <FileText className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900 leading-tight group-hover:text-yellow-500 transition-colors mb-1 line-clamp-2">
                {job.title}
              </h3>
              <p className="text-sm font-medium text-gray-400">
                {new Date(job.created_at).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short'
                })}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 flex-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 font-medium">Status</span>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${getStatusColor(job.status)}`}>
              {getStatusIcon(job.status)}
              {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 font-medium">Document</span>
            <a
              href={job.file_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-yellow-600 font-semibold truncate max-w-[150px] hover:underline"
              title={`Download ${job.file_name}`}
            >
              {job.file_name}
            </a>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-gray-50">
          <button className="w-full flex items-center justify-center gap-2 text-gray-600 hover:text-yellow-600 font-semibold text-sm transition-colors group/btn">
            <span>View Details</span>
            <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {showDetails && (
        <JobDetails job={job} onClose={() => setShowDetails(false)} />
      )}
    </>
  );
}
