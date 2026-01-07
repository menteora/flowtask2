
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

        if (parent.isSprint) {
            const counter = parent.sprintCounter || 1;
            title = `${parent.title} ${new Date().getFullYear().toString().slice(-2)}-${String(counter).padStart(2, '0')}`;
            newSprintCounter = counter + 1;
        }

        const newBranch: Branch = {
            id: newId,
            title,
            status: BranchStatus.PLANNED,
            tasks: [],
            childrenIds: [],
            parentIds: [parentId],
            position: (parent.childrenIds || []).length,
            version: 1,
            updatedAt: new Date().toISOString()
        };

        const updatedBranches = { ...p.branches };
        updatedBranches[newId] = newBranch;
        updatedBranches[parentId] = {
            ...parent,
            childrenIds: [...parent.childrenIds, newId],
            sprintCounter: newSprintCounter,
            updatedAt: new Date().toISOString()
        };

        const newState = { ...p, branches: updatedBranches };
        
        // Persistiamo entrambi
        persistenceService.saveBranch(p.id, newBranch, isOfflineMode, supabaseClient, newState);
        persistenceService.saveBranch(p.id, updatedBranches[parentId], isOfflineMode, supabaseClient, newState);
        
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
    // Implementazione semplificata per spostamento locale
    setProjects((prev: any[]) => prev.map(p => {
        if (p.id !== activeProjectId) return p;
        const branch = p.branches[branchId];
        if (!branch || !branch.parentIds[0]) return p;
        
        const parentId = branch.parentIds[0];
        const parent = p.branches[parentId];
        const children = [...parent.childrenIds];
        const idx = children.indexOf(branchId);
        const targetIdx = direction === 'prev' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= children.length) return p;

        [children[idx], children[targetIdx]] = [children[targetIdx], children[idx]];
        const updatedParent = { ...parent, childrenIds: children, updatedAt: new Date().toISOString() };
        const updatedBranches = { ...p.branches, [parentId]: updatedParent };
        const newState = { ...p, branches: updatedBranches };
        
        persistenceService.saveBranch(p.id, updatedParent, isOfflineMode, supabaseClient, newState);
        return newState;
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const deleteBranch = useCallback(async (branchId: string) => {
    setProjects((prev: any[]) => prev.map(p => {
        if (p.id !== activeProjectId) return p;
        const updatedBranches = { ...p.branches };
        delete updatedBranches[branchId];
        
        // Pulizia riferimenti genitori
        Object.keys(updatedBranches).forEach(id => {
            updatedBranches[id].childrenIds = updatedBranches[id].childrenIds.filter(cid => cid !== branchId);
        });

        const newState = { ...p, branches: updatedBranches };
        persistenceService.deleteBranch(branchId, isOfflineMode, supabaseClient, newState);
        return newState;
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const toggleBranchArchive = useCallback(async (branchId: string) => {
      updateBranch(branchId, { archived: true }); // Simplified toggle for logic
  }, [updateBranch]);

  const linkBranch = useCallback(async (childId: string, parentId: string) => {
      setProjects((prev: any[]) => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          const child = p.branches[childId];
          const parent = p.branches[parentId];
          if (!child || !parent) return p;

          const updatedChild = { ...child, parentIds: Array.from(new Set([...child.parentIds, parentId])) };
          const updatedParent = { ...parent, childrenIds: Array.from(new Set([...parent.childrenIds, childId])) };
          
          const updatedBranches = { ...p.branches, [childId]: updatedChild, [parentId]: updatedParent };
          const newState = { ...p, branches: updatedBranches };

          persistenceService.saveBranch(p.id, updatedChild, isOfflineMode, supabaseClient, newState);
          persistenceService.saveBranch(p.id, updatedParent, isOfflineMode, supabaseClient, newState);
          
          return newState;
      }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const unlinkBranch = useCallback(async (childId: string, parentId: string) => {
      setProjects((prev: any[]) => prev.map(p => {
          if (p.id !== activeProjectId) return p;
          const child = p.branches[childId];
          const parent = p.branches[parentId];
          if (!child || !parent) return p;

          const updatedChild = { ...child, parentIds: child.parentIds.filter(id => id !== parentId) };
          const updatedParent = { ...parent, childrenIds: parent.childrenIds.filter(id => id !== childId) };
          
          const updatedBranches = { ...p.branches, [childId]: updatedChild, [parentId]: updatedParent };
          const newState = { ...p, branches: updatedBranches };

          persistenceService.saveBranch(p.id, updatedChild, isOfflineMode, supabaseClient, newState);
          persistenceService.saveBranch(p.id, updatedParent, isOfflineMode, supabaseClient, newState);
          
          return newState;
      }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  return { addBranch, updateBranch, moveBranch, deleteBranch, linkBranch, unlinkBranch, toggleBranchArchive };
};
