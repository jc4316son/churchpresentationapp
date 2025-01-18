import React, { useState, useEffect } from 'react';
import { Settings, Users, Image, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Church, User } from '../types';

export function ChurchSettings() {
  const [church, setChurch] = useState<Partial<Church>>({
    name: '',
    theme: {
      primary_color: '#4F46E5',
      secondary_color: '#818CF8'
    }
  });
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'admin' | 'editor' | 'viewer'>('viewer');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadChurchData();
    loadTeamMembers();
  }, []);

  async function loadChurchData() {
    try {
      const { data: churchData, error } = await supabase
        .from('churches')
        .select('*')
        .limit(1);

      if (error) throw error;
      if (churchData && churchData.length > 0) {
        setChurch(churchData[0]);
      }
    } catch (error) {
      console.error('Error loading church data:', error);
    }
  }

  async function loadTeamMembers() {
    try {
      const { data: members, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (members) setTeamMembers(members);
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  }

  async function handleChurchUpdate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      let result;
      
      if (church.id) {
        // Update existing church
        result = await supabase
          .from('churches')
          .update({
            name: church.name,
            theme: church.theme
          })
          .eq('id', church.id);
      } else {
        // Create new church
        result = await supabase
          .from('churches')
          .insert([{
            name: church.name,
            theme: church.theme
          }])
          .select();
      }

      if (result.error) throw result.error;
      
      if (result.data?.[0]) {
        setChurch(result.data[0]);
      }
      
      setMessage(church.id ? 'Church settings updated successfully!' : 'Church created successfully!');
      loadChurchData(); // Reload to get the latest data
    } catch (error) {
      console.error('Error updating church:', error);
      setMessage('Failed to update church settings.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddTeamMember(e: React.FormEvent) {
    e.preventDefault();
    if (!church.id) {
      setMessage('Please save church settings first before adding team members.');
      return;
    }
    
    setLoading(true);
    setMessage('');

    try {
      // Generate a temporary password
      const tempPassword = Math.random().toString(36).slice(-8);
      
      // Create the user with sign up
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: newMemberEmail,
        password: tempPassword,
        options: {
          emailRedirectTo: `${window.location.origin}/login`
        }
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('Failed to create user');

      // Create the user record
      const { error: userError } = await supabase
        .from('users')
        .insert([{
          id: authData.user.id,
          email: newMemberEmail,
          role: newMemberRole,
          church_id: church.id
        }]);

      if (userError) throw userError;
      
      setNewMemberEmail('');
      loadTeamMembers();
      setMessage(`Team member invited successfully! They will receive an email to confirm their account.`);
    } catch (error) {
      console.error('Error adding team member:', error);
      setMessage('Failed to add team member. They may already have an account.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveTeamMember(userId: string) {
    if (!confirm('Are you sure you want to remove this team member?')) return;
    
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) throw error;
      loadTeamMembers();
      setMessage('Team member removed successfully!');
    } catch (error) {
      console.error('Error removing team member:', error);
      setMessage('Failed to remove team member.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Church Settings</h1>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${message.includes('Failed') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleChurchUpdate}>
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-medium">General Settings</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Church Name
                </label>
                <input
                  type="text"
                  value={church.name}
                  onChange={(e) => setChurch({ ...church, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Primary Color
                </label>
                <input
                  type="color"
                  value={church.theme?.primary_color}
                  onChange={(e) => setChurch({
                    ...church,
                    theme: { ...church.theme!, primary_color: e.target.value }
                  })}
                  className="mt-1 block w-full h-10 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? 'Saving...' : (church.id ? 'Save Settings' : 'Create Church')}
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-2 mb-4">
            <Image className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-medium">Branding</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Church Logo
              </label>
              <div className="mt-1 flex items-center">
                <div className="h-32 w-32 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <button 
                    type="button"
                    className="text-sm text-gray-600 hover:text-indigo-600"
                    onClick={() => alert('Logo upload functionality coming soon!')}
                  >
                    Upload Logo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 md:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-medium">Team Members</h2>
          </div>
          
          <form onSubmit={handleAddTeamMember} className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="col-span-2">
                <input
                  type="email"
                  placeholder="Email address"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  required
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={newMemberRole}
                  onChange={(e) => setNewMemberRole(e.target.value as 'admin' | 'editor' | 'viewer')}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  type="submit"
                  disabled={loading || !church.id}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>
          </form>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {teamMembers.map((member) => (
                  <tr key={member.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {member.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                        ${member.role === 'admin' ? 'bg-red-100 text-red-800' : 
                          member.role === 'editor' ? 'bg-green-100 text-green-800' : 
                          'bg-gray-100 text-gray-800'}`}>
                        {member.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleRemoveTeamMember(member.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}