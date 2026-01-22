
import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useTask } from '../../context/TaskContext';
import { X, Copy, FileText, Layout, Eye, Check, FileOutput } from 'lucide-react';
import { Branch } from '../../types';
import Markdown from '../ui/Markdown';

const ReportGenerator: React.FC = () => {
  const { state, projects, showNotification } = useProject();
  const { reportUserId, setReportUserId, showAllProjects } = useTask();
  
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'markdown'>('preview');
  const [copied, setCopied] = useState<'md' | 'rich' | null>(null);
  
  const previewRef = useRef<HTMLDivElement>(null);

  const person = reportUserId ? (
      showAllProjects 
        ? projects.flatMap(p => p.people).find(p => p.id === reportUserId)
        : state.people.find(p => p.id === reportUserId)
  ) : null;

  const reportData = useMemo(() => {
      if (!reportUserId) return [];
      const sourceProjects = showAllProjects ? projects : [state];
      const tasks: Array<{ title: string, branch: string, project: string, description?: string, due?: string }> = [];
      
      sourceProjects.forEach(proj => {
          const branches = proj.branches;

          // Helper ricorsivo per trovare il responsabile effettivo di un ramo
          const getEffectiveResponsibleId = (bid: string): string | undefined => {
              const b = branches[bid];
              if (!b) return undefined;
              if (b.responsibleId) {
                  if (b.responsibleId === 'none') return undefined; // Interrompi eredità
                  return b.responsibleId;
              }
              // Se non c'è un responsabile, risaliamo al primo genitore (assumendo struttura ad albero)
              if (b.parentIds && b.parentIds.length > 0 && b.parentIds[0] !== proj.id) {
                  return getEffectiveResponsibleId(b.parentIds[0]);
              }
              return undefined;
          };

          (Object.values(branches) as Branch[]).forEach(branch => {
              if (branch.archived || branch.status === 'CANCELLED') return;
              
              // Determiniamo il responsabile effettivo per questo ramo una sola volta per ramo
              const effectiveBranchResponsibleId = getEffectiveResponsibleId(branch.id);

              branch.tasks.forEach(t => {
                  // Consideriamo sia assegnazione diretta che ereditata
                  const isDirect = t.assigneeId === reportUserId;
                  // Ereditarietà: il task non ha assegnatario e l'utente è il responsabile effettivo del ramo (anche per gerarchia)
                  const isInherited = !t.assigneeId && effectiveBranchResponsibleId === reportUserId;
                  
                  if ((isDirect || isInherited) && !t.completed) {
                      tasks.push({ 
                          title: t.title, 
                          branch: branch.title, 
                          project: proj.name,
                          description: t.description,
                          due: t.dueDate 
                      });
                  }
              });
          });
      });
      return tasks;
  }, [reportUserId, projects, state, showAllProjects]);

  const markdownContent = useMemo(() => {
      if (!person) return '';
      let md = `# Report Attività: ${person.name}\n`;
      md += `Data: ${new Date().toLocaleDateString('it-IT')}\n\n`;
      
      if (reportData.length === 0) {
          md += "_Nessuna attività in corso._";
      } else {
          reportData.forEach(item => {
              md += `## ${item.title}\n`;
              md += `**Contesto:** ${item.project} > ${item.branch}\n`;
              if (item.due) md += `**Scadenza:** ${new Date(item.due).toLocaleDateString()}\n`;
              md += `\n${item.description || "_Nessuna descrizione fornita._"}\n\n`;
              md += `---\n\n`;
          });
      }
      return md;
  }, [person, reportData]);

  useEffect(() => {
    if (reportUserId) {
      setIsVisible(true);
      setActiveTab('preview');
    } else {
      setTimeout(() => setIsVisible(false), 200);
    }
  }, [reportUserId]);

  if (!reportUserId && !isVisible) return null;
  if (!person) return null;

  const handleClose = () => setReportUserId(null);

  const copyMarkdown = () => {
      navigator.clipboard.writeText(markdownContent);
      setCopied('md');
      showNotification("Markdown copiato negli appunti", "success");
      setTimeout(() => setCopied(null), 2000);
  };

  const copyRichText = async () => {
    if (!previewRef.current) return;
    
    try {
        const type = "text/html";
        const blob = new Blob([previewRef.current.innerHTML], { type });
        const data = [new ClipboardItem({ [type]: blob })];
        await navigator.clipboard.write(data);
        
        setCopied('rich');
        showNotification("Rich Text copiato! Puoi incollarlo in Mail o Word.", "success");
        setTimeout(() => setCopied(null), 2000);
    } catch (err) {
        showNotification("Errore durante la copia formattata.", "error");
    }
  };

  return (
    <div 
        className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${reportUserId ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={handleClose}
    >
      <div 
        className={`bg-white dark:bg-slate-900 w-full max-w-3xl rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 flex flex-col transition-transform duration-200 max-h-[90vh] ${reportUserId ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 rounded-t-xl">
            <div className="flex items-center gap-3">
                <div className="bg-indigo-600 p-2 rounded-lg"><FileOutput className="w-5 h-5 text-white" /></div>
                <div>
                    <h3 className="font-bold text-slate-800 dark:text-white">Report Attività: {person.name}</h3>
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{reportData.length} task inclusi</p>
                </div>
            </div>
            <button onClick={handleClose} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400">
                <X className="w-5 h-5" />
            </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b dark:border-slate-800">
            <button 
                onClick={() => setActiveTab('preview')}
                className={`flex-1 py-3 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'preview' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            >
                <Eye className="w-4 h-4" /> Anteprima
            </button>
            <button 
                onClick={() => setActiveTab('markdown')}
                className={`flex-1 py-3 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'markdown' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
            >
                <FileText className="w-4 h-4" /> Markdown Source
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white dark:bg-slate-900">
            {activeTab === 'preview' ? (
                <div ref={previewRef} className="prose dark:prose-invert max-w-none">
                    <div className="mb-8 border-b-2 border-slate-100 dark:border-slate-800 pb-4">
                        <h1 className="text-3xl font-black text-slate-900 dark:text-white mb-1">Report Attività</h1>
                        <p className="text-slate-500 font-medium">Responsabile: <span className="text-indigo-600 font-bold">{person.name}</span> • Generato il {new Date().toLocaleDateString()}</p>
                    </div>

                    {reportData.length === 0 ? (
                        <div className="py-20 text-center">
                            <p className="text-slate-400 italic">Nessun task attivo da riportare.</p>
                        </div>
                    ) : (
                        <div className="space-y-12">
                            {reportData.map((item, idx) => (
                                <div key={idx} className="group">
                                    <div className="flex items-start justify-between mb-2">
                                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 !mt-0 !mb-0">{item.title}</h2>
                                        {item.due && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold uppercase shrink-0">Scadenza: {new Date(item.due).toLocaleDateString()}</span>}
                                    </div>
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-tighter !mt-0 !mb-4">
                                        Percorso: {item.project} &rsaquo; {item.branch}
                                    </p>
                                    <div className="pl-4 border-l-4 border-slate-100 dark:border-slate-800">
                                        <Markdown content={item.description || ''} className="!text-slate-600 dark:!text-slate-400" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <textarea 
                    readOnly
                    value={markdownContent}
                    className="w-full h-full min-h-[400px] bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-xs text-slate-600 dark:text-slate-300 outline-none resize-none"
                />
            )}
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/30 rounded-b-xl flex flex-wrap gap-2 justify-end items-center">
            <div className="flex gap-2">
                <button 
                    onClick={copyMarkdown}
                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all ${copied === 'md' ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-300'}`}
                >
                    {copied === 'md' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    Copia Markdown
                </button>
                <button 
                    onClick={copyRichText}
                    className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all ${copied === 'rich' ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md'}`}
                >
                    {copied === 'rich' ? <Check className="w-3.5 h-3.5" /> : <Layout className="w-3.5 h-3.5" />}
                    Copia Formattato (Rich Text)
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ReportGenerator;
