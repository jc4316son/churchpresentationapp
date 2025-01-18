import React, { useState, useEffect } from 'react';
import { Plus, Search, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase, handleSupabaseError } from '../lib/supabase';
import { usePresentationStore } from '../store/presentationStore';
import type { Song } from '../types';

export function SongLibrary() {
  const navigate = useNavigate();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { addToQueue } = usePresentationStore();

  useEffect(() => {
    loadSongs();
  }, []);

  async function loadSongs() {
    setLoading(true);
    setError(null);

    try {
      // First check if we have a valid session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) {
        navigate('/login', { replace: true });
        return;
      }

      // Get user's church_id with error handling
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('church_id')
        .eq('id', session.user.id)
        .maybeSingle(); // Use maybeSingle instead of single to avoid PGRST116

      if (userError) throw userError;
      
      if (!userData) {
        // User exists in auth but not in users table - needs to complete registration
        navigate('/register', { replace: true });
        return;
      }

      if (!userData.church_id) {
        throw new Error('No church associated with your account. Please complete registration.');
      }

      // Load songs with their segments
      const { data: songsData, error: songsError } = await supabase
        .from('songs')
        .select(`
          id,
          title,
          author,
          church_id,
          created_by,
          created_at,
          updated_at,
          segments:song_segments (
            id,
            type,
            order_num,
            content
          )
        `)
        .eq('church_id', userData.church_id)
        .order('title', { ascending: true });

      if (songsError) throw songsError;

      // Transform and validate the data
      const transformedSongs = songsData?.map(song => ({
        ...song,
        segments: (song.segments || []).sort((a, b) => a.order_num - b.order_num)
      })) || [];

      setSongs(transformedSongs);
    } catch (error) {
      const errorMessage = handleSupabaseError(error);
      setError(errorMessage);
      
      // If it's an auth error, redirect to login
      if (error?.message?.includes('JWT') || 
          error?.message?.includes('session') || 
          error?.message?.includes('authentication')) {
        navigate('/login', { replace: true });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Song Library</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          Add New Song
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-md">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
            <p className="text-red-700">{error}</p>
          </div>
          <button
            onClick={loadSongs}
            className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
          >
            Try Again
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search songs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-2 text-gray-500">Loading songs...</p>
          </div>
        ) : songs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No songs found. Add your first song to get started!
          </div>
        ) : (
          <div className="space-y-4">
            {songs
              .filter(song => 
                song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                song.author.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((song) => (
                <div
                  key={song.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100"
                >
                  <div>
                    <h3 className="font-medium">{song.title}</h3>
                    <p className="text-sm text-gray-500">{song.author}</p>
                  </div>
                  <button
                    onClick={() => addToQueue(song)}
                    className="text-indigo-600 hover:text-indigo-800"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}