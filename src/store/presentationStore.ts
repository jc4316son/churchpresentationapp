import { create } from 'zustand';
import { socketService } from '../lib/socket';
import type { Song, SongSegment } from '../types';

interface PresentationState {
  currentSong: Song | null;
  currentSegment: SongSegment | null;
  queue: Song[];
  isPresenting: boolean;
  presentationWindow: Window | null;
  setCurrentSong: (song: Song | null) => void;
  setCurrentSegment: (segment: SongSegment | null) => void;
  addToQueue: (song: Song) => void;
  removeFromQueue: (songId: string) => void;
  setIsPresenting: (presenting: boolean) => void;
  setPresentationWindow: (window: Window | null) => void;
}

export const usePresentationStore = create<PresentationState>((set, get) => ({
  currentSong: null,
  currentSegment: null,
  queue: [],
  isPresenting: false,
  presentationWindow: null,
  setCurrentSong: (song) => {
    set({ currentSong: song });
    socketService.sendUpdate({ song });
  },
  setCurrentSegment: (segment) => {
    set({ currentSegment: segment });
    socketService.sendUpdate({ segment });
  },
  addToQueue: (song) => set((state) => {
    if (state.queue.some(s => s.id === song.id)) {
      return state;
    }
    return { queue: [...state.queue, song] };
  }),
  removeFromQueue: (songId) =>
    set((state) => {
      const newState = {
        queue: state.queue.filter((s) => s.id !== songId),
      };
      
      if (state.currentSong?.id === songId) {
        newState.currentSong = null;
        newState.currentSegment = null;
        socketService.sendUpdate({ song: null, segment: null });
      }
      
      return newState;
    }),
  setIsPresenting: (presenting) => set({ isPresenting: presenting }),
  setPresentationWindow: (window) => set({ presentationWindow: window })
}));