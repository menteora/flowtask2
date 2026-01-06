import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { combineLatest } from 'rxjs';
import { ProjectState, Branch, Person, Task, BranchStatus } from '../types';
import { createInitialProjectState } from '../constants';
import { localStorageService } from '../services/localStorage';
import { getDatabase, setupSupabaseReplication, FlowTaskDatabase } from '../services/rxdb';
import { supabaseService } from '../services/supabase';

interface ProjectContextType {
  state: ProjectState;
  projects: ProjectState[];
  activeProjectId: string;
  setActiveProjectId: (id: string) => void;
  session: any;
  isOfflineMode: boolean;
  loadingAuth: boolean;
  isInitializing: boolean;
  autoSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
  notification: { type: 'success' | 'error'; message: string } | null;
  supabaseConfig: { url: string; key: string };
  supabaseClient: SupabaseClient | null;
  pendingSyncIds: Set<string>;
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
  downloadProjectFromSupabase: (id: string) => Promise<void>;
  deleteProjectFromSupabase: (id: string) => Promise<void>;
  syncAllFromSupabase: () => Promise<void>;
  pullAllFromSupabase: () => Promise<void>;
  exportAllToJSON: () => void;
  getProjectBranchesFromSupabase: (id: string) => Promise<Branch[]>;
  moveLocalBranchToRemoteProject: (branchId: string, remoteProjId: string, remoteParentId: string) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showNotification = useCallback((message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  const [supabaseConfig, setSupabaseConfigState] = useState(() => localStorageService.getSupabaseConfig());
  const [supabaseClient, setSupabaseClient] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<any>(null);
  const [isOfflineMode, setIsOfflineMode] = useState(() => localStorageService.getOfflineMode());
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [db, setDb] = useState<FlowTaskDatabase | null>(null);

  const [projects, setProjects] = useState<ProjectState[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [pendingSyncIds] = useState<Set<string>>(new Set());

  // Inizializzazione RxDB e Sottoscrizione Reattiva Globale
  useEffect(() => {
    let subscription: any;

    getDatabase().then(idb => {
      setDb(idb);

      subscription = combineLatest(
        idb.projects.find({ selector: { deleted_at: null } }).$,
        idb.branches.find({ selector: { deleted_at: null } }).$,
        idb.tasks.find({ selector: { deleted_at: null } }).$,
        idb.people.find({ selector: { deleted_at: null } }).$
      ).subscribe(async ([projsDocs, allBranchesDocs, allTasksDocs, allPeopleDocs]: any[]) => {
        const fullProjects: ProjectState[] = [];

        if (!projsDocs) return;

        for (const pDoc of projsDocs) {
          const pData = pDoc.toJSON();
          const projectId = pData.id;

          const projectBranches = (allBranchesDocs as any[] || []).filter(b => b.project_id === projectId);
          const projectPeople = (allPeopleDocs as any[] || []).filter(p => p.project_id === projectId);
          
          const branchesMap: Record<string, Branch> = {};
          
          for (const bDoc of projectBranches) {
            const bData = bDoc.toJSON();
            const branchTasks = (allTasksDocs as any[] || []).filter(t => t.branch_id === bData.id);
            
            branchesMap[bData.id] = {
              id: bData.id,
              title: bData.title,
              description: bData.description,
              status: bData.status as BranchStatus,
              isLabel: bData.is_label,
              isSprint: bData.is_sprint,
              sprintCounter: bData.sprint_counter,
              responsibleId: bData.responsible_id,
              startDate: bData.start_date,
              endDate: bData.end_date,
              dueDate: bData.due_date,
              childrenIds: bData.children_ids || [],
              parentIds: bData.parent_ids || [],
              archived: bData.archived,
              collapsed: bData.collapsed,
              position: bData.position,
              version: bData.version || 1,
              updatedAt: bData.updated_at,
              tasks: branchTasks.map(t => {
                const tData = t.toJSON();
                return {
                  id: tData.id,
                  title: tData.title,
                  description: tData.description,
                  assigneeId: tData.assignee_id,
                  dueDate: tData.due_date,
                  completed: tData.completed,
                  completedAt: tData.completed_at,
                  position: tData.position,
                  pinned: tData.pinned,
                  version: tData.version || 1,
                  updatedAt: tData.updated_at
                };
              })
            };
          }

          fullProjects.push({
            id: pData.id,
            name: pData.name,
            rootBranchId: pData.root_branch_id,
            branches: branchesMap,
            people: projectPeople.map(p => {
              const perData = p.toJSON();
              return {
                id: perData.id,
                name: perData.name,
                email: perData.email,
                phone: perData.phone,
                initials: perData.initials,
                color: perData.color,
                version: perData.version || 1,
                updatedAt: perData.updated_at
              };
            }),
            version: pData.version || 1,
            updatedAt: pData.updated_at
          });
        }

        if (fullProjects.length === 0 && !isInitializing) {
          const def = createInitialProjectState();
          // Insert Project
          await idb.projects.insert({
            id: def.id,
            name: def.name,
            root_branch_id: def.rootBranchId,
            updated_at: new Date().toISOString(),
            version: 1
          });
          // Insert Root Branch
          const root = def.branches[def.rootBranchId];
          await idb.branches.insert({
              id: root.id,
              project_id: def.id,
              title: root.title,
              description: root.description,
              status: root.status,
              is_label: root.isLabel,
              parent_ids: [],
              children_ids: [],
              updated_at: new Date().toISOString(),
              version: 1
          });
        } else {
          setProjects(fullProjects);
          if (isInitializing) {
            const savedActive = localStorageService.getActiveProjectId();
            if (savedActive && fullProjects.some(p => p.id === savedActive)) {
              setActiveProjectId(savedActive);
            } else if (fullProjects.length > 0) {
              setActiveProjectId(fullProjects[0].id);
            }
            setIsInitializing(false);
          }
        }
      });
    });

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [isInitializing]);

  useEffect(() => {
    if (supabaseConfig.url && supabaseConfig.key) {
      const client = createClient(supabaseConfig.url, supabaseConfig.key);
      setSupabaseClient(client);
      (client.auth as any).getSession().then(({ data: { session } }: any) => { setSession(session); setLoadingAuth(false); });
      const { data: { subscription } } = (client.auth as any).onAuthStateChange((_e: any, s: any) => setSession(s));
      
      if (db && !isOfflineMode) {
          setupSupabaseReplication(db, client);
      }

      return () => subscription.unsubscribe();
    } else { setLoadingAuth(false); }
  }, [supabaseConfig, db, isOfflineMode]);

  useEffect(() => {
      if (activeProjectId) localStorageService.saveActiveProjectId(activeProjectId);
  }, [activeProjectId]);

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0] || createInitialProjectState();

  const createProject = async () => {
    if (!db) return;
    const np = createInitialProjectState();
    await db.projects.insert({
        id: np.id,
        name: np.name,
        root_branch_id: np.rootBranchId,
        updated_at: new Date().toISOString(),
        version: 1
    });
    const root = np.branches[np.rootBranchId];
    await db.branches.insert({
        id: root.id,
        project_id: np.id,
        title: root.title,
        description: root.description,
        status: root.status,
        is_label: root.isLabel,
        parent_ids: [],
        children_ids: [],
        updated_at: new Date().toISOString(),
        version: 1
    });
    setActiveProjectId(np.id);
  };

  const deleteProject = async (id: string) => {
    if (!db) return;
    const doc = await db.projects.findOne(id).exec();
    if (doc) {
        await doc.patch({ deleted_at: new Date().toISOString() });
        showNotification("Progetto eliminato", "success");
    }
  };

  const renameProject = async (name: string) => {
    if (!db) return;
    const doc = await db.projects.findOne(activeProjectId).exec();
    if (doc) await doc.patch({ name, updated_at: new Date().toISOString() });
  };

  const reorderProject = (id: string, direction: 'left' | 'right') => {
    setProjects(prev => {
        const idx = prev.findIndex(p => p.id === id);
        if (idx === -1) return prev;
        const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= prev.length) return prev;
        const next = [...prev];
        [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
        return next;
    });
  };

  const closeProject = (id: string) => {
      setProjects(prev => prev.filter(p => p.id !== id));
      if (activeProjectId === id) {
          const remaining = projects.filter(p => p.id !== id);
          if (remaining.length > 0) setActiveProjectId(remaining[0].id);
      }
  };

  const loadProject = async (json: any) => {
    if (!db || !json.id) return;
    const existing = await db.projects.findOne(json.id).exec();
    if (existing) {
        await existing.remove();
    }
    
    await db.projects.insert({
        id: json.id,
        name: json.name,
        root_branch_id: json.rootBranchId,
        updated_at: new Date().toISOString(),
        version: json.version || 1
    });

    for (const person of json.people || []) {
        await db.people.insert({ 
            id: person.id,
            project_id: json.id,
            name: person.name,
            email: person.email,
            phone: person.phone,
            initials: person.initials,
            color: person.color,
            updated_at: new Date().toISOString() 
        });
    }

    for (const b of Object.values(json.branches || {}) as any[]) {
        await db.branches.insert({
            id: b.id,
            project_id: json.id,
            title: b.title,
            description: b.description,
            status: b.status,
            is_label: b.isLabel,
            is_sprint: b.isSprint,
            sprint_counter: b.sprint_counter,
            parent_ids: b.parentIds,
            children_ids: b.childrenIds,
            responsible_id: b.responsibleId,
            updated_at: new Date().toISOString(),
            version: b.version || 1
        });
        for (const t of b.tasks || []) {
            await db.tasks.insert({
                id: t.id,
                branch_id: b.id,
                title: t.title,
                description: t.description,
                assignee_id: t.assigneeId,
                due_date: t.due_date,
                completed: t.completed,
                completed_at: t.completed_at,
                position: t.position,
                pinned: t.pinned,
                updated_at: new Date().toISOString()
            });
        }
    }
    setActiveProjectId(json.id);
    showNotification("Progetto caricato!", "success");
  };

  const uploadProjectToSupabase = async () => {
      if (!supabaseClient || !session || !activeProject) return;
      try {
          await supabaseService.uploadFullProject(supabaseClient, activeProject, session.user.id);
          showNotification("Progetto sincronizzato con il cloud", "success");
      } catch (e) {
          showNotification("Errore sincronizzazione cloud", "error");
      }
  };

  const listProjectsFromSupabase = async () => {
      if (!supabaseClient) return [];
      const { data } = await supabaseService.fetchProjects(supabaseClient);
      return data || [];
  };

  const downloadProjectFromSupabase = async (id: string) => {
      if (!supabaseClient) return;
      try {
          const project = await supabaseService.downloadFullProject(supabaseClient, id);
          await loadProject(project);
      } catch (e) {
          showNotification("Errore download", "error");
      }
  };

  const deleteProjectFromSupabase = async (id: string) => {
      if (!supabaseClient) return;
      await supabaseService.softDeleteProject(supabaseClient, id);
      showNotification("Progetto rimosso dal cloud", "success");
  };

  const syncAllFromSupabase = async () => {
      if (!supabaseClient || !session) return;
      for (const p of projects) {
          await supabaseService.uploadFullProject(supabaseClient, p, session.user.id);
      }
      showNotification("Sincronizzazione completata", "success");
  };

  const pullAllFromSupabase = async () => {
      if (!supabaseClient) return;
      const list = await listProjectsFromSupabase();
      for (const p of list) {
          await downloadProjectFromSupabase(p.id);
      }
  };

  const exportAllToJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projects, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `flowtask_all_projects_${new Date().getTime()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const getProjectBranchesFromSupabase = async (id: string) => {
    if (!supabaseClient) return [];
    const { data } = await supabaseService.fetchBranches(supabaseClient, id);
    return (data || []).map((b: any) => ({
        id: b.id,
        title: b.title,
        description: b.description,
        status: b.status,
        tasks: [],
        childrenIds: b.children_ids || [],
        parentIds: b.parent_ids || [],
        version: b.version || 1
    }));
  };

  const moveLocalBranchToRemoteProject = async (branchId: string, remoteProjId: string, remoteParentId: string) => {
    showNotification("Funzionalità in fase di rilascio", "error");
  };

  const contextValue: ProjectContextType = {
    state: activeProject,
    projects,
    activeProjectId,
    setActiveProjectId,
    session,
    isOfflineMode,
    loadingAuth,
    isInitializing,
    autoSaveStatus: 'idle',
    notification,
    supabaseConfig,
    supabaseClient,
    pendingSyncIds,
    setProjects,
    switchProject: (id) => setActiveProjectId(id),
    createProject,
    deleteProject,
    renameProject,
    setSupabaseConfig: (u, k) => { setSupabaseConfigState({url:u, key:k}); localStorageService.saveSupabaseConfig({url:u, key:k}); },
    logout: async () => { if (supabaseClient) await (supabaseClient.auth as any).signOut(); window.location.reload(); },
    enableOfflineMode: () => { setIsOfflineMode(true); localStorageService.saveOfflineMode(true); window.location.reload(); },
    disableOfflineMode: () => { setIsOfflineMode(false); localStorageService.saveOfflineMode(false); window.location.reload(); },
    showNotification,
    reorderProject,
    closeProject,
    loadProject,
    uploadProjectToSupabase,
    listProjectsFromSupabase,
    downloadProjectFromSupabase,
    deleteProjectFromSupabase,
    syncAllFromSupabase,
    pullAllFromSupabase,
    exportAllToJSON,
    getProjectBranchesFromSupabase,
    moveLocalBranchToRemoteProject
  };

  return <ProjectContext.Provider value={contextValue}>{children}</ProjectContext.Provider>;
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useProject must be used within a ProjectProvider');
  return context;
};