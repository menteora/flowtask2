
import React, { useMemo, useState } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useBranch } from '../../context/BranchContext';
import { useTask } from '../../context/TaskContext';
import { STATUS_CONFIG, PASTEL_COLORS } from '../../constants';
import { ChevronRight, ChevronDown, Plus, FileText, CheckSquare, Square, Archive, GitBranch, ChevronUp, Tag, Calendar, CheckCircle2, ChevronsDown, ChevronsUp, Layers, RefreshCw, Zap, ArrowUp, ArrowDown, Folder, Compass, Quote } from 'lucide-react';
import Avatar from '../ui/Avatar';
import Markdown from '../ui/Markdown';
import { Branch } from '../../types';

interface FolderNodeProps {
  branchId: string;
  depth?: number;
  index?: number;
  siblingsCount?: number;
}

const FolderNode: React.FC<FolderNodeProps> = ({ branchId, depth = 0, index = 0, siblingsCount = 0 }) => {
  const { state } = useProject();
  const { selectBranch, selectedBranchId, addBranch, updateBranch, moveBranch, showArchived } = useBranch();
  const { updateTask, moveTask, showOnlyOpen, setEditingTask } = useTask();
  
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const branch = state.branches[branchId];
  
  const children = useMemo(() => {
      if (!branch) return [];
      return (Object.values(state.branches) as Branch[]).filter(b => b.parentIds?.includes(branchId));
  }, [state.branches, branchId, branch]);

  const sortedTasks = useMemo(() => {
    if (!branch) return [];
    let list = [...branch.tasks];
    if (showOnlyOpen) {
        list = list.filter(t => !t.completed);
    }
    return list.sort((a, b) => {
        if (a.completed === b.completed) {
            return (a.position ?? 0) - (b.position ?? 0);
        }
        return a.completed ? 1 : -1;
    });
  }, [branch?.tasks, showOnlyOpen]);

  if (!branch) return null;
  
  const isSelfVisible = !branch.archived || showArchived;
  const hasActiveChildren = children.some(c => !c.archived);

  const shouldRender = isSelfVisible || hasActiveChildren;
  if (!shouldRender) return null;

  const visibleChildren = children.sort((a, b) => (a.position || 0) - (b.position || 0));
  const hasChildren = visibleChildren.length > 0;
  const hasTasks = sortedTasks.length > 0;
  const hasContent = hasChildren || hasTasks;
  
  const isSelected = selectedBranchId === branchId;
  const statusConfig = STATUS_CONFIG[branch.status];
  const isOpen = !branch.collapsed;

  const isRootBranch = branch.parentIds.includes(state.id);

  const customColor = PASTEL_COLORS.find(c => c.id === branch.color);
  const iconColorClass = branch.type === 'label' ? 'text-amber-500' : (branch.type === 'sprint' ? 'text-indigo-500' : (branch.type === 'objective' ? 'text-cyan-500' : (customColor ? customColor.text : statusConfig.color)));

  return (
    <div className={`flex flex-col select-none`}>
      <div 
        className={`
          flex items-center gap-2 py-2.5 px-4 border-b border-gray-100 dark:border-slate-800 transition-colors cursor-pointer relative group
          ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800'}
          ${branch.archived ? 'opacity-60 grayscale-[0.5]' : ''}
        `}
        style={{ paddingLeft: `${depth * 1.25 + 1}rem` }}
        onClick={() => selectBranch(branchId)}
      >
        <button 
           onClick={(e) => { e.stopPropagation(); updateBranch(branchId, { collapsed: !branch.collapsed }); }}
           className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 ${!hasContent ? 'invisible' : ''}`}
        >
           {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
        </button>

        <div className={`${iconColorClass} bg-transparent p-0 relative`}>
             {branch.type === 'label' ? <Tag className="w-4 h-4" /> : (branch.type === 'sprint' ? <Zap className="w-4 h-4" /> : (branch.type === 'objective' ? <Compass className="w-4 h-4" /> : <GitBranch className="w-4 h-4" />))}
             {branch.archived && (
                 <div className="absolute -bottom-1 -right-1 bg-gray-200 dark:bg-gray-700 rounded-full p-0.5">
                     <Archive className="w-2 h-2 text-gray-500" />
                 </div>
             )}
        </div>
        
        <div className="flex-1 min-w-0">
             <div className="flex items-center gap-2">
                 <span className={`font-medium text-xs truncate ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200'}`}>
                    {branch.title}
                 </span>
                 {branch.type !== 'label' && branch.type !== 'objective' && (
                     <span className={`text-[8px] px-1.5 rounded-full border border-current opacity-70 ${statusConfig.color} bg-transparent font-black`}>
                        {branch.status}
                     </span>
                 )}
             </div>
        </div>

        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            {!isRootBranch && (
                <div className="flex flex-col mr-2">
                    <button 
                        onClick={(e) => { e.stopPropagation(); moveBranch(branchId, 'up'); }}
                        disabled={index === 0}
                        className={`p-0.5 ${index === 0 ? 'text-slate-200 dark:text-slate-800' : 'text-slate-400 hover:text-indigo-600'}`}
                    >
                        <ChevronUp className="w-3 h-3" />
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); moveBranch(branchId, 'down'); }}
                        disabled={index === siblingsCount - 1}
                        className={`p-0.5 ${index === siblingsCount - 1 ? 'text-slate-200 dark:text-slate-800' : 'text-slate-400 hover:text-indigo-600'}`}
                    >
                        <ChevronDown className="w-3 h-3" />
                    </button>
                </div>
            )}
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    updateBranch(branchId, { collapsed: false });
                    addBranch(branchId);
                }}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-700 rounded-full"
            >
                <Plus className="w-3.5 h-3.5" />
            </button>
        </div>
      </div>

      {branch.type === 'objective' && branch.description && (
          <div className="mt-1 mb-2 px-4" style={{ paddingLeft: `${depth * 1.25 + 3.5}rem` }}>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsDescriptionExpanded(!isDescriptionExpanded); }}
                className="flex items-center gap-1.5 text-[10px] font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-tight hover:underline transition-all"
              >
                  <Quote className={`w-3 h-3 transition-transform duration-300 ${isDescriptionExpanded ? 'rotate-180' : ''}`} />
                  {isDescriptionExpanded ? 'Chiudi Obiettivo' : 'Vedi Obiettivo'}
              </button>
              {isDescriptionExpanded && (
                  <div className="mt-2 p-3 bg-cyan-50/50 dark:bg-cyan-900/10 border border-cyan-100 dark:border-cyan-900/30 rounded-xl animate-in slide-in-from-top-1 duration-200 shadow-inner">
                      <Markdown content={branch.description} className="!text-[11px] !text-cyan-800 dark:!text-cyan-200 !leading-snug italic" />
                  </div>
              )}
          </div>
      )}

      {isOpen && hasContent && (
        <div className="flex flex-col">
          {sortedTasks.map((task, idx) => {
             const canMoveUp = idx > 0 && sortedTasks[idx - 1].completed === task.completed;
             const canMoveDown = idx < sortedTasks.length - 1 && sortedTasks[idx + 1].completed === task.completed;
             return (
                 <div 
                    key={task.id}
                    className="flex items-center gap-3 py-1.5 border-b border-gray-50 dark:border-slate-800/50 pr-2 group bg-gray-50/50 dark:bg-slate-900/50"
                    style={{ paddingLeft: `${(depth + 1) * 1.25 + 2.5}rem` }}
                 >
                    <button 
                        onClick={(e) => { e.stopPropagation(); updateTask(branchId, task.id, { completed: !task.completed }); }}
                        className={`${task.completed ? 'text-green-500' : 'text-gray-300 dark:text-slate-600'}`}
                    >
                        {task.completed ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                    </button>
                    <div className="flex-1 min-w-0 flex items-center justify-between cursor-pointer" onClick={() => setEditingTask({ branchId, taskId: task.id })}>
                        <span className={`text-[11px] break-words hover:text-indigo-600 dark:hover:text-indigo-400 ${task.completed ? 'line-through text-gray-400' : 'text-slate-600 dark:text-slate-300'}`}>
                            {task.title}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                            {task.assigneeId && <Avatar person={state.people.find(p => p.id === task.assigneeId)!} size="sm" className="w-4 h-4 text-[8px]" />}
                            {!task.completed && (
                                <div className="flex flex-col items-center ml-1">
                                    <button onClick={(e) => { e.stopPropagation(); moveTask(branchId, task.id, 'up'); }} disabled={!canMoveUp} className={`p-0.5 ${canMoveUp ? 'text-indigo-400 hover:text-indigo-600' : 'text-slate-200 dark:text-slate-800'}`}><ChevronUp className="w-2.5 h-2.5" /></button>
                                    <button onClick={(e) => { e.stopPropagation(); moveTask(branchId, task.id, 'down'); }} disabled={!canMoveDown} className={`p-0.5 ${canMoveDown ? 'text-indigo-400 hover:text-indigo-600' : 'text-slate-200 dark:text-slate-800'}`}><ChevronDown className="w-2.5 h-2.5" /></button>
                                </div>
                            )}
                        </div>
                    </div>
                 </div>
             );
          })}
          {visibleChildren.map((child, idx) => (
            <FolderNode key={child.id} branchId={child.id} depth={depth + 1} index={idx} siblingsCount={visibleChildren.length} />
          ))}
        </div>
      )}
    </div>
  );
};

