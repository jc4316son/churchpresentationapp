export interface User {
  id: string;
  email: string;
  churchId: string;
  role: 'admin' | 'editor' | 'viewer';
  created_at: string;
}

export interface Church {
  id: string;
  name: string;
  logo_url?: string;
  theme: {
    primary_color: string;
    secondary_color: string;
  };
  created_at: string;
}

export interface Song {
  id: string;
  title: string;
  author: string;
  churchId: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  segments: SongSegment[];
}

export interface SongSegment {
  id: string;
  songId: string;
  type: 'verse' | 'chorus' | 'bridge' | 'pre-chorus';
  order: number;
  content: string;
  created_at: string;
}