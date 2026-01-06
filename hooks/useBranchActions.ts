import { useCallback, useState, useEffect } from 'react';
import { ProjectState, Branch, BranchStatus } from '../types';
import { getDatabase } from '../services/rxdb';

export const useBranchActions = (
  setProjects: any,
  activeProjectId: string,
  isOfflineMode: boolean,
  supabaseClient: any
) => {
  const [db, setDb] = useState<any>(null);
  useEffect(() => { getDatabase().then(setDb); }, []);

  const addBranch = useCallback(async (parentId: string) => {
    if (!db || !activeProjectId) return;
    const newId = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const parentDoc = await db.branches.findOne(parentId).exec();
    if (!parentDoc) return;

    const parentData = parentDoc.toJSON();
    let title = 'Nuovo Ramo';
    let newSprintCounter = parentData.sprint_counter;

    if (parentData.is_sprint) {
        const counter = parentData.sprint_counter || 1;
        title = `${parentData.title} ${new Date().getFullYear().toString().slice(-2)}-${String(counter).padStart(2, '0')}`;
        newSprintCounter = counter + 1;
    }

    // 1. Create the new child branch
    await db.branches.insert({
        id: newId,
        project_id: activeProjectId,
        title,
        status: BranchStatus.PLANNED,
        parent_ids: [parentId],
        children_ids: [],
        position: (parentData.children_ids || []).length,
        updated_at: now,
        version: 1
    });

    // 2. Update the parent branch ONCE to avoid revision conflicts
    const parentUpdates: any = {
        children_ids: [...(parentData.children_ids || []), newId],
        updated_at: now
    };

    if (parentData.is_sprint) {
        parentUpdates.sprint_counter = newSprintCounter;
    }

    await parentDoc.patch(parentUpdates);
    
  }, [db, activeProjectId]);

  const updateBranch = useCallback(async (branchId: string, updates: Partial<Branch>) => {
    if (!db) return;
    const doc = await db.branches.findOne(branchId).exec();
    if (doc) {
        // Map camelCase TS properties to snake_case RxDB properties
        // and avoid spreading to prevent "additionalProperties: false" validation errors (VD2)
        const mapped: any = { updated_at: new Date().toISOString() };
        
        if (updates.title !== undefined) mapped.title = updates.title;
        if (updates.description !== undefined) mapped.description = updates.description;
        if (updates.status !== undefined) mapped.status = updates.status;
        if (updates.archived !== undefined) mapped.archived = updates.archived;
        if (updates.collapsed !== undefined) mapped.collapsed = updates.collapsed;
        if (updates.position !== undefined) mapped.position = updates.position;
        
        if (updates.responsibleId !== undefined) mapped.responsible_id = updates.responsibleId;
        if (updates.startDate !== undefined) mapped.start_date = updates.startDate;
        if (updates.endDate !== undefined) mapped.end_date = updates.endDate;
        if (updates.dueDate !== undefined) mapped.due_date = updates.dueDate;
        if (updates.isLabel !== undefined) mapped.is_label = updates.isLabel;
        if (updates.isSprint !== undefined) mapped.is_sprint = updates.isSprint;
        if (updates.sprintCounter !== undefined) mapped.sprint_counter = updates.sprintCounter;
        
        if (updates.parentIds !== undefined) mapped.parent_ids = updates.parentIds;
        if (updates.childrenIds !== undefined) mapped.children_ids = updates.childrenIds;
        
        await doc.patch(mapped);
    }
  }, [db]);

  const moveBranch = useCallback(async (branchId: string, direction: 'prev' | 'next') => {
    if (!db) return;
    const branch = await db.branches.findOne(branchId).exec();
    if (!branch) return;
    
    const branchData = branch.toJSON();
    if (!branchData.parent_ids || branchData.parent_ids.length === 0) return;
    
    const parentId = branchData.parent_ids[0];
    const parent = await db.branches.findOne(parentId).exec();
    if (!parent) return;

    const parentData = parent.toJSON();
    const newChildrenIds = [...(parentData.children_ids || [])];
    const idx = newChildrenIds.indexOf(branchId);
    const targetIdx = direction === 'prev' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= newChildrenIds.length) return;

    [newChildrenIds[idx], newChildrenIds[targetIdx]] = [newChildrenIds[targetIdx], newChildrenIds[idx]];
    await parent.patch({ children_ids: newChildrenIds, updated_at: new Date().toISOString() });
  }, [db]);

  const deleteBranch = useCallback(async (branchId: string) => {
    if (!db) return;
    const branch = await db.branches.findOne(branchId).exec();
    if (!branch) return;
    await branch.patch({ deleted_at: new Date().toISOString() });
  }, [db]);

  const toggleBranchArchive = useCallback(async (branchId: string) => {
    if (!db) return;
    const branch = await db.branches.findOne(branchId).exec();
    if (branch) await branch.patch({ archived: !branch.archived, updated_at: new Date().toISOString() });
  }, [db]);

  const linkBranch = useCallback(async (childId: string, parentId: string) => {
    if (!db || childId === parentId) return;
    const child = await db.branches.findOne(childId).exec();
    const parent = await db.branches.findOne(parentId).exec();
    if (!child || !parent) return;

    const childData = child.toJSON();
    const parentData = parent.toJSON();

    await child.patch({ 
        parent_ids: Array.from(new Set([...(childData.parent_ids || []), parentId])), 
        updated_at: new Date().toISOString() 
    });
    await parent.patch({ 
        children_ids: Array.from(new Set([...(parentData.children_ids || []), childId])), 
        updated_at: new Date().toISOString() 
    });
  }, [db]);

  const unlinkBranch = useCallback(async (childId: string, parentId: string) => {
    if (!db) return;
    const child = await db.branches.findOne(childId).exec();
    const parent = await db.branches.findOne(parentId).exec();
    if (!child || !parent) return;

    const childData = child.toJSON();
    const parentData = parent.toJSON();

    await child.patch({ 
        parent_ids: (childData.parent_ids || []).filter((id: string) => id !== parentId), 
        updated_at: new Date().toISOString() 
    });
    await parent.patch({ 
        children_ids: (parentData.children_ids || []).filter((id: string) => id !== childId), 
        updated_at: new Date().toISOString() 
    });
  }, [db]);

  return { addBranch, updateBranch, moveBranch, deleteBranch, linkBranch, unlinkBranch, toggleBranchArchive };
};