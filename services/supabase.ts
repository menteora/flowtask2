

import { SupabaseClient } from '@supabase/supabase-js';
import { ProjectState, Branch, Task, Person, BranchStatus, BranchType } from '../types';

export const supabaseService = {
  async fetchProjects(client: SupabaseClient) {
    return client.from('flowtask_projects').select('*').is('deleted_at', null);
  },

  async fetchBranches(client: SupabaseClient) {
    // We fetch all branches the user owns (via project root filtering later)
    return client.from('flowtask_branches').select('*').is('deleted_at', null).order('position', { ascending: true });
  },

  async softDeleteProject(client: SupabaseClient, id: string) {
    return client.from('flowtask_projects').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  },

  async softDeleteBranch(client: SupabaseClient, id: string) {
    return client.from('flowtask_branches').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  },

  async softDeleteTask(client: SupabaseClient, id: string) {
    return client.from('flowtask_tasks').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  },

  async softDeletePerson(client: SupabaseClient, id: string) {
    return client.from('flowtask_people').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  },

  /**
   * Gestisce l'inserimento o l'aggiornamento con controllo della concorrenza.
   */
  async upsertEntity(client: SupabaseClient, table: string, payload: any) {
    const { version, id, updatedAt, deletedAt, isDirty, ...rest } = payload;
    
    // Filtriamo i campi undefined per evitare errori PostgREST 400
    const cleanRest = Object.fromEntries(
        Object.entries(rest).filter(([_, v]) => v !== undefined)
    );

    if (payload.deleted_at) {
        return client.from(table).update({ 
            deleted_at: payload.deleted_at, 
            version: (version || 1) + 1 
        }).eq('id', id);
    }

    if (version && version > 1) {
      const previousVersion = version - 1;
      
      const { data, error } = await client
        .from(table)
        .update({ 
            ...cleanRest, 
            version: version 
        })
        .eq('id', id)
        .eq('version', previousVersion) 
        .select();

      if (error) return { error };
      
      if (!data || data.length === 0) {
        return { error: { message: 'CONCURRENCY_CONFLICT', details: 'Il record è stato modificato da un altro utente o dispositivo.' } };
      }
      
      return { data };
    }

    return client.from(table).upsert({ ...cleanRest, id, version: version || 1 });
  },

  async downloadFullProject(client: SupabaseClient, id: string): Promise<ProjectState> {
    const { data: p, error: pErr } = await client.from('flowtask_projects').select('*').eq('id', id).is('deleted_at', null).single();
    if (pErr) throw pErr;

    // To find all branches of a project, we fetch all branches and filter locally based on the parentIds path
    // For large databases, we'd use a postgres array contains query: parent_ids ? ANY
    // But since project_id is removed, we rely on parent_ids containing the project_id somewhere.
    // However, the rule is roots have parent_ids = [projectId].
    
    // For now, let's fetch all branches. 
    // Optimization: In a real app, we'd filter branches where 'parent_ids' includes the project ID for roots,
    // and then recursively find descendants. Since we are refactoring, we'll fetch all.
    const [peopleRes, branchesRes] = await Promise.all([
      client.from('flowtask_people').select('*').eq('project_id', id).is('deleted_at', null),
      client.from('flowtask_branches').select('*').is('deleted_at', null).order('position', { ascending: true })
    ]);

    // Filter branches that belong to this project tree
    const allBranches = branchesRes.data || [];
    const projectBranchesList: any[] = [];
    const branchIdsInProject = new Set<string>();

    const findBranchesRecursive = (parentId: string) => {
        const children = allBranches.filter(b => b.parent_ids?.includes(parentId));
        children.forEach(c => {
            if (!branchIdsInProject.has(c.id)) {
                branchIdsInProject.add(c.id);
                projectBranchesList.push(c);
                findBranchesRecursive(c.id);
            }
        });
    };

    // Start from root project ID
    findBranchesRecursive(id);

    const branchIds = projectBranchesList.map(b => b.id);
    let tasksRes: any[] = [];
    if (branchIds.length > 0) {
        const { data } = await client.from('flowtask_tasks')
          .select('*')
          .in('branch_id', branchIds)
          .is('deleted_at', null)
          .order('position', { ascending: true });
        tasksRes = data || [];
    }

    const people: Person[] = (peopleRes.data || []).map(p => ({
      id: p.id, name: p.name, email: p.email, phone: p.phone, initials: p.initials, color: p.color, 
      version: p.version || 1, updatedAt: p.updated_at
    }));

    const branches: Record<string, Branch> = {};
    projectBranchesList.forEach(b => {
      const bTasks = tasksRes
        .filter(t => t.branch_id === b.id)
        .map(t => ({
          id: t.id, title: t.title, description: t.description, completed: t.completed,
          completedAt: t.completed_at, assigneeId: t.assignee_id, dueDate: t.due_date, pinned: t.pinned || false,
          position: t.position || 0, version: t.version || 1, updatedAt: t.updated_at
        }));

      branches[b.id] = {
        id: b.id, title: b.title, description: b.description, status: b.status as BranchStatus,
        color: b.color,
        type: (b.type || 'standard') as BranchType,
        tasks: bTasks, parentIds: b.parent_ids || [],
        startDate: b.start_date, endDate: b.end_date, dueDate: b.due_date,
        archived: b.archived, collapsed: b.collapsed,
        sprintCounter: b.sprint_counter || 1,
        responsibleId: b.responsible_id, position: b.position || 0, version: b.version || 1, updatedAt: b.updated_at
      };
    });

    return { id: p.id, name: p.name, branches, people, version: p.version || 1, updatedAt: p.updated_at };
  },

  async uploadFullProject(client: SupabaseClient, project: ProjectState, userId: string) {
    await this.upsertEntity(client, 'flowtask_projects', {
      id: project.id, name: project.name, owner_id: userId, version: project.version
    });

    for (const person of project.people) {
      await this.upsertEntity(client, 'flowtask_people', { ...person, project_id: project.id });
    }

    for (const b of Object.values(project.branches)) {
      await this.upsertEntity(client, 'flowtask_branches', {
          id: b.id, title: b.title, description: b.description, status: b.status, color: b.color,
          type: b.type,
          start_date: b.startDate, end_date: b.endDate, due_date: b.dueDate, archived: b.archived,
          collapsed: b.collapsed, sprint_counter: b.sprintCounter || 1, 
          parent_ids: b.parentIds,
          responsible_id: b.responsibleId, position: b.position || 0, version: b.version
      });

      for (const t of b.tasks) {
        // Fix: Use correct property names from Task type (assigneeId and completedAt)
        await this.upsertEntity(client, 'flowtask_tasks', {
          id: t.id, branch_id: b.id, title: t.title, description: t.description, assignee_id: t.assigneeId,
          due_date: t.dueDate, completed: t.completed, completed_at: t.completedAt, position: t.position || 0, pinned: t.pinned || false, version: t.version
        });
      }
    }
  }
};