
import { dbService } from './db';
import { supabaseService } from './supabase';
import { ProjectState, Branch, Task, Person } from '../types';
import { SupabaseClient } from '@supabase/supabase-js';

export const persistenceService = {
  // --- PROJECTS ---
  async saveProject(project: ProjectState, isOffline: boolean, client: SupabaseClient | null, userId?: string) {
    if (isOffline) {
      await dbService.saveProject(project);
    } else if (client && userId) {
      await supabaseService.uploadFullProject(client, project, userId);
    }
  },

  async deleteProject(projectId: string, isOffline: boolean, client: SupabaseClient | null) {
    if (isOffline) {
      await dbService.deleteProject(projectId);
    } else if (client) {
      await supabaseService.softDeleteProject(client, projectId);
    }
  },

  // --- BRANCHES ---
  async saveBranch(projectId: string, branch: Branch, isOffline: boolean, client: SupabaseClient | null, fullState: ProjectState) {
    if (isOffline) {
      await dbService.saveProject(fullState);
    } else if (client) {
      await supabaseService.upsertEntity(client, 'flowtask_branches', {
        id: branch.id,
        project_id: projectId,
        title: branch.title,
        description: branch.description,
        status: branch.status,
        responsible_id: branch.responsibleId,
        start_date: branch.startDate,
        end_date: branch.endDate,
        due_date: branch.dueDate,
        archived: branch.archived || false,
        collapsed: branch.collapsed || false,
        is_label: branch.isLabel || false,
        is_sprint: branch.isSprint || false,
        sprint_counter: branch.sprintCounter || 1,
        parent_ids: branch.parentIds || [],
        children_ids: branch.childrenIds || [],
        position: branch.position || 0,
        version: branch.version
      });
    }
  },

  async deleteBranch(branchId: string, isOffline: boolean, client: SupabaseClient | null, fullState: ProjectState) {
    if (isOffline) {
      await dbService.saveProject(fullState);
    } else if (client) {
      await supabaseService.softDeleteBranch(client, branchId);
    }
  },

  // --- TASKS ---
  async saveTask(branchId: string, task: Task, isOffline: boolean, client: SupabaseClient | null, fullState: ProjectState) {
    if (isOffline) {
      await dbService.saveProject(fullState);
    } else if (client) {
      await supabaseService.upsertEntity(client, 'flowtask_tasks', {
        id: task.id,
        branch_id: branchId,
        title: task.title,
        description: task.description,
        assignee_id: task.assigneeId,
        due_date: task.dueDate,
        completed: task.completed,
        completed_at: task.completedAt,
        position: task.position || 0,
        pinned: task.pinned || false,
        version: task.version
      });
    }
  },

  async deleteTask(taskId: string, isOffline: boolean, client: SupabaseClient | null, fullState: ProjectState) {
    if (isOffline) {
      await dbService.saveProject(fullState);
    } else if (client) {
      await supabaseService.softDeleteTask(client, taskId);
    }
  },

  // --- PEOPLE ---
  async savePerson(projectId: string, person: Person, isOffline: boolean, client: SupabaseClient | null, fullState: ProjectState) {
    if (isOffline) {
      await dbService.saveProject(fullState);
    } else if (client) {
      await supabaseService.upsertEntity(client, 'flowtask_people', {
        id: person.id,
        project_id: projectId,
        name: person.name,
        email: person.email,
        phone: person.phone,
        initials: person.initials,
        color: person.color,
        version: person.version
      });
    }
  },

  async deletePerson(personId: string, isOffline: boolean, client: SupabaseClient | null, fullState: ProjectState) {
    if (isOffline) {
      await dbService.saveProject(fullState);
    } else if (client) {
      await supabaseService.softDeletePerson(client, personId);
    }
  }
};
