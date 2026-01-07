
export enum BranchStatus {
  PLANNED = 'PLANNED',
  ACTIVE = 'ACTIVE',
  STANDBY = 'STANDBY',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
}

export type BranchType = 'standard' | 'label' | 'sprint';

export interface Person {
  id: string;
  name: string;
  email?: string;
  phone?: string; 
  initials: string;
  color: string;
  version: number;
  updatedAt?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string; 
  assigneeId?: string;
  dueDate?: string; 
  completed: boolean;
  completedAt?: string; 
  position?: number; 
  pinned?: boolean; 
  version: number;
  updatedAt?: string;
}

export interface Branch {
  id: string;
  title: string;
  description?: string;
  status: BranchStatus;
  type: BranchType; // Nuovo campo centralizzato
  color?: string; 
  sprintCounter?: number; 
  responsibleId?: string;
  startDate?: string; 
  endDate?: string;   
  dueDate?: string;   
  tasks: Task[];
  childrenIds: string[];
  parentIds: string[]; 
  archived?: boolean;
  collapsed?: boolean; 
  position?: number;
  version: number;
  updatedAt?: string;
}

export interface SyncOperation {
    id?: number; 
    entityId: string;
    table: 'flowtask_projects' | 'flowtask_branches' | 'flowtask_tasks' | 'flowtask_people';
    action: 'upsert' | 'delete';
    payload: any;
    timestamp: number;
}

export interface ProjectState {
  id: string;   
  name: string; 
  branches: Record<string, Branch>;
  people: Person[];
  rootBranchId: string;
  version: number;
  updatedAt?: string;
}

export type Theme = 'light' | 'dark';
