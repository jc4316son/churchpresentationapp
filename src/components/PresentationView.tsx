import React, { useEffect, useState, useCallback } from 'react';
import { socketService } from '../lib/socket';
import type { Song, SongSegment } from '../types';

export function PresentationView() {
  const [isConnected, setIsConnected] = useState(false);
  const [localSong, setLocalSong] = useState<Song | null>(null);
  const [localSegment, setLocalSegment] = useState<SongSegment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  const handleUpdate = useCallback((data: any) => {
    try {
      if (!data) return;
      console.log('Received update:', data);
      if ('song' in data) setLocalSong(data.song);
      if ('segment' in data) setLocalSegment(data.segment);
    } catch (error) {
      console.error('Error handling update:', error);
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    setIsConnected(false);
    setError('Connection lost. Attempting to reconnect...');
  }, []);

  const handleReconnect = useCallback(() => {
    setIsConnected(true);
    setError(null);
    setRetryCount(0);
  }, []);

  const notifyParentWindow = useCallback(() => {
    try {
      if (window.opener && window.opener !== window) {
        window.opener.postMessage(
          { 
            type: 'presentationReady', 
            id: socketService.getId() 
          },
          window.location.origin
        );
      }
    } catch (error) {
      console.error('Error notifying parent window:', error);
    }
  }, []);

  const setupPresentation = useCallback(async () => {
    if (!document.hasFocus()) {
      console.log('Window not focused, deferring setup');
      return;
    }

    try {
      // Only attempt connection if not already connected
      if (!socketService.isConnected()) {
        console.log('Connecting to socket server...');
        await socketService.connect();
      }

      console.log('Registering as presentation window...');
      await socketService.registerPresentation();
      
      setIsConnected(true);
      setError(null);
      setRetryCount(0);
      
      // Notify parent window after successful setup
      notifyParentWindow();
    } catch (error) {
      console.error('Setup error:', error);
      setIsConnected(false);
      setError('Connection failed. Retrying...');

      setRetryCount(prev => {
        const newCount = prev + 1;
        if (newCount < maxRetries) {
          // Exponential backoff with max delay of 10 seconds
          const delay = Math.min(1000 * Math.pow(2, newCount), 10000);
          setTimeout(setupPresentation, delay);
        } else {
          setError('Failed to connect after multiple attempts. Please refresh the page.');
        }
        return newCount;
      });
    }
  }, [notifyParentWindow]);

  useEffect(() => {
    let mounted = true;
    let retryTimeout: number | null = null;
    let focusCheckInterval: number | null = null;

    const setup = async () => {
      try {
        // Set up event listeners
        const removeUpdateHandler = socketService.onUpdate(handleUpdate);
        const removeDisconnectHandler = socketService.onDisconnect(handleDisconnect);
        const removeReconnectHandler = socketService.onReconnect(handleReconnect);

        // Handle fullscreen
        const handleClick = () => {
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(console.error);
          }
        };

        window.addEventListener('click', handleClick);

        // Initial setup if window has focus
        if (mounted && document.hasFocus()) {
          await setupPresentation();
        }

        // Periodically check window focus and connection status
        focusCheckInterval = window.setInterval(() => {
          if (document.hasFocus() && !socketService.isConnected() && mounted) {
            console.log('Checking connection status...');
            setupPresentation().catch(console.error);
          }
        }, 5000);

        // Handle window messages
        const handleMessage = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          if (event.data?.type === 'presentationUpdate') {
            handleUpdate(event.data.data);
          }
        };

        window.addEventListener('message', handleMessage);

        return () => {
          if (mounted) {
            removeUpdateHandler();
            removeDisconnectHandler();
            removeReconnectHandler();
            window.removeEventListener('click', handleClick);
            window.removeEventListener('message', handleMessage);
          }
        };
      } catch (error) {
        console.error('Setup error:', error);
        if (mounted) {
          setError('Failed to initialize presentation. Please refresh the page.');
        }
      }
    };

    setup();

    // Handle window focus events
    const handleFocus = () => {
      if (!socketService.isConnected() && mounted) {
        console.log('Window focused, checking connection...');
        setupPresentation().catch(console.error);
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && !socketService.isConnected() && mounted) {
        console.log('Page visible, checking connection...');
        setupPresentation().catch(console.error);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup function
    return () => {
      mounted = false;
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (retryTimeout !== null) {
        window.clearTimeout(retryTimeout);
      }
      
      if (focusCheckInterval !== null) {
        window.clearInterval(focusCheckInterval);
      }
      
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(console.error);
      }
      
      socketService.disconnect();
    };
  }, [handleUpdate, handleDisconnect, handleReconnect, setupPresentation]);

  if (error) {
    return (
      <div className="h-screen bg-red-50 flex items-center justify-center">
        <div className="text-center max-w-md p-8 bg-white rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Connection Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          {retryCount >= maxRetries && (
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Refresh Page
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="h-screen bg-indigo-50 flex items-center justify-center">
        <div className="text-center max-w-md p-8 bg-white rounded-lg shadow-lg">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-indigo-600 mb-4">Connecting...</h2>
          <p className="text-gray-600">
            Establishing connection to control panel...
          </p>
        </div>
      </div>
    );
  }

  if (!localSong || !localSegment) {
    return (
      <div className="h-screen bg-black flex items-center justify-center text-white">
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Present</h2>
          <p className="text-xl text-gray-400">Click anywhere to enter fullscreen mode</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black text-white flex items-center justify-center p-8">
      <div className="text-center max-w-4xl">
        <h1 className="text-5xl font-bold mb-8">{localSong.title}</h1>
        <p className="text-3xl leading-relaxed whitespace-pre-line">
          {localSegment.content}
        </p>
        <div className="absolute bottom-8 right-8 text-gray-500 text-sm">
          {localSegment.type} {localSegment.order_num}
        </div>
      </div>
    </div>
  );
}