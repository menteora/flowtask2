
import { ProjectState, Branch, Task } from '../types';
import { calculateBranchCost } from './costCalculations';
import { formatCost } from './format';

/**
 * Genera una stringa Markdown che rappresenta la struttura del progetto.
 */
export const generateProjectMarkdown = (
  state: ProjectState, 
  options: { showOnlyOpen: boolean; showArchived: boolean; startBranchId?: string }
): string => {
  let markdown = '';
  if (!options.startBranchId) {
    markdown += `# ${state.name}\n\n`;
    if (state.description) {
      markdown += `${state.description}\n\n`;
    }
  }

  const renderBranch = (branchId: string, depth: number) => {
    const branch = state.branches[branchId];
    if (!branch) return;
    if (branch.archived && !options.showArchived) return;

    // Se stiamo partendo da un ramo specifico, il primo livello deve essere un titolo H1 per il file
    // Se stiamo esportando tutto il progetto, i rami radice sono H2
    const baseLevel = options.startBranchId ? 1 : 2;
    const indent = '#'.repeat(Math.min(depth + baseLevel, 6));
    const cost = calculateBranchCost(branchId, state);
    const costStr = cost !== 0 ? ` [${formatCost(cost)} €]` : '';

    markdown += `${indent} ${branch.title}${costStr}\n`;
    
    if (branch.description) {
      markdown += `${branch.description}\n\n`;
    } else {
      markdown += `\n`;
    }

    // Task del ramo
    const visibleTasks = branch.tasks.filter(t => {
      if (options.showOnlyOpen) return !t.completed;
      return true;
    });

    if (visibleTasks.length > 0) {
      visibleTasks.forEach(task => {
        const taskCostStr = task.cost ? ` (${formatCost(task.cost)} €)` : '';
        markdown += `- [${task.completed ? 'x' : ' '}] ${task.title}${taskCostStr}\n`;
        if (task.description) {
          // Indentiamo la descrizione del task per chiarezza
          const descriptionLines = task.description.split('\n');
          descriptionLines.forEach(line => {
             if (line.trim()) markdown += `  > ${line}\n`;
          });
        }
      });
      markdown += `\n`;
    }

    // Rami figli
    const children = Object.values(state.branches)
      .filter(b => b.parentIds.includes(branchId))
      .sort((a, b) => (a.position || 0) - (b.position || 0));

    children.forEach(child => renderBranch(child.id, depth + 1));
  };

  if (options.startBranchId) {
    renderBranch(options.startBranchId, 0);
  } else {
    // Trova i rami radice (quelli che hanno l'ID del progetto come padre)
    const rootBranches = Object.values(state.branches)
      .filter(b => b.parentIds.includes(state.id))
      .sort((a, b) => (a.position || 0) - (b.position || 0));

    rootBranches.forEach(root => renderBranch(root.id, 0));
  }

  return markdown;
};

/**
 * Avvia il download di un file Markdown.
 */
export const downloadMarkdown = (content: string, fileName: string) => {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
