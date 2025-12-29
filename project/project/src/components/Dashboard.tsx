import { useState } from 'react';
import { useAuth } from '../contexts/auth-utils';
import { LogOut, Plus, FileText, Clock } from 'lucide-react';
import CreateJob from './CreateJob';
import History from './History';

export default function Dashboard() {
  const { signOut, user } = useAuth();
  const [showCreateJob, setShowCreateJob] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'history'>('dashboard');

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">AI Resume Matcher</h1>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative overflow-hidden">
        {/* Decorative background visual */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-yellow-50 to-transparent -z-10 pointer-events-none" />

        {currentView === 'history' ? (
          <History onBack={() => setCurrentView('dashboard')} />
        ) : (
          <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="text-center space-y-6 max-w-3xl mx-auto">
              <h2 className="text-5xl font-extrabold text-gray-900 tracking-tight leading-tight">
                Recruitment <span className="text-yellow-500">Reimagined</span>
              </h2>
              <p className="text-xl text-gray-600 leading-relaxed">
                Streamline your hiring process with AI-powered resume matching.
                Upload job descriptions and find the perfect candidates in seconds.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              <button
                onClick={() => setShowCreateJob(true)}
                className="group relative bg-white p-10 rounded-3xl premium-shadow border border-yellow-100 hover-elevate text-left"
              >
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Plus className="w-32 h-32 text-yellow-500 rotate-12" />
                </div>
                <div className="w-16 h-16 bg-yellow-50 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                  <Plus className="w-8 h-8 text-yellow-500" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-yellow-500 transition-colors">Post a New Job</h3>
                <p className="text-lg text-gray-500 leading-relaxed font-medium">
                  Create a new detailed listing and let our AI start matching candidates immediately.
                </p>
              </button>

              <button
                onClick={() => setCurrentView('history')}
                className="group relative bg-white p-10 rounded-3xl premium-shadow border border-gray-100 hover-elevate text-left"
              >
                <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Clock className="w-32 h-32 text-gray-900 rotate-12" />
                </div>
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                  <Clock className="w-8 h-8 text-gray-900" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-yellow-500 transition-colors">History & Archives</h3>
                <p className="text-lg text-gray-500 leading-relaxed font-medium">
                  Access your complete posting history, review past matches, and manage your data.
                </p>
              </button>
            </div>
          </div>
        )}
      </main>

      {showCreateJob && (
        <CreateJob
          onClose={() => setShowCreateJob(false)}
          onSuccess={() => {
            setShowCreateJob(false);
            setCurrentView('history');
          }}
        />
      )}
    </div>
  );
}
