// Added Task, ProjectState, Branch types for proper typing of entities
import { useCallback } from 'react';
import { Task, ProjectState, Branch } from '../types';
import { persistenceService } from '../services/persistence';

export const useTaskActions = (
  setProjects: any,
  activeProjectId: string,
  isOfflineMode: boolean,
  supabaseClient: any
) => {
  const addTask = useCallback(async (branchId: string, title: string) => {
    // Explicitly typing prev as ProjectState[] ensures spreads target valid object types
    setProjects((prev: ProjectState[]) => prev.map(p => {
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
    // Explicitly typing prev as ProjectState[] ensures spreads target valid object types
    setProjects((prev: ProjectState[]) => {
        const projectIndex = prev.findIndex(p => p.id === activeProjectId);
        if (projectIndex === -1) return prev;

        const currentProject = prev[projectIndex];
        const branch = currentProject.branches[branchId];
        if (!branch) return prev;

        let taskToSave: Task | null = null;
        const updatedTasks = branch.tasks.map(t => {
            if (t.id === taskId) {
                // LOGICA CENTRALIZZATA COMPLETAMENTO
                const finalUpdates = { ...updates };
                
                // Se lo stato di completamento sta cambiando
                if (updates.completed !== undefined && updates.completed !== t.completed) {
                    if (updates.completed) {
                        // Se non è stata fornita una data specifica (es. dal DatePicker manuale), usa NOW
                        finalUpdates.completedAt = updates.completedAt || new Date().toISOString();
                    } else {
                        finalUpdates.completedAt = undefined;
                    }
                }

                taskToSave = { 
                    ...t, 
                    ...finalUpdates, 
                    version: (t.version || 1) + 1, 
                    updatedAt: new Date().toISOString() 
                };
                return taskToSave;
            }
            return t;
        });

        if (!taskToSave) return prev;

        const newProjectState = { 
            ...currentProject, 
            branches: { 
                ...currentProject.branches, 
                [branchId]: { ...branch, tasks: updatedTasks } 
            } 
        };

        // Persistenza
        persistenceService.saveTask(branchId, taskToSave, isOfflineMode, supabaseClient, newProjectState);

        const newProjects = [...prev];
        newProjects[projectIndex] = newProjectState;
        return newProjects;
    });
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const deleteTask = useCallback(async (branchId: string, taskId: string) => {
    // Explicitly typing prev as ProjectState[] ensures spreads target valid object types
    setProjects((prev: ProjectState[]) => prev.map(p => {
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
      // Explicitly typing prev as ProjectState[] ensures spreads target valid object types
      setProjects((prev: ProjectState[]) => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          const branch = p.branches[branchId];
          if (!branch) return p;

          const tasks = [...branch.tasks];
          const idx = tasks.findIndex(t => t.id === taskId);
          if (idx === -1) return p;
          
          const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
          if (targetIdx < 0 || targetIdx >= tasks.length) return p;

          // Swap positions
          [tasks[idx], tasks[targetIdx]] = [tasks[targetIdx], tasks[idx]];
          
          // Re-index position property
          const reindexedTasks = tasks.map((t, i) => ({ ...t, position: i }));
          const newState = { ...p, branches: { ...p.branches, [branchId]: { ...branch, tasks: reindexedTasks } } };
          
          // Salvataggio semplificato (offline-first salva tutto il progetto)
          persistenceService.saveProject(newState, isOfflineMode, supabaseClient);
          
          return newState;
      }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const moveTaskToBranch = useCallback(async (taskId: string, sourceBranchId: string, targetBranchId: string) => {
      // Explicitly typing prev as ProjectState[] ensures spreads target valid object types
      setProjects((prev: ProjectState[]) => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          const sourceBranch = p.branches[sourceBranchId];
          const targetBranch = p.branches[targetBranchId];
          if (!sourceBranch || !targetBranch) return p;

          const taskToMove = sourceBranch.tasks.find(t => t.id === taskId);
          if (!taskToMove) return p;

          const newSourceTasks = sourceBranch.tasks.filter(t => t.id !== taskId);
          const newTargetTasks = [...targetBranch.tasks, { ...taskToMove, position: targetBranch.tasks.length }];

          const newState = {
              ...p,
              branches: {
                  ...p.branches,
                  [sourceBranchId]: { ...sourceBranch, tasks: newSourceTasks },
                  [targetBranchId]: { ...targetBranch, tasks: newTargetTasks }
              }
          };

          persistenceService.saveProject(newState, isOfflineMode, supabaseClient);
          return newState;
      }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const bulkUpdateTasks = useCallback(async (branchId: string, text: string) => {
      const titles = text.split('\n').filter(t => t.trim().length > 0);
      // Explicitly typing prev as ProjectState[] ensures spreads target valid object types
      setProjects((prev: ProjectState[]) => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          const branch = p.branches[branchId];
          if (!branch) return p;

          // Manteniamo i task esistenti che sono ancora nel testo, aggiungiamo i nuovi
          const existingMap = new Map(branch.tasks.map(t => [t.title, t]));
          const newTasks: Task[] = titles.map((title, idx) => {
              const existing = existingMap.get(title);
              if (existing) return { ...existing, position: idx };
              return {
                  id: crypto.randomUUID(),
                  title,
                  completed: false,
                  position: idx,
                  version: 1,
                  updatedAt: new Date().toISOString()
              };
          });

          const newState = { ...p, branches: { ...p.branches, [branchId]: { ...branch, tasks: newTasks } } };
          persistenceService.saveProject(newState, isOfflineMode, supabaseClient);
          return newState;
      }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const bulkMoveTasks = useCallback(async (taskIds: string[], sourceBranchId: string, targetBranchId: string) => {
      // Explicitly typing prev as ProjectState[] ensures spreads target valid object types, resolving errors on spread lines
      setProjects((prev: ProjectState[]) => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          const sourceBranch = p.branches[sourceBranchId];
          const targetBranch = p.branches[targetBranchId];
          if (!sourceBranch || !targetBranch) return p;

          const tasksToMove = sourceBranch.tasks.filter(t => taskIds.includes(t.id));
          const remainingSourceTasks = sourceBranch.tasks.filter(t => !taskIds.includes(t.id));
          const newTargetTasks = [...targetBranch.tasks, ...tasksToMove.map((t, i) => ({ ...t, position: targetBranch.tasks.length + i }))];

          const newState: ProjectState = {
              ...p,
              branches: {
                  ...p.branches,
                  [sourceBranchId]: { ...sourceBranch, tasks: remainingSourceTasks },
                  [targetBranchId]: { ...targetBranch, tasks: newTargetTasks }
              }
          };

          persistenceService.saveProject(newState, isOfflineMode, supabaseClient);
          return newState;
      }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  return { addTask, updateTask, deleteTask, moveTask, moveTaskToBranch, bulkUpdateTasks, bulkMoveTasks };
};
