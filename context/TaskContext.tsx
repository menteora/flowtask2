
import React, { createContext, useContext, useState } from 'react';
import { useProject } from './ProjectContext';
import { useTaskActions } from '../hooks/useTaskActions';
import { usePeopleActions } from '../hooks/usePeopleActions';
import { Task, Person } from '../types';

interface TaskContextType {
  editingTask: { branchId: string; taskId: string } | null;
  setEditingTask: (val: { branchId: string; taskId: string } | null) => void;
  readingTask: { branchId: string; taskId: string } | null;
  setReadingTask: (val: { branchId: string; taskId: string } | null) => void;
  readingDescriptionId: string | null;
  setReadingDescriptionId: (id: string | null) => void;
  remindingUserId: string | null;
  setRemindingUserId: (id: string | null) => void;
  reportUserId: string | null;
  setReportUserId: (id: string | null) => void;
  showOnlyOpen: boolean;
  toggleShowOnlyOpen: () => void;
  messageTemplates: { opening: string; closing: string };
  focusTemplate: string;
  updateMessageTemplates: (templates: Partial<{ opening: string; closing: string }>) => void;
  updateFocusTemplate: (template: string) => void;

  // Actions
  addTask: (branchId: string, title: string) => void;
  duplicateTask: (branchId: string, taskId: string) => void;
  updateTask: (branchId: string, taskId: string, updates: Partial<Task>) => void;
  deleteTask: (branchId: string, taskId: string) => void;
  moveTask: (branchId: string, taskId: string, direction: 'up' | 'down') => void;
  moveTaskToBranch: (taskId: string, sourceBranchId: string, targetBranchId: string) => void;
  bulkUpdateTasks: (branchId: string, text: string) => void;
  bulkMoveTasks: (taskIds: string[], sourceBranchId: string, targetBranchId: string) => void;
  
  // People Actions
  addPerson: (name: string, email?: string, phone?: string) => void;
  updatePerson: (id: string, updates: Partial<Person>) => void;
  removePerson: (id: string) => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

const DEFAULT_FOCUS_TEMPLATE = `### {title}
**Progetto:** {project} | **Ramo:** {branch}
{description}
---`;

export const TaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setProjects, activeProjectId, isOfflineMode, supabaseClient, session } = useProject();
  
  const [editingTask, setEditingTask] = useState<{ branchId: string; taskId: string } | null>(null);
  const [readingTask, setReadingTask] = useState<{ branchId: string; taskId: string } | null>(null);
  const [readingDescriptionId, setReadingDescriptionId] = useState<string | null>(null);
  const [remindingUserId, setRemindingUserId] = useState<string | null>(null);
  const [reportUserId, setReportUserId] = useState<string | null>(null);
  const [showOnlyOpen, setShowOnlyOpen] = useState(false);
  const [messageTemplates, setMessageTemplates] = useState({ opening: "Ciao {name}, ecco i tuoi task:", closing: "Buon lavoro!" });
  const [focusTemplate, setFocusTemplate] = useState(() => localStorage.getItem('flowtask_focus_template') || DEFAULT_FOCUS_TEMPLATE);

  const userId = session?.user?.id;

  const taskActions = useTaskActions(setProjects, activeProjectId, isOfflineMode, supabaseClient, userId);
  const peopleActions = usePeopleActions(setProjects, activeProjectId, isOfflineMode, supabaseClient);

  const updateFocusTemplate = (t: string) => {
    setFocusTemplate(t);
    localStorage.setItem('flowtask_focus_template', t);
  };

  return (
    <TaskContext.Provider value={{
      editingTask, setEditingTask,
      readingTask, setReadingTask,
      readingDescriptionId, setReadingDescriptionId,
      remindingUserId, setRemindingUserId,
      reportUserId, setReportUserId,
      showOnlyOpen, toggleShowOnlyOpen: () => setShowOnlyOpen(!showOnlyOpen),
      messageTemplates,
      focusTemplate,
      updateMessageTemplates: (ts) => setMessageTemplates(p => ({ ...p, ...ts })),
      updateFocusTemplate,
      ...taskActions,
      ...peopleActions
    }}>
      {children}
    </TaskContext.Provider>
  );
};

export const useTask = () => {
  const context = useContext(TaskContext);
  if (!context) throw new Error('useTask must be used within a TaskProvider');
  return context;
};
