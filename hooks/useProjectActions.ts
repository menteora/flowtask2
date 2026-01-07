
import React, { useCallback } from 'react';
import { ProjectState } from '../types';
import { createInitialProjectState } from '../constants';
import { FlowTaskDatabase } from '../services/rxdb';

export const useProjectActions = (
  db: FlowTaskDatabase | null,
  activeProjectId: string,
  setActiveProjectId: (id: string) => void,
) => {
  
  const createProject = useCallback(async () => {
    if (!db) return;
    const def = createInitialProjectState();
    const now = new Date().toISOString();
    
    // Inserimento progetto in RxDB
    await db.projects.insert({
        id: def.id,
        name: def.name,
        root_branch_id: def.rootBranchId,
        version: 1,
        updated_at: now
    });

    // Inserimento root branch in RxDB
    const rootBranch = def.branches[def.rootBranchId];
    await db.branches.insert({
        id: rootBranch.id,
        project_id: def.id,
        title: rootBranch.title,
        description: rootBranch.description,
        status: rootBranch.status,
        is_label: true,
        parent_ids: [],
        children_ids: [],
        position: 0,
        version: 1,
        updated_at: now
    });

    setActiveProjectId(def.id);
  }, [db, setActiveProjectId]);

  const renameProject = useCallback(async (name: string) => {
    if (!db || !activeProjectId) return;
    const doc = await db.projects.findOne(activeProjectId).exec();
    if (doc) {
        await doc.patch({ 
            name, 
            updated_at: new Date().toISOString() 
        });
    }
  }, [db, activeProjectId]);

  const deleteProject = useCallback(async (id: string) => {
    if (!db) return;
    if (confirm("Eliminare definitivamente questo progetto e tutti i suoi rami dal database locale?")) {
        const doc = await db.projects.findOne(id).exec();
        if (doc) {
            // Soft delete: segniamo come eliminato per la sincronizzazione
            await doc.patch({ deleted_at: new Date().toISOString() });
        }
    }
  }, [db]);

  return { createProject, deleteProject, renameProject };
};
