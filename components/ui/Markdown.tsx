
import React from 'react';

interface MarkdownProps {
  content: string;
  className?: string;
}

const Markdown: React.FC<MarkdownProps> = ({ content, className = "" }) => {
  if (!content) {
    return <p className="text-gray-400 italic text-sm">Nessuna descrizione.</p>;
  }

  // Sanitizzazione minima e parsing base migliorato
  const renderedHtml = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Header (da h3 a h1 per priorità)
    .replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold mt-4 mb-2 text-slate-800 dark:text-slate-100">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-xl font-black mt-6 mb-3 text-slate-900 dark:text-white">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-black mt-8 mb-4 text-indigo-600 dark:text-indigo-400">$1</h1>')
    // Linea Orizzontale
    .replace(/^---$/gm, '<hr class="my-6 border-slate-200 dark:border-slate-800" />')
    // Formattazione inline
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5">$1</a>')
    // Liste
    .replace(/^\s*-\s+(.*)$/gm, '<li class="ml-4 list-disc mb-1">$1</li>')
    // A capo (evitiamo br multipli dopo elementi blocco)
    .replace(/\n/g, '<br />');

  return (
    <div 
      className={`text-sm text-slate-700 dark:text-slate-300 leading-relaxed break-words prose dark:prose-invert max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHtml }} 
    />
  );
};

export default Markdown;
