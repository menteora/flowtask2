
import { Branch, ProjectState } from './types';

/**
 * Calcola il costo totale di un ramo.
 * Include il costo dei task del ramo stesso e, ricorsivamente, 
 * il costo dei rami figli che hanno propagateCost a true.
 */
export const calculateBranchCost = (branchId: string, state: ProjectState): number => {
  const branch = state.branches[branchId];
  if (!branch) return 0;

  // Costo dei task del ramo corrente
  const tasksCost = branch.tasks.reduce((sum, task) => sum + (task.cost || 0), 0);

  // Costo dei rami figli abilitati alla propagazione
  const children = Object.values(state.branches).filter(b => b.parentIds.includes(branchId));
  const propagatedCost = children.reduce((sum, child) => {
    if (child.propagateCost) {
      return sum + calculateBranchCost(child.id, state);
    }
    return sum;
  }, 0);

  return tasksCost + propagatedCost;
};
