import { useCallback, useState, useEffect } from 'react';
import { Person } from '../types';
import { getDatabase } from '../services/rxdb';

export const usePeopleActions = (
  setProjects: any,
  activeProjectId: string,
  isOfflineMode: boolean,
  supabaseClient: any
) => {
  const [db, setDb] = useState<any>(null);
  useEffect(() => { getDatabase().then(setDb); }, []);

  const addPerson = useCallback(async (name: string, email?: string, phone?: string) => {
    if (!db || !activeProjectId) return;
    await db.people.insert({
        id: crypto.randomUUID(),
        project_id: activeProjectId,
        name,
        email,
        phone,
        initials: name.slice(0,2).toUpperCase(),
        color: 'bg-indigo-500',
        updated_at: new Date().toISOString()
    });
  }, [db, activeProjectId]);

  const updatePerson = useCallback(async (id: string, updates: Partial<Person>) => {
    if (!db) return;
    const person = await db.people.findOne(id).exec();
    if (person) {
        // Map camelCase TS properties to snake_case RxDB properties
        // and avoid spreading to prevent "additionalProperties: false" validation errors (VD2)
        const mapped: any = { updated_at: new Date().toISOString() };
        
        if (updates.name !== undefined) mapped.name = updates.name;
        if (updates.email !== undefined) mapped.email = updates.email;
        if (updates.phone !== undefined) mapped.phone = updates.phone;
        if (updates.initials !== undefined) mapped.initials = updates.initials;
        if (updates.color !== undefined) mapped.color = updates.color;
        
        await person.patch(mapped);
    }
  }, [db]);

  const removePerson = useCallback(async (id: string) => {
    if (!db) return;
    const person = await db.people.findOne(id).exec();
    if (person) await person.patch({ deleted_at: new Date().toISOString() });
  }, [db]);

  return { addPerson, updatePerson, removePerson };
};