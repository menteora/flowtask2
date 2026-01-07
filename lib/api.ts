
import { supabase } from './supabase';

export const api = {
  // Auth
  async register(username: string, email: string, pass: string) {
    if (!supabase) throw new Error("Supabase client not initialized");
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
      options: {
        data: { username }
      }
    });
    if (error) throw error;
    return data;
  },

  // Projects
  async fetchProjects() {
    if (!supabase) return [];
    try {
        const { data, error } = await supabase
          .from('flowtask_projects')
          .select('*')
          .is('deleted_at', null);
        if (error) return [];
        return data || [];
    } catch (e) {
        return [];
    }
  },

  async createProject(name: string, rootBranchId: string) {
    if (!supabase) throw new Error("Supabase client not initialized");
    const { data, error } = await supabase
      .from('flowtask_projects')
      .insert([{ name, root_branch_id: rootBranchId }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
