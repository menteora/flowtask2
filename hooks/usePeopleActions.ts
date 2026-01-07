
import { useCallback } from 'react';
import { Person } from '../types';
import { persistenceService } from '../services/persistence';

export const usePeopleActions = (
  setProjects: any,
  activeProjectId: string,
  isOfflineMode: boolean,
  supabaseClient: any
) => {
  const addPerson = useCallback(async (name: string, email?: string, phone?: string) => {
    setProjects((prev: any[]) => prev.map(p => {
        if (p.id !== activeProjectId) return p;
        const newPerson: Person = {
            id: crypto.randomUUID(),
            name,
            email,
            phone,
            initials: name.slice(0, 2).toUpperCase(),
            color: 'bg-indigo-500',
            version: 1,
            updatedAt: new Date().toISOString()
        };
        const updatedPeople = [...p.people, newPerson];
        const newState = { ...p, people: updatedPeople };
        persistenceService.savePerson(p.id, newPerson, isOfflineMode, supabaseClient, newState);
        return newState;
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const updatePerson = useCallback(async (id: string, updates: Partial<Person>) => {
    setProjects((prev: any[]) => prev.map(p => {
        if (p.id !== activeProjectId) return p;
        const updatedPeople = p.people.map(person => {
            if (person.id === id) {
                const updated = { ...person, ...updates, version: (person.version || 1) + 1, updatedAt: new Date().toISOString() };
                persistenceService.savePerson(p.id, updated, isOfflineMode, supabaseClient, p);
                return updated;
            }
            return person;
        });
        return { ...p, people: updatedPeople };
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  const removePerson = useCallback(async (id: string) => {
    setProjects((prev: any[]) => prev.map(p => {
        if (p.id !== activeProjectId) return p;
        const filteredPeople = p.people.filter(person => person.id !== id);
        const newState = { ...p, people: filteredPeople };
        persistenceService.deletePerson(id, isOfflineMode, supabaseClient, newState);
        return newState;
    }));
  }, [activeProjectId, isOfflineMode, supabaseClient, setProjects]);

  return { addPerson, updatePerson, removePerson };
};
