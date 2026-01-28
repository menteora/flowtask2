
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
        <div className="w-full max-w-4xl mx-auto h-full flex flex-col p-4 md:p-8 overflow-y-auto pb-24">
            <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Target className="w-8 h-8 text-amber-500" />
                        Focus & Priorità
                        {showAllProjects && <span className="text-xs font-normal text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full ml-2">Tutti i progetti</span>}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        I task che hai pinnato per un accesso rapido.
                    </p>
                </div>

                {pinnedTasks.length > 0 && (
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg self-start">
                        <button 
                            onClick={() => setViewMode('cards')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'cards' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <LayoutGrid className="w-3 h-3" /> CARDS
                        </button>
                        <button 
                            onClick={() => setViewMode('template')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'template' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <FileTextIcon className="w-3 h-3" /> TEMPLATE
                        </button>
                    </div>
                )}
            </div>

            {pinnedTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                    <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-full mb-4">
                        <Pin className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300">Nessun task in focus</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xs">
                        Usa l'icona <Pin className="w-3 h-3 inline" /> nei dettagli dei rami per aggiungere task qui.
                    </p>
                </div>
            ) : viewMode === 'cards' ? (
                <div className="grid gap-6">
                    {pinnedTasks.map(task => {
                        const isForeign = task.projectId !== state.id;
                        const project = projects.find(p => p.id === task.projectId);
                        const assignee = project?.people.find(p => p.id === task.assigneeId);

                        return (
                            <div key={task.id} className="relative bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 flex items-start gap-4 transition-all hover:border-amber-400 dark:hover:border-amber-600 group">
                                {/* Unpin Rapido (In alto a destra) */}
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
                                    className="absolute -top-3 -right-3 p-2 bg-white dark:bg-slate-700 text-amber-500 rounded-full shadow-lg border border-slate-100 dark:border-slate-600 hover:bg-amber-50 dark:hover:bg-amber-900/40 transition-all active:scale-90 z-10"
                                    title="Togli dal Focus"
                                >
                                    <Pin className="w-5 h-5 fill-current" />
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
                                    className={`mt-1 shrink-0 ${isForeign ? 'text-slate-300 dark:text-slate-600' : 'text-slate-300 hover:text-green-500 dark:text-slate-600 dark:hover:text-green-400'} transition-colors`}
                                >
                                    <Square className="w-7 h-7" />
                                </button>

                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-col gap-1 mb-4">
                                        <div className="flex items-center gap-2">
                                            <h3 
                                                className="text-lg font-black text-slate-800 dark:text-white truncate cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400"
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
                                                    className="text-slate-400 hover:text-indigo-500"
                                                >
                                                    <FileText className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                        
                                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                                            {showAllProjects && (
                                                <span className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900 px-1.5 py-0.5 rounded">
                                                    <Folder className="w-3 h-3" /> {task.projectName}
                                                </span>
                                            )}
                                            <span 
                                                className="flex items-center gap-1 hover:text-indigo-500 cursor-pointer"
                                                onClick={() => {
                                                    if (isForeign) switchProject(task.projectId);
                                                    setTimeout(() => selectBranch(task.branchId), isForeign ? 150 : 0);
                                                }}
                                            >
                                                <ArrowRight className="w-3 h-3" /> {task.branchTitle}
                                            </span>
                                            
                                            {task.dueDate && (
                                                <span className={`flex items-center gap-1 ${new Date(task.dueDate) < new Date() ? 'text-red-500' : 'text-amber-600'}`}>
                                                    <Star className="w-3 h-3 fill-current" /> 
                                                    Scad: {new Date(task.dueDate).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Persona Vista per Intero */}
                                    {assignee && (
                                        <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 w-fit">
                                            <Avatar person={assignee} size="md" className="ring-2 ring-white dark:ring-slate-800 shadow-sm" />
                                            <div className="flex flex-col leading-tight">
                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Responsabile</span>
                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{assignee.name}</span>
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
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex gap-2">
                            <button 
                                onClick={copyMarkdown}
                                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 hover:bg-slate-200"
                            >
                                <Copy className="w-3 h-3" /> Markdown
                            </button>
                            <button 
                                onClick={copyRichText}
                                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-2 hover:bg-indigo-700 shadow-sm"
                            >
                                <Layout className="w-3 h-3" /> Rich Text
                            </button>
                        </div>

                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                            <button 
                                onClick={() => setRenderType('markdown')}
                                className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all ${renderType === 'markdown' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                            >
                                SOURCE (MD)
                            </button>
                            <button 
                                onClick={() => setRenderType('richtext')}
                                className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all ${renderType === 'richtext' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                            >
                                PREVIEW (RICH)
                            </button>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm min-h-[400px]">
                        {renderType === 'markdown' ? (
                            <pre className="text-xs font-mono text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words leading-relaxed">
                                {renderedMarkdown}
                            </pre>
                        ) : (
                            <div ref={previewRef}>
                                <Markdown content={renderedMarkdown} className="prose-lg dark:prose-invert" />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FocusPanel;
