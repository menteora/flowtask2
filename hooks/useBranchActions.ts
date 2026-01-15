
import { useCallback } from 'react';
import { Branch, BranchStatus } from '../types';
import { persistenceService } from '../services/persistence';

export const useBranchActions = (
  setProjects: any,
  activeProjectId: string,
  isOfflineMode: boolean,
  supabaseClient: any
) => {
  const applyBranchUpdate = useCallback(async (branchId: string, updates: Partial<Branch>, state: any) => {
      const updatedBranches = { ...state.branches };
      if (!updatedBranches[branchId]) return state;
      
      const updatedBranch = { 
        ...updatedBranches[branchId], 
        ...updates, 
        version: (updatedBranches[branchId].version || 1) + 1,
        updatedAt: new Date().toISOString()
      };
      
      updatedBranches[branchId] = updatedBranch;
      const newState = { ...state, branches: updatedBranches };
      
      await persistenceService.saveBranch(state.id, updatedBranch, isOfflineMode, supabaseClient, newState);
      return newState;
  }, [isOfflineMode, supabaseClient]);

  const addBranch = useCallback(async (parentId: string) => {
    setProjects((prev: any[]) => prev.map(p => {
        if (p.id !== activeProjectId) return p;
        
        const newId = crypto.randomUUID();
        const parent = p.branches[parentId];
        if (!parent) return p;

        let title = 'Nuovo Ramo';
        let newSprintCounter = parent.sprintCounter;

        if (parent.type === 'sprint') {
            const counter = parent.sprintCounter || 1;
            title = `${parent.title} ${new Date().getFullYear().toString().slice(-2)}-${String(counter).padStart(2, '0')}`;
            newSprintCounter = counter + 1;
        }

        // Calculate sibling index by searching all branches for current parent
        const siblingCount = Object.values(p.branches).filter((b: any) => b.parentIds?.includes(parentId)).length;

        const newBranch: Branch = {
            id: newId,
            title,
            status: BranchStatus.PLANNED,
            type: 'standard', // DEFAULT
            tasks: [],
            parentIds: [parentId],
            position: siblingCount,
            version: 1,
            updatedAt: new Date().toISOString()
        };

        const updatedBranches = { ...p.branches };
        updatedBranches[newId] = newBranch;
        
        // Update parent only if sprint counter changed
        if (newSprintCounter !== parent.sprintCounter) {
            updatedBranches[parentId] = {
                ...parent,
                sprintCounter: newSprintCounter,
                updatedAt: new Date().toISOString()
            };
        }

        const newState = { ...p, branches: updatedBranches };
        
        persistenceService.saveBranch(p.id, newBranch, isOfflineMode, supabaseClient, newState);
        if (newSprintCounter !== parent.sprintCounter) {
            persistenceService.saveBranch(p.id, updatedBranches[parentId], isOfflineMode, supabaseClient, newState);
        }
        
        return newState;
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const updateBranch = useCallback(async (branchId: string, updates: Partial<Branch>) => {
    setProjects((prev: any[]) => prev.map(p => {
        if (p.id !== activeProjectId) return p;
        const branch = p.branches[branchId];
        if (!branch) return p;

        const updatedBranch = { 
          ...branch, 
          ...updates, 
          version: (branch.version || 1) + 1,
          updatedAt: new Date().toISOString()
        };

        const updatedBranches = { ...p.branches, [branchId]: updatedBranch };
        const newState = { ...p, branches: updatedBranches };
        
        persistenceService.saveBranch(p.id, updatedBranch, isOfflineMode, supabaseClient, newState);
        return newState;
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const moveBranch = useCallback(async (branchId: string, direction: 'prev' | 'next') => {
    setProjects((prev: any[]) => prev.map(p => {
        if (p.id !== activeProjectId) return p;
        const branch = p.branches[branchId];
        if (!branch || !branch.parentIds[0]) return p;
        
        const parentId = branch.parentIds[0];
        // Fix: Explicitly cast to Branch[] to avoid 'unknown' type error and access properties correctly
        const siblings = (Object.values(p.branches) as Branch[])
            .filter((b: Branch) => b.parentIds?.includes(parentId))
            .sort((a: Branch, b: Branch) => (a.position ?? 0) - (b.position ?? 0));
            
        const idx = siblings.findIndex(b => b.id === branchId);
        const targetIdx = direction === 'prev' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= siblings.length) return p;

        const targetBranch = siblings[targetIdx];
        const newPos = targetBranch.position;
        const oldPos = branch.position;

        const updatedBranch = { ...branch, position: newPos, version: (branch.version || 1) + 1, updatedAt: new Date().toISOString() };
        const updatedTarget = { ...targetBranch, position: oldPos, version: (targetBranch.version || 1) + 1, updatedAt: new Date().toISOString() };
        
        const updatedBranches = { ...p.branches, [branch.id]: updatedBranch, [targetBranch.id]: updatedTarget };
        const newState = { ...p, branches: updatedBranches };
        
        persistenceService.saveBranch(p.id, updatedBranch, isOfflineMode, supabaseClient, newState);
        persistenceService.saveBranch(p.id, updatedTarget, isOfflineMode, supabaseClient, newState);
        return newState;
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const deleteBranch = useCallback(async (branchId: string) => {
    setProjects((prev: any[]) => prev.map(p => {
        if (p.id !== activeProjectId) return p;
        const updatedBranches = { ...p.branches };
        delete updatedBranches[branchId];
        
        const newState = { ...p, branches: updatedBranches };
        persistenceService.deleteBranch(branchId, isOfflineMode, supabaseClient, newState);
        return newState;
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const toggleBranchArchive = useCallback(async (branchId: string) => {
      // Find branch and toggle its archive state
      setProjects((prev: any[]) => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          const b = p.branches[branchId];
          if (!b) return p;
          // Incrementa la versione per triggerare l'UPDATE invece dell'UPSERT nel persistence engine
          const updated = { ...b, archived: !b.archived, version: (b.version || 1) + 1, updatedAt: new Date().toISOString() };
          const newState = { ...p, branches: { ...p.branches, [branchId]: updated } };
          persistenceService.saveBranch(p.id, updated, isOfflineMode, supabaseClient, newState);
          return newState;
      }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const linkBranch = useCallback(async (childId: string, parentId: string) => {
      setProjects((prev: any[]) => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          const child = p.branches[childId];
          if (!child) return p;

          const updatedChild = { 
              ...child, 
              parentIds: Array.from(new Set([...child.parentIds, parentId])),
              version: (child.version || 1) + 1,
              updatedAt: new Date().toISOString()
          };
          
          const updatedBranches = { ...p.branches, [childId]: updatedChild };
          const newState = { ...p, branches: updatedBranches };

          persistenceService.saveBranch(p.id, updatedChild, isOfflineMode, supabaseClient, newState);
          return newState;
      }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const unlinkBranch = useCallback(async (childId: string, parentId: string) => {
      setProjects((prev: any[]) => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          const child = p.branches[childId];
          if (!child) return p;

          const updatedChild = { 
              ...child, 
              parentIds: child.parentIds.filter(id => id !== parentId),
              version: (child.version || 1) + 1,
              updatedAt: new Date().toISOString()
          };
          
          const updatedBranches = { ...p.branches, [childId]: updatedChild };
          const newState = { ...p, branches: updatedBranches };

          persistenceService.saveBranch(p.id, updatedChild, isOfflineMode, supabaseClient, newState);
          return newState;
      }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  return { addBranch, updateBranch, moveBranch, deleteBranch, linkBranch, unlinkBranch, toggleBranchArchive };
};