const FolderTree: React.FC = () => {
    const { state } = useProject();
    const { setAllBranchesCollapsed } = useBranch();
    const branchesCount = Object.keys(state.branches).length - 1;
    
    const rootBranches = useMemo(() => {
        return (Object.values(state.branches) as Branch[]).filter(b => b.parentIds?.includes(state.id)).sort((a, b) => (a.position || 0) - (b.position || 0));
    }, [state.branches, state.id]);

    return (
        <div className="w-full h-full flex flex-col bg-white dark:bg-slate-950">
            <div className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="bg-indigo-600/10 p-1.5 rounded-lg"><Layers className="w-4 h-4 text-indigo-600" /></div>
                    <div className="flex flex-col leading-none">
                        <span className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-tighter">Gerarchia</span>
                        <span className="text-[10px] text-slate-400 font-bold">{branchesCount} rami attivi</span>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={() => setAllBranchesCollapsed(false)} className="p-2 text-indigo-600 dark:text-indigo-400 rounded-lg"><ChevronsDown className="w-4 h-4" /></button>
                    <button onClick={() => setAllBranchesCollapsed(true)} className="p-2 text-slate-500 rounded-lg"><ChevronsUp className="w-4 h-4" /></button>
                </div>
            </div>
            <div id="export-tree-content" className="flex-1 overflow-y-auto pb-24">
                {rootBranches.map((rb, idx) => (
                    <FolderNode key={rb.id} branchId={rb.id} index={idx} siblingsCount={rootBranches.length} />
                ))}
                {rootBranches.length === 0 && (
                    <div className="p-10 text-center text-slate-400 italic">Nessun ramo radice.</div>
                )}
            </div>
        </div>
    );
};

export default FolderTree;
