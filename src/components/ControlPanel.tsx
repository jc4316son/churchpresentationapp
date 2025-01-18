import React, { useEffect, useCallback } from 'react';
import { ExternalLink, Play, X } from 'lucide-react';
import { usePresentationStore } from '../store/presentationStore';
import type { Song, SongSegment } from '../types';

export function ControlPanel() {
  const { 
    currentSong, 
    currentSegment, 
    queue, 
    setCurrentSong, 
    setCurrentSegment, 
    removeFromQueue,
    setPresentationWindow
  } = usePresentationStore();

  const sendToPresentationWindow = useCallback((data: any) => {
    const presentationWindow = usePresentationStore.getState().presentationWindow;
    if (presentationWindow && !presentationWindow.closed) {
      console.log('Sending to presentation window:', data);
      presentationWindow.postMessage({
        type: 'presentationUpdate',
        data
      }, window.location.origin);
    }
  }, []);

  const openPresentationWindow = useCallback(() => {
    // Close existing window if any
    const existingWindow = usePresentationStore.getState().presentationWindow;
    if (existingWindow && !existingWindow.closed) {
      existingWindow.close();
    }

    // Get the current URL's origin
    const origin = window.location.origin;
    const presentationUrl = `${origin}/present`;

    // Open in a new window with specific dimensions
    const width = Math.min(1024, window.screen.width);
    const height = Math.min(768, window.screen.height);
    const left = Math.max(0, (window.screen.width - width) / 2);
    const top = Math.max(0, (window.screen.height - height) / 2);

    const newWindow = window.open(
      presentationUrl,
      'presentation',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (newWindow) {
      newWindow.focus();
      setPresentationWindow(newWindow);

      // Send current state when presentation window is ready
      const handlePresentationReady = (event: MessageEvent) => {
        // Only accept messages from our origin
        if (event.origin !== origin) return;
        
        if (event.data?.type === 'presentationReady') {
          console.log('Presentation window ready, sending initial state');
          sendToPresentationWindow({
            song: currentSong,
            segment: currentSegment
          });
        }
      };

      window.addEventListener('message', handlePresentationReady);

      // Clean up event listener when window closes
      const checkWindow = setInterval(() => {
        if (newWindow.closed) {
          console.log('Presentation window closed');
          window.removeEventListener('message', handlePresentationReady);
          clearInterval(checkWindow);
          setPresentationWindow(null);
        }
      }, 1000);
    } else {
      console.warn('Failed to open presentation window');
    }
  }, [currentSong, currentSegment, setPresentationWindow, sendToPresentationWindow]);

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      const presentationWindow = usePresentationStore.getState().presentationWindow;
      if (presentationWindow && !presentationWindow.closed) {
        presentationWindow.close();
        setPresentationWindow(null);
      }
    };
  }, [setPresentationWindow]);

  const handleSelectSong = useCallback((song: Song) => {
    setCurrentSong(song);
    if (song.segments && song.segments.length > 0) {
      setCurrentSegment(song.segments[0]);
    }
  }, [setCurrentSong, setCurrentSegment]);

  const handleSelectSegment = useCallback((segment: SongSegment) => {
    setCurrentSegment(segment);
  }, [setCurrentSegment]);

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-8">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Current Presentation</h2>
            <button
              onClick={openPresentationWindow}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <ExternalLink className="w-4 h-4" />
              Open Presentation Window
            </button>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            {currentSong ? (
              <div>
                <h3 className="text-lg font-medium mb-4">{currentSong.title}</h3>
                
                {/* Segments Grid */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {currentSong.segments.sort((a, b) => a.order_num - b.order_num).map((segment) => (
                    <button
                      key={segment.id}
                      onClick={() => handleSelectSegment(segment)}
                      className={`p-4 rounded-lg text-left transition-colors ${
                        currentSegment?.id === segment.id
                          ? 'bg-indigo-100 border-2 border-indigo-500'
                          : 'bg-white hover:bg-indigo-50'
                      }`}
                    >
                      <div className="text-sm font-medium text-gray-500 mb-1">
                        {segment.type} {segment.order_num}
                      </div>
                      <div className="text-gray-800 line-clamp-3">
                        {segment.content}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Current Segment Display */}
                <div className="bg-white rounded-lg p-6 shadow-sm">
                  <div className="text-sm font-medium text-gray-500 mb-2">
                    {currentSegment?.type} {currentSegment?.order_num}
                  </div>
                  <div className="text-xl leading-relaxed whitespace-pre-line">
                    {currentSegment?.content || 'Select a segment to display'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[300px] text-gray-500">
                <Play className="w-12 h-12 mb-2" />
                <p>No song selected</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="col-span-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Queue</h2>
          </div>

          <div className="space-y-2">
            {queue.map((song) => (
              <div
                key={song.id}
                className="group p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
              >
                <div className="flex justify-between items-center">
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => handleSelectSong(song)}
                  >
                    <h4 className="font-medium">{song.title}</h4>
                    <p className="text-sm text-gray-500">{song.author}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {song.segments.length} segments
                    </p>
                  </div>
                  <button
                    onClick={() => removeFromQueue(song.id)}
                    className="opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-700 transition-opacity"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}

            {queue.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No songs in queue
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}