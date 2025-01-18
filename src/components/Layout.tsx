import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Church, MonitorPlay, Music, Settings } from 'lucide-react';

export function Layout() {
  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-white shadow-md">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-8">
            <Church className="w-8 h-8 text-indigo-600" />
            <span className="text-xl font-semibold">Worship Present</span>
          </div>
          
          <nav className="space-y-2">
            <Link
              to="/"
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-indigo-50 text-gray-700 hover:text-indigo-600"
            >
              <MonitorPlay className="w-5 h-5" />
              Control Panel
            </Link>
            <Link
              to="/songs"
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-indigo-50 text-gray-700 hover:text-indigo-600"
            >
              <Music className="w-5 h-5" />
              Song Library
            </Link>
            <Link
              to="/settings"
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-indigo-50 text-gray-700 hover:text-indigo-600"
            >
              <Settings className="w-5 h-5" />
              Settings
            </Link>
          </nav>
        </div>
      </aside>
      
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}