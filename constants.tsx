
import { BranchStatus, ProjectState, Person } from './types';
import { Users, AlertCircle, CheckCircle2, XCircle, Clock, Map } from 'lucide-react';
import React from 'react';

export const INITIAL_PEOPLE: Person[] = [];

/**
 * Genera uno stato di progetto iniziale con ID univoci.
 */
export const createInitialProjectState = (name: string = 'Nuovo Progetto'): ProjectState => {
  const projectId = crypto.randomUUID();
  const rootBranchId = crypto.randomUUID();
  
  return {
    id: projectId,
    name: name,
    rootBranchId: rootBranchId,
    people: [],
    version: 1,
    branches: {
      [rootBranchId]: {
        id: rootBranchId,
        title: 'Inizio Progetto',
        description: 'Punto di partenza del flusso',
        status: BranchStatus.PLANNED,
        type: 'label', // Ereditato da isLabel: true
        tasks: [],
        childrenIds: [],
        parentIds: [],
        version: 1,
      }
    }
  };
};

export const INITIAL_STATE: ProjectState = createInitialProjectState();

export const STATUS_CONFIG = {
  [BranchStatus.PLANNED]: { color: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400', icon: <Map className="w-4 h-4" />, label: 'Pianificato' },
  [BranchStatus.ACTIVE]: { color: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400', icon: <Clock className="w-4 h-4" />, label: 'Attivo' },
  [BranchStatus.STANDBY]: { color: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400', icon: <AlertCircle className="w-4 h-4" />, label: 'Standby' },
  [BranchStatus.CLOSED]: { color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400', icon: <CheckCircle2 className="w-4 h-4" />, label: 'Chiuso' },
  [BranchStatus.CANCELLED]: { color: 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400', icon: <XCircle className="w-4 h-4" />, label: 'Annullato' },
};

export const PASTEL_COLORS = [
  { id: 'rose', label: 'Rosa', hex: '#fecdd3', bg: 'bg-rose-50 dark:bg-rose-900/20', border: 'border-rose-200 dark:border-rose-800', text: 'text-rose-700 dark:text-rose-300' },
  { id: 'amber', label: 'Ambra', hex: '#fef3c7', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300' },
  { id: 'emerald', label: 'Smeraldo', hex: '#d1fae5', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-300' },
  { id: 'blue', label: 'Azzurro', hex: '#dbeafe', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-300' },
  { id: 'indigo', label: 'Indaco', hex: '#e0e7ff', bg: 'bg-indigo-50 dark:bg-indigo-900/20', border: 'border-indigo-200 dark:border-indigo-800', text: 'text-indigo-700 dark:text-indigo-300' },
  { id: 'violet', label: 'Violetto', hex: '#ede9fe', bg: 'bg-violet-50 dark:bg-violet-900/20', border: 'border-violet-200 dark:border-violet-800', text: 'text-violet-700 dark:text-violet-300' },
  { id: 'orange', label: 'Arancio', hex: '#ffedd5', bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-300' },
  { id: 'slate', label: 'Grigio', hex: '#f1f5f9', bg: 'bg-slate-100 dark:bg-slate-800', border: 'border-slate-300 dark:border-slate-600', text: 'text-slate-700 dark:text-slate-300' },
  { id: 'default', label: 'Default', hex: 'transparent', bg: 'bg-white dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-700', text: 'text-slate-500 dark:text-slate-400' },
];
