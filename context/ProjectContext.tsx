
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { ProjectState, Branch, Person, Task, BranchStatus } from '../types';
import { createInitialProjectState } from '../constants';
import { localStorageService } from '../services/localStorage';
import { dbService } from '../services/db';
import { supabaseService } from '../services/supabase';
import { persistenceService } from '../services/persistence';
import { createSupabaseClient, setGlobalSupabase } from '../lib/supabase';

interface UserProfile {
  id: string;
  username: string;
}

interface ProjectContextType {
  state: ProjectState;
  projects: ProjectState[];
  activeProjectId: string;
  setActiveProjectId: (id: string) => void;
  session: any;
  userProfile: UserProfile | null;
  isOfflineMode: boolean;
  loadingAuth: boolean;
  isInitializing: boolean;
  notification: { type: 'success' | 'error'; message: string } | null;
  supabaseConfig: { url: string; key: string };
  supabaseClient: SupabaseClient | null;
  setProjects: React.Dispatch<React.SetStateAction<ProjectState[]>>;

  switchProject: (id: string) => void;
  createProject: () => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  renameProject: (name: string) => Promise<void>;
  setSupabaseConfig: (url: string, key: string) => void;
  logout: () => Promise<void>;
  enableOfflineMode: () => void;
  disableOfflineMode: () => void;
  showNotification: (message: string, type: 'success' | 'error') => void;
  reorderProject: (id: string, direction: 'left' | 'right') => void;
  closeProject: (id: string) => void;
  loadProject: (json: any) => Promise<void>;
  uploadProjectToSupabase: () => Promise<void>;
  listProjectsFromSupabase: () => Promise<any[]>;
  getProjectBranchesFromSupabase: (id: string) => Promise<Branch[]>;
  moveLocalBranchToRemoteProject: (branchId: string, targetProjectId: string, targetParentId: string) => Promise<void>;
  downloadProjectFromSupabase: (id: string) => Promise<void>;
  deleteProjectFromSupabase: (id: string) => Promise<void>;
  exportAllToJSON: () => void;
  exportActiveProjectToJSON: () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

const LOADING_PROJECT: ProjectState = {
    id: 'loading',
    name: 'Caricamento...',
    rootBranchId: 'root',
    version: 1,
    people: [],
    branches: {
        'root': {
            id: 'root',
            title: 'Inizializzazione...',
            status: BranchStatus.PLANNED,
            type: 'standard',
            tasks: [],
            childrenIds: [],
            parentIds: [],
            version: 1
        }
    }
};

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showNotification = useCallback((message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const [supabaseConfig, setSupabaseConfigState] = useState(() => localStorageService.getSupabaseConfig());
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(() => localStorageService.getOfflineMode());
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);

  const [projects, setProjects] = useState<ProjectState[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');

  useEffect(() => {
    if (!isInitializing && projects.length > 0) {
      localStorageService.saveOpenProjectIds(projects.map(p => p.id));
    }
  }, [projects, isInitializing]);

  const setSupabaseConfig = useCallback((url: string, key: string) => {
    const config = { url, key };
    localStorageService.saveSupabaseConfig(config);
    setSupabaseConfigState(config);
    if (url && key) {
        const client = createSupabaseClient(url, key);
        setSupabaseClient(client);
        setGlobalSupabase(client);
    } else {
        setSupabaseClient(null);
    }
  }, []);

  useEffect(() => {
    if (supabaseConfig.url && supabaseConfig.key) {
      const client = createSupabaseClient(supabaseConfig.url, supabaseConfig.key);
      setSupabaseClient(client);
      setGlobalSupabase(client);
    } else {
      setLoadingAuth(false);
    }
  }, [supabaseConfig]);

  useEffect(() => {
    if (!supabaseClient) return;
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingAuth(false);
    });
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, [supabaseClient]);

  useEffect(() => {
    if (session?.user?.id) {
        const username = session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'Utente';
        setUserProfile({ id: session.user.id, username });
    } else {
      setUserProfile(null);
    }
  }, [session]);

  const loadAllData = useCallback(async () => {
    setIsInitializing(true);
    try {
      let loadedProjects: ProjectState[] = [];
      if (isOfflineMode) {
        await dbService.init();
        loadedProjects = await dbService.getAllProjects();
        if (loadedProjects.length === 0) {
          const def = createInitialProjectState("Il Mio Progetto Locale");
          await dbService.saveProject(def);
          loadedProjects = [def];
        }
      } else if (supabaseClient && session) {
        const { data: projs } = await supabaseService.fetchProjects(supabaseClient);
        if (projs && projs.length > 0) {
          loadedProjects = await Promise.all(projs.map(p => supabaseService.downloadFullProject(supabaseClient, p.id)));
        } else {
          const def = createInitialProjectState("Il Mio Progetto Cloud");
          await supabaseService.uploadFullProject(supabaseClient, def, session.user.id);
          loadedProjects = [def];
        }
      }

      const savedOrder = localStorageService.getOpenProjectIds();
      if (savedOrder.length > 0) {
        loadedProjects.sort((a, b) => {
          const indexA = savedOrder.indexOf(a.id);
          const indexB = savedOrder.indexOf(b.id);
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
      }

      setProjects(loadedProjects);
      const savedActiveId = localStorageService.getActiveProjectId();
      if (loadedProjects.length > 0) {
        if (savedActiveId && loadedProjects.some(p => p.id === savedActiveId)) {
          setActiveProjectId(savedActiveId);
        } else {
          setActiveProjectId(loadedProjects[0].id);
        }
      }
    } catch (err) {
      console.error("Error loading data:", err);
      showNotification("Errore nel caricamento dei dati.", "error");
    } finally {
      setIsInitializing(false);
    }
  }, [isOfflineMode, supabaseClient, session, showNotification]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const switchProject = useCallback((id: string) => {
      setActiveProjectId(id);
      localStorageService.saveActiveProjectId(id);
  }, []);

  const createProject = useCallback(async () => {
      const def = createInitialProjectState();
      await persistenceService.saveProject(def, isOfflineMode, supabaseClient, session?.user?.id);
      setProjects(prev => [...prev, def]);
      setActiveProjectId(def.id);
      showNotification("Progetto creato!", "success");
  }, [isOfflineMode, supabaseClient, session, showNotification]);

  const deleteProject = useCallback(async (id: string) => {
      if (confirm("Eliminare definitivamente?")) {
          await persistenceService.deleteProject(id, isOfflineMode, supabaseClient);
          setProjects(prev => {
              const filtered = prev.filter(p => p.id !== id);
              if (activeProjectId === id && filtered.length > 0) setActiveProjectId(filtered[0].id);
              return filtered;
          });
          showNotification("Progetto eliminato.", "success");
      }
  }, [isOfflineMode, supabaseClient, activeProjectId, showNotification, session]);

  const renameProject = useCallback(async (name: string) => {
      setProjects(prev => prev.map(p => {
          if (p.id === activeProjectId) {
              const updated = { ...p, name, updatedAt: new Date().toISOString() };
              persistenceService.saveProject(updated, isOfflineMode, supabaseClient, session?.user?.id);
              return updated;
          }
          return p;
      }));
  }, [activeProjectId, isOfflineMode, supabaseClient, session]);

  const reorderProject = useCallback((id: string, direction: 'left' | 'right') => {
      setProjects(prev => {
          const idx = prev.findIndex(p => p.id === id);
          if (idx === -1) return prev;
          const newIdx = direction === 'left' ? idx - 1 : idx + 1;
          if (newIdx < 0 || newIdx >= prev.length) return prev;
          const newArr = [...prev];
          [newArr[idx], newArr[newIdx]] = [newArr[newIdx], newArr[idx]];
          return newArr;
      });
  }, []);

  const closeProject = useCallback((id: string) => {
      setProjects(prev => {
          if (prev.length <= 1) return prev;
          const filtered = prev.filter(p => p.id !== id);
          if (activeProjectId === id) setActiveProjectId(filtered[0].id);
          return filtered;
      });
  }, [activeProjectId]);

  const loadProject = useCallback(async (json: any) => {
      try {
          if (!json.id || !json.name) throw new Error("JSON non valido");
          await persistenceService.saveProject(json, isOfflineMode, supabaseClient, session?.user?.id);
          setProjects(prev => [...prev.filter(p => p.id !== json.id), json]);
          setActiveProjectId(json.id);
          showNotification("Progetto importato!", "success");
      } catch (err) {
          showNotification("Errore importazione JSON.", "error");
      }
  }, [isOfflineMode, supabaseClient, session, showNotification]);

  const enableOfflineMode = useCallback(() => {
    setIsOfflineMode(true);
    localStorageService.saveOfflineMode(true);
  }, []);

  const disableOfflineMode = useCallback(() => {
    setIsOfflineMode(false);
    localStorageService.saveOfflineMode(false);
  }, []);

  const logout = useCallback(async () => {
    if (supabaseClient) {
        await supabaseClient.auth.signOut();
        setSession(null);
        setUserProfile(null);
        setProjects([]);
    }
  }, [supabaseClient]);

  const exportAllToJSON = useCallback(() => {
      const blob = new Blob([JSON.stringify(projects, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flowtask_all_export_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
  }, [projects]);

  const activeProject = useMemo(() => {
    return projects.find(p => p.id === activeProjectId) || LOADING_PROJECT;
  }, [projects, activeProjectId]);

  const exportActiveProjectToJSON = useCallback(() => {
    if (activeProject && activeProject.id !== 'loading') {
      const blob = new Blob([JSON.stringify(activeProject, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flowtask_project_${activeProject.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
    }
  }, [activeProject]);

  const getProjectBranchesFromSupabase = useCallback(async (id: string): Promise<Branch[]> => {
      if (!supabaseClient) return [];
      const { data } = await supabaseService.fetchBranches(supabaseClient, id);
      return data || [];
  }, [supabaseClient]);

  const moveLocalBranchToRemoteProject = useCallback(async (branchId: string, targetProjectId: string, targetParentId: string) => {
    if (!supabaseClient || !session) {
        showNotification("Devi essere online per spostare rami tra progetti.", "error");
        return;
    }

    try {
        const activeProj = projects.find(p => p.id === activeProjectId);
        if (!activeProj) return;

        // 1. Troviamo il ramo e tutti i suoi figli ricorsivamente
        const branchesToMove: Branch[] = [];
        const collectRecursive = (bid: string) => {
            const b = activeProj.branches[bid];
            if (b) {
                branchesToMove.push(b);
                b.childrenIds.forEach(collectRecursive);
            }
        };
        collectRecursive(branchId);

        // 2. Migrazione su Supabase
        for (const b of branchesToMove) {
            const isRootOfMove = b.id === branchId;
            const updatedBranchPayload = {
                ...b,
                project_id: targetProjectId,
                parent_ids: isRootOfMove ? [targetParentId] : b.parentIds,
                version: (b.version || 1) + 1,
                updated_at: new Date().toISOString()
            };

            // Usiamo il flag 'force: true' per l'upsert durante la migrazione
            await supabaseService.upsertEntity(supabaseClient, 'flowtask_branches', updatedBranchPayload, true);

            // Spostiamo anche i task
            for (const t of b.tasks) {
                await supabaseService.upsertEntity(supabaseClient, 'flowtask_tasks', {
                    ...t,
                    branch_id: b.id,
                    version: (t.version || 1) + 1,
                    updated_at: new Date().toISOString()
                }, true);
            }
        }

        // 3. Aggiorniamo il nuovo genitore nel progetto target
        const { data: targetParentData } = await supabaseClient
            .from('flowtask_branches')
            .select('*')
            .eq('id', targetParentId)
            .single();

        if (targetParentData) {
            const newChildrenIds = Array.from(new Set([...(targetParentData.children_ids || []), branchId]));
            await supabaseService.upsertEntity(supabaseClient, 'flowtask_branches', {
                ...targetParentData,
                children_ids: newChildrenIds,
                version: (targetParentData.version || 1) + 1,
                updated_at: new Date().toISOString()
            }, true);
        }

        // 4. Pulizia nel progetto sorgente (viene gestito dalla deleteBranch nel componente chiamante)
        showNotification("Ramo migrato correttamente!", "success");
    } catch (err) {
        console.error("Migration error:", err);
        showNotification("Errore durante la migrazione.", "error");
    }
  }, [supabaseClient, session, activeProjectId, projects, showNotification]);

  return (
    <ProjectContext.Provider value={{
      state: activeProject, projects, activeProjectId, setActiveProjectId, session, userProfile,
      isOfflineMode, loadingAuth, isInitializing, notification, supabaseConfig, supabaseClient,
      setProjects, switchProject, createProject, deleteProject, renameProject, setSupabaseConfig, logout,
      enableOfflineMode, disableOfflineMode, showNotification,
      reorderProject, closeProject, loadProject,
      exportAllToJSON,
      exportActiveProjectToJSON,
      uploadProjectToSupabase: async () => {
          if (activeProject && supabaseClient && session) await supabaseService.uploadFullProject(supabaseClient, activeProject, session.user.id);
      },
      listProjectsFromSupabase: async () => {
          if (!supabaseClient) return [];
          const { data } = await supabaseService.fetchProjects(supabaseClient);
          return data || [];
      },
      getProjectBranchesFromSupabase,
      moveLocalBranchToRemoteProject,
      downloadProjectFromSupabase: async (id) => {
          if (!supabaseClient) return;
          const p = await supabaseService.downloadFullProject(supabaseClient, id);
          setProjects(prev => {
              const exists = prev.find(item => item.id === p.id);
              return exists ? prev.map(item => item.id === p.id ? p : item) : [...prev, p];
          });
          setActiveProjectId(p.id);
      },
      deleteProjectFromSupabase: async (id) => {
          if (supabaseClient) await supabaseService.softDeleteProject(supabaseClient, id);
      }
    }}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useProject must be used within a ProjectProvider');
  return context;
};
