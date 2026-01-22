
import React, { useRef, useState, useMemo } from 'react';
import { useProject } from '../../context/ProjectContext';
import { useBranch } from '../../context/BranchContext';
import BranchNode from './BranchNode';
import { Archive } from 'lucide-react';
import { Branch } from '../../types';

interface TreeLevelProps {
  branchId: string;
}

const isSubtreeVisible = (branchId: string, branches: Record<string, Branch>, showArchived: boolean): boolean => {
    const branch = branches[branchId];
    if (!branch) return false;
    if (showArchived) return true;
    if (!branch.archived) return true;
    
    const children = Object.values(branches).filter(b => b.parentIds?.includes(branchId));
    return children.some(c => isSubtreeVisible(c.id, branches, showArchived));
};

const SkippedNodeIndicator: React.FC<{ title: string }> = ({ title }) => (
    <div className="flex flex-col items-center group/skip relative">
        <div 
            className="w-8 h-8 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-slate-400 hover:text-indigo-500 hover:border-indigo-300 transition-colors cursor-help"
            title={`Passaggio archiviato: ${title}`}
        >
            <Archive className="w-4 h-4" />
        </div>
        <div className="h-6 w-px bg-slate-300 dark:bg-slate-600"></div>
    </div>
);

const TreeLevel: React.FC<TreeLevelProps> = ({ branchId }) => {
  const { state } = useProject();
  const { showArchived } = useBranch();
  const branch = state.branches[branchId];
  
  const visibleSubtree = useMemo(() => isSubtreeVisible(branchId, state.branches, showArchived), [branchId, state.branches, showArchived]);

  const children = useMemo(() => {
      if (!branch) return [];
      return (Object.values(state.branches) as Branch[]).filter(b => b.parentIds?.includes(branchId));
  }, [state.branches, branchId, branch]);

  const visibleChildrenIds = useMemo(() => {
    return children
      .filter(c => isSubtreeVisible(c.id, state.branches, showArchived))
      .sort((a, b) => {
          const posA = a.position ?? 0;
          const posB = b.position ?? 0;
          if (posA !== posB) return posA - posB;
          return a.id.localeCompare(b.id);
      })
      .map(c => c.id);
  }, [children, state.branches, showArchived]);

  if (!branch || !visibleSubtree) return null;

  const isNodeVisibleInCurrentView = !branch.archived || showArchived;
  const hasVisibleChildren = visibleChildrenIds.length > 0;
  const isCollapsed = branch.collapsed;

  return (
    <div className="flex flex-col items-center">
      {isNodeVisibleInCurrentView ? (
          <BranchNode branchId={branchId} />
      ) : (
          <SkippedNodeIndicator title={branch.title} />
      )}

      {hasVisibleChildren && !isCollapsed && (
        <div className="relative flex items-start justify-center pt-4 animate-in fade-in zoom-in-95 duration-200 origin-top">
             {visibleChildrenIds.length > 1 && (
                <div className="absolute top-0 left-0 right-0 h-px bg-slate-300 dark:bg-slate-600 mt-[1px]" />
             )}

            <div className="flex gap-8 relative">
                 {visibleChildrenIds.length > 1 && (
                     <div className="absolute top-0 left-0 right-0 h-px bg-slate-300 dark:bg-slate-600 -translate-y-4 mx-[calc(8rem)]" /> 
                 )}
                 
                 {visibleChildrenIds.map((childId, index) => (
                    <div key={childId} className="flex flex-col items-center relative">
                         {visibleChildrenIds.length > 1 && (
                             <>
                                {index > 0 && <div className="absolute -top-4 right-1/2 w-[calc(50%+1rem)] h-px bg-slate-300 dark:bg-slate-600"></div>}
                                {index < visibleChildrenIds.length - 1 && <div className="absolute -top-4 left-1/2 w-[calc(50%+1rem)] h-px bg-slate-300 dark:bg-slate-600"></div>}
                             </>
                         )}

                        <TreeLevel branchId={childId} />
                    </div>
                 ))}
            </div>
        </div>
      )}
    </div>
  );
};

const FlowCanvas: React.FC = () => {
  const { state } = useProject();
  const { selectBranch } = useBranch();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const rootBranches = useMemo(() => {
    return (Object.values(state.branches) as Branch[])
        .filter(b => b.parentIds?.includes(state.id))
        .sort((a, b) => {
            const posA = a.position ?? 0;
            const posB = b.position ?? 0;
            if (posA !== posB) return posA - posB;
            return a.id.localeCompare(b.id);
        });
  }, [state.branches, state.id]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const target = e.target as HTMLElement;
    if (target.id === 'export-canvas-content' || target === containerRef.current) {
        setIsDragging(true);
        setStartPos({
          x: e.pageX,
          y: e.pageY,
          scrollLeft: containerRef.current.scrollLeft,
          scrollTop: containerRef.current.scrollTop
        });
        selectBranch(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const walkX = (e.pageX - startPos.x) * 1.5;
    const walkY = (e.pageY - startPos.y) * 1.5;
    containerRef.current.scrollLeft = startPos.scrollLeft - walkX;
    containerRef.current.scrollTop = startPos.scrollTop - walkY;
  };

  return (
    <div 
        ref={containerRef}
        className={`w-full h-full overflow-auto bg-slate-50 dark:bg-slate-950 relative select-none ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
    >
        <div id="export-canvas-content" className="min-w-max min-h-full flex flex-col items-center gap-20 p-10 pb-40">
            {rootBranches.map(rb => (
                <TreeLevel key={rb.id} branchId={rb.id} />
            ))}
            {rootBranches.length === 0 && (
                <div className="mt-20 text-slate-400 font-medium italic">Nessun ramo radice trovato.</div>
            )}
        </div>
    </div>
  );
};

export default FlowCanvas;
