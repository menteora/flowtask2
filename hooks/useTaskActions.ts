
import { useCallback } from 'react';
import { Task, ProjectState, BranchStatus } from '../types';
import { persistenceService } from '../services/persistence';

export const useTaskActions = (
  setProjects: any,
  activeProjectId: string,
  isOfflineMode: boolean,
  supabaseClient: any,
  userId?: string
) => {
  const addTask = useCallback(async (branchId: string, title: string) => {
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

  const duplicateTask = useCallback(async (branchId: string, taskId: string) => {
    setProjects((prev: ProjectState[]) => prev.map(p => {
        if (p.id !== activeProjectId) return p;
        const branch = p.branches[branchId];
        if (!branch) return p;

        const originalTask = branch.tasks.find(t => t.id === taskId);
        if (!originalTask) return p;

        // Logica titolo intelligente: gestisce (1), (2), (3)...
        const titleRegex = /^(.*) \((\d+)\)$/;
        const match = originalTask.title.match(titleRegex);
        let newTitle = "";
        
        if (match) {
            const baseTitle = match[1];
            const num = parseInt(match[2], 10);
            newTitle = `${baseTitle} (${num + 1})`;
        } else {
            newTitle = `${originalTask.title} (1)`;
        }

        const newTask: Task = {
            ...originalTask,
            id: crypto.randomUUID(),
            title: newTitle,
            completed: false, // La copia è sempre aperta
            completedAt: undefined,
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
    setProjects((prev: ProjectState[]) => {
        const projectIndex = prev.findIndex(p => p.id === activeProjectId);
        if (projectIndex === -1) return prev;

        const currentProject = prev[projectIndex];
        const branch = currentProject.branches[branchId];
        if (!branch) return prev;

        let taskToSave: Task | null = null;
        let branchToUpdate: any = null;

        const updatedTasks = branch.tasks.map(t => {
            if (t.id === taskId) {
                const finalUpdates = { ...updates };
                const isNowCompleted = updates.completed === true && !t.completed;

                if (updates.completed !== undefined && updates.completed !== t.completed) {
                    if (updates.completed) {
                        finalUpdates.completedAt = updates.completedAt || new Date().toISOString();
                        
                        // LOGICA AUTO-ATTIVAZIONE RAMO E DATA INIZIO
                        if (branch.status === BranchStatus.PLANNED) {
                            branchToUpdate = {
                                ...branch,
                                status: BranchStatus.ACTIVE,
                                // Imposta la data di inizio solo se è vuota
                                startDate: branch.startDate || new Date().toISOString().split('T')[0],
                                version: (branch.version || 1) + 1,
                                updatedAt: new Date().toISOString()
                            };
                        }
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

        const updatedBranches = { 
            ...currentProject.branches, 
            [branchId]: { 
              ...branch, 
              tasks: updatedTasks, 
              ...(branchToUpdate ? { status: branchToUpdate.status, startDate: branchToUpdate.startDate, version: branchToUpdate.version, updatedAt: branchToUpdate.updatedAt } : {}) 
            } 
        };

        const newProjectState = { 
            ...currentProject, 
            branches: updatedBranches
        };

        // Persistenza Task
        persistenceService.saveTask(branchId, taskToSave, isOfflineMode, supabaseClient, newProjectState);
        
        // Persistenza Ramo (se attivato automaticamente)
        if (branchToUpdate) {
            persistenceService.saveBranch(currentProject.id, branchToUpdate, isOfflineMode, supabaseClient, newProjectState);
        }

        const newProjects = [...prev];
        newProjects[projectIndex] = newProjectState;
        return newProjects;
    });
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const deleteTask = useCallback(async (branchId: string, taskId: string) => {
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
      setProjects((prev: ProjectState[]) => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          const branch = p.branches[branchId];
          if (!branch) return p;

          const tasks = [...branch.tasks];
          const idx = tasks.findIndex(t => t.id === taskId);
          if (idx === -1) return p;
          
          const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
          if (targetIdx < 0 || targetIdx >= tasks.length) return p;

          [tasks[idx], tasks[targetIdx]] = [tasks[targetIdx], tasks[idx]];
          
          const reindexedTasks = tasks.map((t, i) => ({ 
              ...t, 
              position: i,
              version: (t.version || 1) + 1,
              updatedAt: new Date().toISOString()
          }));

          const newState = { ...p, branches: { ...p.branches, [branchId]: { ...branch, tasks: reindexedTasks } } };
          persistenceService.saveTasks(branchId, reindexedTasks, isOfflineMode, supabaseClient, newState);
          return newState;
      }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const moveTaskToBranch = useCallback(async (taskId: string, sourceBranchId: string, targetBranchId: string) => {
      setProjects((prev: ProjectState[]) => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          const sourceBranch = p.branches[sourceBranchId];
          const targetBranch = p.branches[targetBranchId];
          if (!sourceBranch || !targetBranch) return p;

          const originalTask = sourceBranch.tasks.find(t => t.id === taskId);
          if (!originalTask) return p;

          const taskToMove: Task = { 
              ...originalTask, 
              position: targetBranch.tasks.length,
              version: (originalTask.version || 1) + 1,
              updatedAt: new Date().toISOString()
          };

          const newSourceTasks = sourceBranch.tasks.filter(t => t.id !== taskId);
          const newTargetTasks = [...targetBranch.tasks, taskToMove];

          const newState: ProjectState = {
              ...p,
              branches: {
                  ...p.branches,
                  [sourceBranchId]: { ...sourceBranch, tasks: newSourceTasks },
                  [targetBranchId]: { ...targetBranch, tasks: newTargetTasks }
              }
          };

          persistenceService.moveTasks(targetBranchId, [taskToMove], isOfflineMode, supabaseClient, newState);
          return newState;
      }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const bulkUpdateTasks = useCallback(async (branchId: string, text: string) => {
      const titles = text.split('\n').filter(t => t.trim().length > 0);
      setProjects((prev: ProjectState[]) => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          const branch = p.branches[branchId];
          if (!branch) return p;

          const existingMap = new Map(branch.tasks.map(t => [t.title, t]));
          const newTasks: Task[] = titles.map((title, idx) => {
              const existing = existingMap.get(title);
              if (existing) {
                  return { 
                    ...existing, 
                    position: idx, 
                    version: (existing.version || 1) + 1,
                    updatedAt: new Date().toISOString()
                  };
              }
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
          persistenceService.saveTasks(branchId, newTasks, isOfflineMode, supabaseClient, newState);
          return newState;
      }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const bulkMoveTasks = useCallback(async (taskIds: string[], sourceBranchId: string, targetBranchId: string) => {
      setProjects((prev: ProjectState[]) => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          const sourceBranch = p.branches[sourceBranchId];
          const targetBranch = p.branches[targetBranchId];
          if (!sourceBranch || !targetBranch) return p;

          const tasksToMove: Task[] = sourceBranch.tasks
              .filter(t => taskIds.includes(t.id))
              .map((t, i) => ({
                  ...t,
                  position: targetBranch.tasks.length + i,
                  version: (t.version || 1) + 1,
                  updatedAt: new Date().toISOString()
              }));

          const remainingSourceTasks = sourceBranch.tasks.filter(t => !taskIds.includes(t.id));
          const newTargetTasks = [...targetBranch.tasks, ...tasksToMove];

          const newState: ProjectState = {
              ...p,
              branches: {
                  ...p.branches,
                  [sourceBranchId]: { ...sourceBranch, tasks: remainingSourceTasks },
                  [targetBranchId]: { ...targetBranch, tasks: newTargetTasks }
              }
          };

          persistenceService.moveTasks(targetBranchId, tasksToMove, isOfflineMode, supabaseClient, newState);
          return newState;
      }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  return { addTask, duplicateTask, updateTask, deleteTask, moveTask, moveTaskToBranch, bulkUpdateTasks, bulkMoveTasks };
};
