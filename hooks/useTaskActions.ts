import { useCallback, useState, useEffect } from 'react';
import { Task } from '../types';
import { getDatabase } from '../services/rxdb';

export const useTaskActions = (
  setProjects: any,
  activeProjectId: string,
  isOfflineMode: boolean,
  supabaseClient: any
) => {
  const [db, setDb] = useState<any>(null);
  useEffect(() => { getDatabase().then(setDb); }, []);

  const addTask = useCallback(async (branchId: string, title: string) => {
    if (!db) return;
    const id = crypto.randomUUID();
    const branch = await db.branches.findOne(branchId).exec();
    const tasksCount = await db.tasks.count({ selector: { branch_id: branchId } }).exec();
    
    await db.tasks.insert({
        id,
        branch_id: branchId,
        title,
        completed: false,
        position: tasksCount,
        updated_at: new Date().toISOString()
    });
  }, [db]);

  const updateTask = useCallback(async (branchId: string, taskId: string, updates: Partial<Task>) => {
    if (!db) return;
    const task = await db.tasks.findOne(taskId).exec();
    if (task) {
        // Map camelCase TS properties to snake_case RxDB properties
        // and avoid spreading to prevent "additionalProperties: false" validation errors (VD2)
        const mapped: any = { updated_at: new Date().toISOString() };
        
        if (updates.title !== undefined) mapped.title = updates.title;
        if (updates.description !== undefined) mapped.description = updates.description;
        if (updates.completed !== undefined) mapped.completed = updates.completed;
        if (updates.position !== undefined) mapped.position = updates.position;
        if (updates.pinned !== undefined) mapped.pinned = updates.pinned;
        
        if (updates.assigneeId !== undefined) mapped.assignee_id = updates.assigneeId;
        if (updates.dueDate !== undefined) mapped.due_date = updates.dueDate;
        if (updates.completedAt !== undefined) mapped.completed_at = updates.completedAt;
        
        await task.patch(mapped);
    }
  }, [db]);

  const deleteTask = useCallback(async (branchId: string, taskId: string) => {
    if (!db) return;
    const task = await db.tasks.findOne(taskId).exec();
    if (task) await task.patch({ deleted_at: new Date().toISOString() });
  }, [db]);

  const moveTask = useCallback(async (branchId: string, taskId: string, direction: 'up' | 'down') => {
    if (!db) return;
    const tasks = await db.tasks.find({ selector: { branch_id: branchId, deleted_at: null }, sort: [{ position: 'asc' }] }).exec();
    const idx = tasks.findIndex((t: any) => t.id === taskId);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= tasks.length) return;

    const t1 = tasks[idx];
    const t2 = tasks[targetIdx];
    const p1 = t1.position;
    const p2 = t2.position;

    await t1.patch({ position: p2, updated_at: new Date().toISOString() });
    await t2.patch({ position: p1, updated_at: new Date().toISOString() });
  }, [db]);

  const moveTaskToBranch = useCallback(async (taskId: string, sourceBranchId: string, targetBranchId: string) => {
    if (!db) return;
    const task = await db.tasks.findOne(taskId).exec();
    if (task) {
        const count = await db.tasks.count({ selector: { branch_id: targetBranchId } }).exec();
        await task.patch({ branch_id: targetBranchId, position: count, updated_at: new Date().toISOString() });
    }
  }, [db]);

  const bulkUpdateTasks = useCallback(async (branchId: string, text: string) => {
    if (!db) return;
    const titles = text.split('\n').map(t => t.trim()).filter(t => t.length > 0);
    const now = new Date().toISOString();
    
    // Semplificazione: aggiungiamo solo i nuovi, non eliminiamo in questo esempio per sicurezza
    for (const title of titles) {
        const exists = await db.tasks.findOne({ selector: { branch_id: branchId, title, deleted_at: null } }).exec();
        if (!exists) {
            await addTask(branchId, title);
        }
    }
  }, [db, addTask]);

  const bulkMoveTasks = useCallback(async (taskIds: string[], sourceBranchId: string, targetBranchId: string) => {
    if (!db) return;
    for (const id of taskIds) {
        await moveTaskToBranch(id, sourceBranchId, targetBranchId);
    }
  }, [db, moveTaskToBranch]);

  return { addTask, updateTask, deleteTask, moveTask, moveTaskToBranch, bulkUpdateTasks, bulkMoveTasks };
};