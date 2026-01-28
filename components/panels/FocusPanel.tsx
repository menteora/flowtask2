
import React, { useMemo, useState, useRef } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useBranch } from '../../context/BranchContext';
import { useTask } from '../../context/TaskContext';
import { Branch } from '../../types';
import { Target, Star, CheckSquare, Square, ArrowRight, Folder, Pin, FileText, LayoutGrid, FileText as FileTextIcon, Eye, Copy, Layout, X } from 'lucide-react';
import Avatar from '../ui/Avatar';
import Markdown from '../ui/Markdown';

interface PinnedTaskItem {
    id: string;
    title: string;
    description?: string;
    completed: boolean;
    dueDate?: string;
    branchId: string;
    branchTitle: string;
    projectId: string;
    projectName: string;
    assigneeId?: string;
    assigneeName?: string;
}

const FocusPanel: React.FC = () => {
    const { state, projects, switchProject, showNotification } = useProject();
    const { showAllProjects, selectBranch } = useBranch();
    const { updateTask, setEditingTask, setReadingTask, focusTemplate } = useTask();

    const [viewMode, setViewMode] = useState<'cards' | 'template'>('cards');
    const [renderType, setRenderType] = useState<'markdown' | 'richtext'>('richtext');
    
    const previewRef = useRef<HTMLDivElement>(null);

    // Gather pinned tasks
    const pinnedTasks = useMemo(() => {
        const tasks: PinnedTaskItem[] = [];
        const sourceProjects = showAllProjects ? projects : [state];
        
        sourceProjects.forEach(project => {
            (Object.values(project.branches) as Branch[]).forEach(branch => {
                if (branch.archived) return;

                branch.tasks.forEach(task => {
                    if (task.pinned && !task.completed) {
                        const assignee = project.people.find(p => p.id === task.assigneeId);
                        tasks.push({
                            id: task.id,
                            title: task.title,
                            description: task.description,
                            completed: task.completed,
                            dueDate: task.dueDate,
                            branchId: branch.id,
                            branchTitle: branch.title,
                            projectId: project.id,
                            projectName: project.name,
                            assigneeId: task.assigneeId,
                            assigneeName: assignee?.name || 'Nessuno'
                        });
                    }
                });
            });
        });

        return tasks.sort((a, b) => {
            if (a.dueDate && !b.dueDate) return -1;
            if (!a.dueDate && b.dueDate) return 1;
            if (a.dueDate && b.dueDate) {
                return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            }
            return a.projectName.localeCompare(b.projectName);
        });
    }, [projects, state, showAllProjects]);

    const renderedMarkdown = useMemo(() => {
        return pinnedTasks.map(task => {
            let t = focusTemplate;
            t = t.replace(/{title}/g, task.title);
            t = t.replace(/{description}/g, task.description || '');
            t = t.replace(/{branch}/g, task.branchTitle);
            t = t.replace(/{project}/g, task.projectName);
            t = t.replace(/{dueDate}/g, task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Nessuna');
            t = t.replace(/{assignee}/g, task.assigneeName || 'Nessuno');
            return t;
        }).join('\n\n');
    }, [pinnedTasks, focusTemplate]);

    const copyMarkdown = () => {
        navigator.clipboard.writeText(renderedMarkdown);
        showNotification("Markdown copiato!", "success");
    };

    const copyRichText = async () => {
        if (!previewRef.current) return;
        try {
            const type = "text/html";
            const blob = new Blob([previewRef.current.innerHTML], { type });
            const data = [new ClipboardItem({ [type]: blob })];
            await navigator.clipboard.write(data);
            showNotification("Rich Text copiato! Pronto da incollare.", "success");
        } catch (err) {
            showNotification("Errore durante la copia formattata.", "error");
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto h-full flex flex-col p-4 md:p-8 overflow-y-auto pb-32">
            <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Target className="w-6 h-6 md:w-8 h-8 text-amber-500" />
                        Focus & Priorità
                    </h2>
                    {showAllProjects && (
                        <p className="inline-flex items-center text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full mt-1 border border-amber-100 dark:border-amber-800 uppercase tracking-widest">
                            Vista Globale attiva
                        </p>
                    )}
                    <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Task pinnati per accesso rapido.
                    </p>
                </div>

                {pinnedTasks.length > 0 && (
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg self-start">
                        <button 
                            onClick={() => setViewMode('cards')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'cards' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <LayoutGrid className="w-3.5 h-3.5" /> CARDS
                        </button>
                        <button 
                            onClick={() => setViewMode('template')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'template' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <FileTextIcon className="w-3.5 h-3.5" /> TEMPLATE
                        </button>
                    </div>
                )}
            </div>

            {pinnedTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50 dark:bg-slate-900/50 p-6">
                    <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-full mb-4">
                        <Pin className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Nessun task in focus</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                        Usa l'icona <Pin className="w-3 h-3 inline text-amber-500" /> nei dettagli dei rami per aggiungere task qui e visualizzarli in questa dashboard.
                    </p>
                </div>
            ) : viewMode === 'cards' ? (
                <div className="grid gap-6 md:gap-8 px-2 pt-2">
                    {pinnedTasks.map(task => {
                        const isForeign = task.projectId !== state.id;
                        const project = projects.find(p => p.id === task.projectId);
                        const assignee = project?.people.find(p => p.id === task.assigneeId);

                        return (
                            <div key={task.id} className="relative bg-white dark:bg-slate-800 p-5 md:p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-start gap-3 md:gap-5 transition-all hover:border-amber-400 dark:hover:border-amber-600 group">
                                
                                {/* Badge Pin (Non più tagliato, posizionato sull'angolo) */}
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (isForeign) {
                                            switchProject(task.projectId);
                                            showNotification(`Passaggio a ${task.projectName} per rimuovere il focus...`, "success");
                                        } else {
                                            updateTask(task.branchId, task.id, { pinned: false });
                                        }
                                    }}
                                    className="absolute -top-3 -right-2 md:-top-4 md:-right-3 p-2.5 bg-white dark:bg-slate-700 text-amber-500 rounded-full shadow-lg border border-slate-100 dark:border-slate-600 hover:bg-amber-50 dark:hover:bg-amber-900 transition-all active:scale-90 z-20"
                                    title="Togli dal Focus"
                                >
                                    <Pin className="w-4 h-4 md:w-5 h-5 fill-current" />
                                </button>

                                <button 
                                    onClick={() => {
                                        if (isForeign) {
                                            switchProject(task.projectId);
                                            showNotification(`Passaggio a ${task.projectName}...`, "success");
                                        } else {
                                            updateTask(task.branchId, task.id, { completed: true });
                                        }
                                    }}
                                    className={`mt-1 shrink-0 ${isForeign ? 'text-slate-200 dark:text-slate-700 cursor-not-allowed' : 'text-slate-300 hover:text-green-500 dark:text-slate-600 dark:hover:text-green-400'} transition-colors`}
                                >
                                    <Square className="w-6 h-6 md:w-8 h-8" />
                                </button>

                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-col gap-2 mb-4 pr-4">
                                        <div className="flex items-start gap-2">
                                            <h3 
                                                className="text-base md:text-lg font-black text-slate-800 dark:text-white leading-tight cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                                onClick={() => {
                                                    if (isForeign) {
                                                        switchProject(task.projectId);
                                                        setTimeout(() => setEditingTask({ branchId: task.branchId, taskId: task.id }), 150);
                                                    } else {
                                                        setEditingTask({ branchId: task.branchId, taskId: task.id });
                                                    }
                                                }}
                                            >
                                                {task.title}
                                            </h3>
                                            {task.description && task.description.trim() !== '' && (
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if(isForeign) switchProject(task.projectId);
                                                        setTimeout(() => setReadingTask({ branchId: task.branchId, taskId: task.id }), isForeign ? 150 : 0);
                                                    }}
                                                    className="mt-0.5 text-slate-400 hover:text-indigo-500 transition-colors shrink-0"
                                                >
                                                    <FileText className="w-4 h-4 md:w-5 h-5" />
                                                </button>
                                            )}
                                        </div>
                                        
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[9px] md:text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                                            {showAllProjects && (
                                                <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                                                    <Folder className="w-3 h-3 text-indigo-500" /> {task.projectName}
                                                </span>
                                            )}
                                            <span 
                                                className="flex items-center gap-1 hover:text-indigo-500 cursor-pointer transition-colors"
                                                onClick={() => {
                                                    if (isForeign) switchProject(task.projectId);
                                                    setTimeout(() => selectBranch(task.branchId), isForeign ? 150 : 0);
                                                }}
                                            >
                                                <ArrowRight className="w-3 h-3 text-amber-500" /> {task.branchTitle}
                                            </span>
                                            
                                            {task.dueDate && (
                                                <span className={`flex items-center gap-1 ${new Date(task.dueDate) < new Date() ? 'text-red-500' : 'text-amber-600'}`}>
                                                    <Star className="w-3 h-3 fill-current" /> 
                                                    {new Date(task.dueDate).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Responsabile */}
                                    {assignee && (
                                        <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-900/50 p-2 md:p-3 rounded-xl border border-slate-100 dark:border-slate-800 w-fit">
                                            <Avatar person={assignee} size="sm" className="ring-2 ring-white dark:ring-slate-800 shadow-sm" />
                                            <div className="flex flex-col leading-none">
                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Responsabile</span>
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{assignee.name}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex gap-2 w-full sm:w-auto">
                            <button 
                                onClick={copyMarkdown}
                                className="flex-1 sm:flex-none px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-slate-200 transition-all"
                            >
                                <Copy className="w-3.5 h-3.5" /> Markdown
                            </button>
                            <button 
                                onClick={copyRichText}
                                className="flex-1 sm:flex-none px-3 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-sm transition-all"
                            >
                                <Layout className="w-3.5 h-3.5" /> Rich Text
                            </button>
                        </div>

                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-full sm:w-auto">
                            <button 
                                onClick={() => setRenderType('markdown')}
                                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all ${renderType === 'markdown' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                            >
                                SOURCE
                            </button>
                            <button 
                                onClick={() => setRenderType('richtext')}
                                className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all ${renderType === 'richtext' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                            >
                                PREVIEW
                            </button>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-4 md:p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm min-h-[400px]">
                        {renderType === 'markdown' ? (
                            <pre className="text-xs font-mono text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words leading-relaxed overflow-x-auto">
                                {renderedMarkdown}
                            </pre>
                        ) : (
                            <div ref={previewRef} className="overflow-x-auto">
                                <Markdown content={renderedMarkdown} className="prose-sm md:prose-lg dark:prose-invert" />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FocusPanel;
