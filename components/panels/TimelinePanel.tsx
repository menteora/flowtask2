
import React, { useMemo, useState, useRef } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useBranch } from '../../context/BranchContext';
import { useTask } from '../../context/TaskContext';
import { Branch, BranchStatus, Task, Person } from '../../types';
import { STATUS_CONFIG, PASTEL_COLORS } from '../../constants';
import { GanttChart, ChevronRight, ZoomIn, ZoomOut, Folder, History, CheckCircle2, User, Calendar, Clock } from 'lucide-react';
import Avatar from '../ui/Avatar';

const CELL_WIDTH = 50; 
const HEADER_HEIGHT = 80; 
const SIDEBAR_WIDTH = 220;

type TimelineTab = 'gantt' | 'activity';

const TimelinePanel: React.FC = () => {
  const { state, projects, switchProject } = useProject();
  const { selectBranch, showArchived, showAllProjects } = useBranch();
  const { setEditingTask } = useTask();

  const [activeTab, setActiveTab] = useState<TimelineTab>('activity');
  const [zoomLevel, setZoomLevel] = useState(1); 

  const sidebarRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const sourceProjects = showAllProjects ? projects : [state];

  // 1. Logica per Registro Attività (Ultima Settimana)
  const activityLog = useMemo(() => {
    const logsByDay: Record<string, Record<string, { person: Person, tasks: any[] }>> = {};
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(today.getDate() - 7);

    sourceProjects.forEach(proj => {
        (Object.values(proj.branches) as Branch[]).forEach(branch => {
            branch.tasks.forEach(task => {
                if (task.completed && task.completedAt) {
                    const compDate = new Date(task.completedAt);
                    compDate.setHours(0,0,0,0);

                    // Consideriamo solo l'ultima settimana per questa vista
                    if (compDate >= oneWeekAgo) {
                        const dayKey = getLocalDateString(compDate);
                        
                        // Determiniamo chi ha fatto il lavoro (assegnatario task o responsabile ramo)
                        const assigneeId = task.assigneeId || branch.responsibleId;
                        const person = proj.people.find(p => p.id === assigneeId) || { 
                            id: 'unassigned', name: 'Nessun Responsabile', initials: '?', color: 'bg-slate-400', version: 1 
                        };

                        if (!logsByDay[dayKey]) logsByDay[dayKey] = {};
                        if (!logsByDay[dayKey][person.id]) {
                            logsByDay[dayKey][person.id] = { person, tasks: [] };
                        }

                        logsByDay[dayKey][person.id].tasks.push({
                            ...task,
                            branchTitle: branch.title,
                            branchId: branch.id,
                            projectId: proj.id,
                            projectName: proj.name
                        });
                    }
                }
            });
        });
    });

    // Trasformiamo l'oggetto in un array ordinato per data decrescente
    return Object.keys(logsByDay).sort().reverse().map(day => ({
        day,
        groups: Object.values(logsByDay[day])
    }));
  }, [sourceProjects]);

  // 2. Logica per Gantt
  const dailyCompletions = useMemo(() => {
      const counts: Record<string, number> = {};
      sourceProjects.forEach(proj => {
          (Object.values(proj.branches) as Branch[]).forEach(b => {
              b.tasks.forEach(t => {
                  if (t.completed && t.completedAt) {
                      const completedDate = new Date(t.completedAt);
                      const dateKey = getLocalDateString(completedDate);
                      counts[dateKey] = (counts[dateKey] || 0) + 1;
                  }
              });
          });
      });
      return counts;
  }, [sourceProjects]);

  const { ganttBranches, minDate, maxDate, totalDays } = useMemo(() => {
    let allActiveBranches: (Branch & { projectName: string, projectId: string })[] = [];

    sourceProjects.forEach(proj => {
        const projBranches = (Object.values(proj.branches) as Branch[]).filter(b => {
            /* Identifichiamo i rami radice verificando se parentIds include l'ID progetto */
            if (b.parentIds.includes(proj.id)) return false;
            if (b.archived && !showArchived) return false;
            return true;
        });
        
        const enhancedBranches = projBranches.map(b => ({
            ...b,
            projectName: proj.name,
            projectId: proj.id
        }));

        allActiveBranches = [...allActiveBranches, ...enhancedBranches];
    });

    allActiveBranches.sort((a, b) => {
        const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
        const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
        return dateA - dateB || a.title.localeCompare(b.title);
    });

    let min = new Date();
    let max = new Date();
    min.setDate(min.getDate() - 7);
    max.setDate(max.getDate() + 30);

    allActiveBranches.forEach(b => {
        if (b.startDate) {
            const start = new Date(b.startDate);
            if (start < min) min = start;
        }
        const endStr = b.endDate || b.dueDate;
        if (endStr) {
            const end = new Date(endStr);
            if (end > max) max = end;
        }
    });

    min.setHours(0,0,0,0);
    max.setHours(0,0,0,0);

    const diffTime = Math.abs(max.getTime() - min.getTime());
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return { 
        ganttBranches: allActiveBranches, 
        minDate: min, 
        maxDate: max, 
        totalDays: days 
    };
  }, [sourceProjects, showArchived]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      if (sidebarRef.current) sidebarRef.current.scrollTop = e.currentTarget.scrollTop;
  };

  const getXForDate = (dateStr: string | undefined) => {
      if (!dateStr) return null;
      const date = new Date(dateStr);
      date.setHours(0,0,0,0);
      const diffTime = date.getTime() - minDate.getTime();
      const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return days * (CELL_WIDTH * zoomLevel);
  };

  const renderTimeHeader = () => {
      const headers = [];
      const current = new Date(minDate);
      
      for (let i = 0; i <= totalDays; i++) {
          const dateKey = getLocalDateString(current);
          const completions = dailyCompletions[dateKey] || 0;
          const isToday = new Date().toDateString() === current.toDateString();
          
          headers.push(
              <div 
                key={i} 
                className={`absolute bottom-0 border-r border-slate-200 dark:border-slate-700 h-full flex flex-col justify-end items-center text-slate-500 dark:text-slate-400 select-none pb-2 ${isToday ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
                style={{ left: i * (CELL_WIDTH * zoomLevel), width: (CELL_WIDTH * zoomLevel) }}
              >
                  {completions > 0 && (
                      <div className="absolute bottom-[44px] bg-indigo-600 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                          {completions}
                      </div>
                  )}
                  <span className="text-[10px] font-bold mt-auto leading-none">{current.getDate()}</span>
                  <span className="text-[8px] uppercase font-medium leading-tight opacity-70">{current.toLocaleDateString('it-IT', { weekday: 'narrow' })}</span>
              </div>
          );
          current.setDate(current.getDate() + 1);
      }
      return headers;
  };

  const getBarDimensions = (branch: Branch) => {
      let startX = getXForDate(branch.startDate);
      let endX = getXForDate(branch.endDate || branch.dueDate);
      if (startX === null && endX !== null) startX = endX - (3 * CELL_WIDTH * zoomLevel);
      if (startX !== null && endX === null) endX = startX + (CELL_WIDTH * zoomLevel);
      if (startX === null && endX === null) {
          const tX = getXForDate(new Date().toISOString());
          if (tX) { startX = tX; endX = tX + (CELL_WIDTH * zoomLevel); }
          else return null;
      }
      return { x: startX!, width: Math.max((endX! - startX!), (CELL_WIDTH * zoomLevel)) };
  };

  const todayX = getXForDate(new Date().toISOString());

  const handleBranchClick = (branch: Branch & { projectId: string }) => {
      if (branch.projectId !== state.id) {
          switchProject(branch.projectId);
          setTimeout(() => selectBranch(branch.id), 100);
      } else {
          selectBranch(branch.id);
      }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden relative">
      {/* Tab Switcher Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-20 flex-shrink-0">
          <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                  <GanttChart className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-lg font-bold text-slate-800 dark:text-white">Timeline</h2>
              </div>
              
              <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <button 
                    onClick={() => setActiveTab('activity')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-black transition-all ${activeTab === 'activity' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                      <History className="w-3.5 h-3.5" /> ATTIVITÀ RECENTI
                  </button>
                  <button 
                    onClick={() => setActiveTab('gantt')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-black transition-all ${activeTab === 'gantt' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                      <GanttChart className="w-3.5 h-3.5" /> PIANIFICAZIONE (GANTT)
                  </button>
              </div>
          </div>

          <div className="flex items-center gap-4">
              {activeTab === 'gantt' && (
                  <div className="flex items-center gap-2">
                      <button onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" disabled={zoomLevel <= 0.5}>
                          <ZoomOut className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-mono w-10 text-center text-slate-500">{(zoomLevel * 100).toFixed(0)}%</span>
                      <button onClick={() => setZoomLevel(Math.min(2, zoomLevel + 0.25))} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500" disabled={zoomLevel >= 2}>
                          <ZoomIn className="w-4 h-4" />
                      </button>
                  </div>
              )}
          </div>
      </div>

      <div className="flex-1 overflow-hidden">
          {activeTab === 'gantt' ? (
              <div className="flex h-full relative">
                  <div 
                    ref={sidebarRef}
                    className="flex-shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-10 shadow-lg overflow-hidden"
                    style={{ width: SIDEBAR_WIDTH, marginTop: HEADER_HEIGHT }}
                  >
                      <div className="flex flex-col"> 
                          {ganttBranches.map(branch => {
                              const statusConfig = STATUS_CONFIG[branch.status];
                              const customColor = PASTEL_COLORS.find(c => c.id === branch.color);
                              const circleColor = customColor ? customColor.text.split(' ')[0].replace('text-', 'bg-') : (statusConfig.color.replace('text-', 'bg-').split(' ')[0] || 'bg-slate-400');
                              
                              return (
                                  <div 
                                    key={`${branch.projectId}-${branch.id}`} 
                                    className="h-12 border-b border-slate-100 dark:border-slate-800 flex items-center px-3 gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex-shrink-0"
                                    onClick={() => handleBranchClick(branch)}
                                  >
                                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${circleColor}`}></div>
                                      <div className="flex flex-col min-w-0 flex-1">
                                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{branch.title}</span>
                                          {showAllProjects && <span className="text-[9px] text-slate-400 truncate flex items-center gap-1"><Folder className="w-2.5 h-2.5" /> {branch.projectName}</span>}
                                      </div>
                                      <ChevronRight className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                  </div>
                              );
                          })}
                      </div>
                  </div>

                  <div 
                    ref={timelineRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-auto relative custom-scrollbar bg-slate-50 dark:bg-slate-950"
                  >
                      <div 
                        className="relative min-w-full"
                        style={{ width: (totalDays + 1) * (CELL_WIDTH * zoomLevel), height: (ganttBranches.length * 48) + HEADER_HEIGHT }}
                      >
                          <div 
                            className="sticky top-0 left-0 right-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-30 shadow-sm"
                            style={{ height: HEADER_HEIGHT }}
                          >
                              {renderTimeHeader()}
                          </div>

                          {todayX !== null && (
                              <div className="absolute top-0 bottom-0 border-l-2 border-red-500/30 z-10 pointer-events-none" style={{ left: todayX, marginTop: HEADER_HEIGHT }}>
                                  <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-red-500 rounded-full shadow-sm"></div>
                              </div>
                          )}

                          <div className="relative z-20">
                              {ganttBranches.map(branch => {
                                  const dims = getBarDimensions(branch);
                                  const totalTasks = branch.tasks.length;
                                  const completed = branch.tasks.filter(t => t.completed).length;
                                  const pct = totalTasks > 0 ? (completed / totalTasks) * 100 : 0;

                                  const customColor = PASTEL_COLORS.find(c => c.id === branch.color);
                                  let barColor = customColor ? customColor.bg.replace('bg-', 'bg-opacity-100 bg-') : 'bg-slate-400';
                                  
                                  if (!customColor) {
                                      if (branch.status === BranchStatus.ACTIVE) barColor = 'bg-indigo-500';
                                      else if (branch.status === BranchStatus.CLOSED) barColor = 'bg-blue-500';
                                      else if (branch.status === BranchStatus.STANDBY) barColor = 'bg-amber-500';
                                      else if (branch.status === BranchStatus.CANCELLED) barColor = 'bg-red-500';
                                  }

                                  return (
                                      <div key={`${branch.projectId}-${branch.id}`} className="h-12 border-b border-transparent relative group">
                                          {dims && (
                                              <div 
                                                className={`absolute top-2 h-8 rounded-md shadow-sm cursor-pointer transition-all hover:brightness-110 flex items-center overflow-hidden ${barColor} bg-opacity-80 dark:bg-opacity-60 border border-black/5 dark:border-white/20`}
                                                style={{ left: dims.x, width: dims.width }}
                                                onClick={() => handleBranchClick(branch)}
                                              >
                                                  <div className="h-full bg-black/10 absolute left-0 top-0 transition-all duration-500" style={{ width: `${pct}%` }} />
                                                  {dims.width > 60 && <span className={`relative z-10 px-2 text-xs font-bold ${customColor ? customColor.text : 'text-white drop-shadow-md'} truncate`}>{branch.title}</span>}
                                              </div>
                                          )}
                                      </div>
                                  );
                              })}
                          </div>
                      </div>
                  </div>
              </div>
          ) : (
              /* Registro Attività */
              <div className="h-full overflow-y-auto p-4 md:p-8 bg-white dark:bg-slate-900 pb-24 custom-scrollbar">
                  <div className="max-w-4xl mx-auto space-y-12">
                      {activityLog.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                              <History className="w-12 h-12 mb-4" />
                              <p className="text-lg font-bold">Nessun task completato negli ultimi 7 giorni</p>
                              <p className="text-sm">Inizia a completare i task per vedere il log storico qui.</p>
                          </div>
                      )}

                      {activityLog.map(dayLog => (
                          <div key={dayLog.day} className="relative">
                              {/* Separatore Giorno */}
                              <div className="sticky top-0 z-10 py-4 bg-white dark:bg-slate-900 border-b dark:border-slate-800 mb-6 flex items-center gap-3">
                                  <Calendar className="w-5 h-5 text-indigo-600" />
                                  <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tighter">
                                      {new Date(dayLog.day).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                                  </h3>
                              </div>

                              <div className="space-y-8 pl-10 border-l-2 border-slate-100 dark:border-slate-800">
                                  {dayLog.groups.map(group => (
                                      <div key={group.person.id} className="relative group/person">
                                          {/* Intestazione Persona */}
                                          <div className="flex items-center gap-3 mb-3 -ml-[58px]">
                                              <div className="p-1 bg-white dark:bg-slate-900 rounded-full z-10 shadow-sm border border-slate-100 dark:border-slate-800 shrink-0">
                                                  <Avatar person={group.person} size="md" />
                                              </div>
                                              <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 truncate">
                                                  {group.person.name}
                                                  <span className="shrink-0 text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-black uppercase">
                                                      {group.tasks.length} {group.tasks.length === 1 ? 'completato' : 'completati'}
                                                  </span>
                                              </h4>
                                          </div>

                                          {/* Lista Task del giorno per la persona */}
                                          <div className="grid grid-cols-1 gap-2">
                                              {group.tasks.map(task => (
                                                  <div 
                                                    key={task.id}
                                                    onClick={() => {
                                                        if (task.projectId !== state.id) switchProject(task.projectId);
                                                        setTimeout(() => setEditingTask({ branchId: task.branchId, taskId: task.id }), 100);
                                                    }}
                                                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-500 transition-all cursor-pointer group"
                                                  >
                                                      <div className="flex items-center gap-3 min-w-0">
                                                          <div className="bg-green-100 dark:bg-green-900/30 p-1.5 rounded-full text-green-600 shrink-0">
                                                              <CheckCircle2 className="w-4 h-4" />
                                                          </div>
                                                          <div className="min-w-0">
                                                              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{task.title}</p>
                                                              <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase font-black">
                                                                  <Folder className="w-3 h-3 shrink-0" /> {task.branchTitle}
                                                                  {showAllProjects && <span className="opacity-40 truncate shrink-0">• {task.projectName}</span>}
                                                              </div>
                                                          </div>
                                                      </div>
                                                      
                                                      <div className="flex items-center gap-3 text-xs text-slate-400 font-medium shrink-0">
                                                          <div className="flex items-center gap-1">
                                                              <Clock className="w-3 h-3" />
                                                              {new Date(task.completedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                                          </div>
                                                      </div>
                                                  </div>
                                              ))}
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};

export default TimelinePanel;
