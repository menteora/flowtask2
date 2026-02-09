
import React, { useState, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useTask } from '../../context/TaskContext';
import { 
  Database, Download, Key, Cloud, Loader2, LogOut, Upload, Trash2, RefreshCw, FileJson, Terminal, Check, Copy, Wifi, WifiOff, MessageSquare, Settings as SettingsIcon, FileDown, Target, Info, AlertTriangle, X
} from 'lucide-react';

const SettingsPanel: React.FC = () => {
  const { 
    supabaseConfig, setSupabaseConfig, uploadProjectToSupabase, listProjectsFromSupabase,
    downloadProjectFromSupabase, deleteProjectFromSupabase,
    exportAllToJSON, exportActiveProjectToJSON, state, session, logout, disableOfflineMode, enableOfflineMode, showNotification,
    isOfflineMode
  } = useProject();

  const { messageTemplates, updateMessageTemplates, focusTemplate, updateFocusTemplate } = useTask();

  const [activeTab, setActiveTab] = useState<'cloud' | 'preferences' | 'sql'>('cloud');
  const [url, setUrl] = useState(supabaseConfig.url);
  const [key, setKey] = useState(supabaseConfig.key);
  const [msgOpening, setMsgOpening] = useState(messageTemplates.opening);
  const [msgClosing, setMsgClosing] = useState(messageTemplates.closing);
  const [fTemplate, setFTemplate] = useState(focusTemplate);

  const [isLoadingList, setIsLoadingList] = useState(false);
  const [remoteProjects, setRemoteProjects] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  
  const [deletingCloudProjectId, setDeletingCloudProjectId] = useState<string | null>(null);

  useEffect(() => {
      if (session && activeTab === 'cloud') {
          handleListProjects();
      }
  }, [session, activeTab]);

  const handleSaveConfig = () => {
      setSupabaseConfig(url, key);
      showNotification("Credenziali salvate.", 'success');
  };

  const handleSaveTemplates = () => {
      updateMessageTemplates({ opening: msgOpening, closing: msgClosing });
      updateFocusTemplate(fTemplate);
      showNotification("Preferenze aggiornate.", 'success');
  };

  const handleListProjects = async () => {
      if (!session) return;
      setIsLoadingList(true);
      try {
          const list = await listProjectsFromSupabase();
          setRemoteProjects(list || []);
      } finally { setIsLoadingList(false); }
  };

  const handleUpload = async () => {
      if (!session) return;
      setIsUploading(true);
      try {
          await uploadProjectToSupabase();
          showNotification("Progetto caricato correttamente.", 'success');
          handleListProjects();
      } catch (err) {
          showNotification("Errore durante il caricamento.", 'error');
      } finally {
          setIsUploading(false);
      }
  };

  const handleDeleteCloudProject = async (id: string) => {
      try {
          await deleteProjectFromSupabase(id);
          showNotification("Progetto rimosso dal cloud.", "success");
          setDeletingCloudProjectId(null);
          handleListProjects();
      } catch (err) {
          showNotification("Errore durante la rimozione cloud.", "error");
      }
  };

  const fullSqlSetup = `-- CONFIGURAZIONE DATABASE FLOWTASK (FRESH START - DYNAMIC TREE)
-- Copia e incolla questo script nell'editor SQL di Supabase.

-- 1. Funzione per aggiornamento automatico dei timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 2. Tabella Progetti
CREATE TABLE public.flowtask_projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id UUID REFERENCES auth.users(id),
    version INTEGER DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- 3. Tabella Rami (Branches)
-- Nota: La gerarchia è gestita tramite l'array parent_ids
CREATE TABLE public.flowtask_branches (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'PLANNED',
    type TEXT DEFAULT 'standard',
    color TEXT, 
    responsible_id TEXT,
    start_date TEXT,
    end_date TEXT,
    due_date TEXT,
    archived BOOLEAN DEFAULT FALSE,
    collapsed BOOLEAN DEFAULT FALSE,
    sprint_counter INTEGER DEFAULT 1,
    parent_ids TEXT[] DEFAULT '{}',
    position INTEGER DEFAULT 0,
    version INTEGER DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- 4. Tabella Task
CREATE TABLE public.flowtask_tasks (
    id TEXT PRIMARY KEY,
    branch_id TEXT REFERENCES public.flowtask_branches(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    assignee_id TEXT,
    due_date TEXT,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TEXT,
    position INTEGER DEFAULT 0,
    pinned BOOLEAN DEFAULT FALSE,
    version INTEGER DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- 5. Tabella Team (People)
CREATE TABLE public.flowtask_people (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES public.flowtask_projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    initials TEXT,
    color TEXT,
    version INTEGER DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- 6. Trigger per gestione automatica updated_at
CREATE TRIGGER tr_updated_at_projects BEFORE UPDATE ON flowtask_projects FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER tr_updated_at_branches BEFORE UPDATE ON flowtask_branches FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER tr_updated_at_tasks BEFORE UPDATE ON flowtask_tasks FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER tr_updated_at_people BEFORE UPDATE ON flowtask_people FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 7. Sicurezza (Row Level Security)
ALTER TABLE public.flowtask_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flowtask_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flowtask_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flowtask_people ENABLE ROW LEVEL SECURITY;

-- 8. Policy d'accesso (Utenti Autenticati)
CREATE POLICY "Enable all for authenticated users" ON public.flowtask_projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for authenticated users" ON public.flowtask_branches FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for authenticated users" ON public.flowtask_tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for authenticated users" ON public.flowtask_people FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9. Indici per prestazioni ottimali
CREATE INDEX idx_flowtask_branches_parent_ids ON public.flowtask_branches USING GIN (parent_ids);
CREATE INDEX idx_flowtask_tasks_branch_id ON public.flowtask_tasks (branch_id);
CREATE INDEX idx_flowtask_people_project_id ON public.flowtask_people (project_id);`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(fullSqlSetup);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="w-full max-w-5xl mx-auto h-full flex flex-col p-4 md:p-8 overflow-hidden relative">
      <div className="mb-6 flex flex-col md:flex-row md:justify-between md:items-start gap-4 flex-shrink-0">
        <div>
            <h2 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                <SettingsIcon className="w-8 h-8 text-indigo-600" /> Impostazioni
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Configura la preferenze del tuo workspace.</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
            <button onClick={exportActiveProjectToJSON} className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold flex items-center gap-2 border border-indigo-200 dark:border-indigo-800 shadow-sm hover:bg-indigo-100 transition-colors">
                <FileDown className="w-4 h-4" /> Esporta Progetto ({state.name})
            </button>
            <button onClick={exportAllToJSON} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm hover:bg-emerald-700 transition-colors">
                <FileJson className="w-4 h-4" /> Esporta Tutto (JSON)
            </button>
            {isOfflineMode ? (
                <button onClick={disableOfflineMode} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm">
                    <Wifi className="w-4 h-4" /> Passa a Cloud
                </button>
            ) : (
                <button onClick={enableOfflineMode} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm">
                    <WifiOff className="w-4 h-4" /> Lavora in Locale
                </button>
            )}
            {session && (
                <button onClick={logout} className="p-2 text-slate-400 hover:text-red-500 rounded-lg border border-slate-200 dark:border-slate-800 transition-colors"><LogOut className="w-4 h-4" /></button>
            )}
        </div>
      </div>

      <div className="flex items-center gap-1 mb-6 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <button onClick={() => setActiveTab('cloud')} className={`px-4 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'cloud' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Cloud & Database</button>
          <button onClick={() => setActiveTab('preferences')} className={`px-4 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'preferences' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Preferenze</button>
          <button onClick={() => setActiveTab('sql')} className={`px-4 py-3 text-sm font-bold border-b-2 transition-all ${activeTab === 'sql' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>Setup SQL</button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-20">
          {activeTab === 'cloud' && (
              <div className="space-y-6">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-6">
                          <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-white"><Key className="w-5 h-5 text-indigo-500" /> Configurazione Supabase</h3>
                          <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5 ${isOfflineMode ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-600'}`}>
                              {isOfflineMode ? 'Offline (Locale)' : 'Online (Cloud)'}
                          </div>
                      </div>
                      <div className="space-y-4">
                          <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Supabase Project URL" className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono outline-none focus:ring-1 focus:ring-indigo-500" />
                          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Supabase Anon Key" className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono outline-none focus:ring-1 focus:ring-indigo-500" />
                          <button onClick={handleSaveConfig} className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shadow-md">Aggiorna Credenziali</button>
                      </div>
                  </div>

                  {!isOfflineMode && session && (
                      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                          <div className="flex flex-col gap-4 mb-6">
                              <div className="flex items-center justify-between">
                                  <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-white"><Cloud className="w-5 h-5 text-indigo-500" /> Gestione Cloud</h3>
                                  <button onClick={handleUpload} disabled={isUploading} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md disabled:opacity-50 hover:bg-indigo-700 transition-all">
                                      {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Carica Progetto Corrente
                                  </button>
                              </div>
                              <div className="flex gap-2">
                                  <button onClick={handleListProjects} className="flex-1 px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 rounded-xl text-xs font-black uppercase tracking-wider border border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2">
                                      <RefreshCw className="w-4 h-4" /> Aggiorna Lista Cloud
                                  </button>
                              </div>
                          </div>
                          
                          <div className="space-y-2 border-t dark:border-slate-700 pt-4">
                              <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Progetti Disponibili sul Cloud</label>
                              {isLoadingList ? (
                                  <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
                              ) : remoteProjects.length === 0 ? (
                                  <p className="text-xs text-slate-400 italic text-center py-4">Nessun progetto trovato nel cloud.</p>
                              ) : (
                                  remoteProjects.map(proj => (
                                      <div key={proj.id} className="flex flex-col gap-2 p-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50/50 hover:bg-white dark:hover:bg-slate-700 transition-colors group">
                                          <div className="flex items-center justify-between">
                                              <div>
                                                  <p className="text-xs font-black text-slate-700 dark:text-slate-200">{proj.name}</p>
                                                  <p className="text-[9px] text-slate-400 uppercase font-bold">{new Date(proj.updated_at).toLocaleDateString()}</p>
                                              </div>
                                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                  <button onClick={() => downloadProjectFromSupabase(proj.id)} className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded-lg" title="Scarica"><Download className="w-4 h-4" /></button>
                                                  <button onClick={() => setDeletingCloudProjectId(proj.id)} className="p-2 text-slate-300 hover:text-red-500" title="Elimina"><Trash2 className="w-4 h-4" /></button>
                                              </div>
                                          </div>
                                          
                                          {deletingCloudProjectId === proj.id && (
                                              <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/40 border border-red-200 dark:border-red-800 rounded-lg animate-in zoom-in-95 flex flex-col items-center gap-2">
                                                  <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                                                      <AlertTriangle className="w-4 h-4" />
                                                      <p className="text-[10px] font-black uppercase tracking-tight">Eliminare definitivamente dal Cloud?</p>
                                                  </div>
                                                  <div className="flex gap-2 w-full">
                                                      <button 
                                                          onClick={() => setDeletingCloudProjectId(null)}
                                                          className="flex-1 py-1.5 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900 text-slate-600 dark:text-slate-300 rounded text-[10px] font-bold"
                                                      >
                                                          Annulla
                                                      </button>
                                                      <button 
                                                          onClick={() => handleDeleteCloudProject(proj.id)}
                                                          className="flex-1 py-1.5 bg-red-600 text-white rounded text-[10px] font-bold shadow-sm"
                                                      >
                                                          Sì, Elimina
                                                      </button>
                                                  </div>
                                              </div>
                                          )}
                                      </div>
                                  ))
                              )}
                          </div>
                      </div>
                  )}
              </div>
          )}

          {activeTab === 'preferences' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4 shadow-sm">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-white"><MessageSquare className="w-5 h-5 text-indigo-500" /> Template Solleciti</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block">Apertura</label>
                          <textarea value={msgOpening} onChange={(e) => setMsgOpening(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs min-h-[80px] outline-none focus:ring-1 focus:ring-indigo-500" />
                      </div>
                      <div>
                          <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block">Chiusura</label>
                          <textarea value={msgClosing} onChange={(e) => setMsgClosing(e.target.value)} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs min-h-[80px] outline-none focus:ring-1 focus:ring-indigo-500" />
                      </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-white"><Target className="w-5 h-5 text-amber-500" /> Focus Template (Markdown)</h3>
                    </div>
                    
                    <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-3 rounded-xl flex gap-3">
                      <Info className="w-5 h-5 text-blue-500 shrink-0" />
                      <div className="text-[11px] text-blue-700 dark:text-blue-300">
                        <p className="font-bold mb-1">Placeholders disponibili:</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-y-1 gap-x-4 font-mono">
                          <span><code>{"{title}"}</code>: Titolo task</span>
                          <span><code>{"{description}"}</code>: Descrizione</span>
                          <span><code>{"{branch}"}</code>: Nome ramo</span>
                          <span><code>{"{project}"}</code>: Nome progetto</span>
                          <span><code>{"{dueDate}"}</code>: Data scadenza</span>
                          <span><code>{"{assignee}"}</code>: Responsabile</span>
                        </div>
                      </div>
                    </div>

                    <textarea 
                      value={fTemplate} 
                      onChange={(e) => setFTemplate(e.target.value)} 
                      className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs min-h-[200px] font-mono outline-none focus:ring-1 focus:ring-indigo-500" 
                      placeholder="Scrivi il tuo template Markdown qui..."
                    />
                </div>

                <button onClick={handleSaveTemplates} className="w-full py-3 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg hover:bg-indigo-700 transition-all">Salva Preferenze</button>
              </div>
          )}

          {activeTab === 'sql' && (
              <div className="space-y-4">
                  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800 dark:text-white"><Terminal className="w-5 h-5 text-indigo-500" /> Setup Database Supabase</h3>
                          <button 
                            onClick={copyToClipboard}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${copiedSql ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200'}`}
                          >
                              {copiedSql ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                              {copiedSql ? 'Copiato!' : 'Copia SQL'}
                          </button>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                          Copia lo script qui sotto e incollalo nell'editor SQL di Supabase per configurare le tabelle necessarie alla persistenza cloud partendo da una configurazione pulita.
                      </p>
                      <pre className="w-full p-4 bg-slate-900 text-emerald-400 font-mono text-[10px] rounded-xl overflow-x-auto custom-scrollbar max-h-[400px]">
                          {fullSqlSetup}
                      </pre>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};

export default SettingsPanel;
