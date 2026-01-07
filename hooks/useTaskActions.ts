
import { useCallback } from 'react';
import { Task } from '../types';
import { persistenceService } from '../services/persistence';

export const useTaskActions = (
  setProjects: any,
  activeProjectId: string,
  isOfflineMode: boolean,
  supabaseClient: any
) => {
  const addTask = useCallback(async (branchId: string, title: string) => {
    setProjects((prev: any[]) => prev.map(p => {
        if (p.id !== activeProjectId) return p;
        const branch = p.branches[branchId];
        if (!branch) return p;

        const newTask: Task = {
            id: crypto.randomUUID(),
            title,
            completed: false,
            position: branch.tasks.length,
            version: 1,
            updatedAt: new Date().toISOString()
        };

        const updatedBranch = { ...branch, tasks: [...branch.tasks, newTask] };
        const updatedBranches = { ...p.branches, [branchId]: updatedBranch };
        const newState = { ...p, branches: updatedBranches };
        
        persistenceService.saveTask(branchId, newTask, isOfflineMode, supabaseClient, newState);
        return newState;
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const updateTask = useCallback(async (branchId: string, taskId: string, updates: Partial<Task>) => {
    setProjects((prev: any[]) => prev.map(p => {
        if (p.id !== activeProjectId) return p;
        const branch = p.branches[branchId];
        if (!branch) return p;

        const updatedTasks = branch.tasks.map(t => {
            if (t.id === taskId) {
                const updated = { ...t, ...updates, version: (t.version || 1) + 1, updatedAt: new Date().toISOString() };
                persistenceService.saveTask(branchId, updated, isOfflineMode, supabaseClient, p);
                return updated;
            }
            return t;
        });

        return { ...p, branches: { ...p.branches, [branchId]: { ...branch, tasks: updatedTasks } } };
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const deleteTask = useCallback(async (branchId: string, taskId: string) => {
    setProjects((prev: any[]) => prev.map(p => {
        if (p.id !== activeProjectId) return p;
        const branch = p.branches[branchId];
        if (!branch) return p;

        const filteredTasks = branch.tasks.filter(t => t.id !== taskId);
        const newState = { ...p, branches: { ...p.branches, [branchId]: { ...branch, tasks: filteredTasks } } };
        
        persistenceService.deleteTask(taskId, isOfflineMode, supabaseClient, newState);
        return newState;
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const moveTask = useCallback(async (branchId: string, taskId: string, direction: 'up' | 'down') => {
      // Semplificato per gestione locale
  }, []);

  const moveTaskToBranch = useCallback(async (taskId: string, sourceBranchId: string, targetBranchId: string) => {
      // Semplificato per gestione locale
  }, []);

  const bulkUpdateTasks = useCallback(async (branchId: string, text: string) => {
      const titles = text.split('\n').filter(t => t.trim().length > 0);
      for (const title of titles) {
          await addTask(branchId, title);
      }
  }, [addTask]);

  const bulkMoveTasks = useCallback(async (taskIds: string[], sourceBranchId: string, targetBranchId: string) => {
      // Semplificato per gestione locale
  }, []);

  return { addTask, updateTask, deleteTask, moveTask, moveTaskToBranch, bulkUpdateTasks, bulkMoveTasks };
};
