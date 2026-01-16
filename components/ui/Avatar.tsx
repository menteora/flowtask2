
import React from 'react';
import { Person } from '../../types';
import { UserX, AlertTriangle } from 'lucide-react';

interface AvatarProps {
  person?: Person | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  isUnknown?: boolean;
}

const Avatar: React.FC<AvatarProps> = ({ person, size = 'md', className = '', isUnknown = false }) => {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-10 h-10 text-base',
  };

  const iconSize = size === 'sm' ? 12 : size === 'md' ? 16 : 20;

  if (isUnknown || (!person && !isUnknown)) {
    return (
      <div 
        className={`${sizeClasses[size]} bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-full flex items-center justify-center text-slate-400 shadow-sm relative ${className}`}
        title="Utente non trovato o eliminato"
      >
        <UserX size={iconSize} />
        <div className="absolute -top-1 -right-1 bg-amber-500 rounded-full p-0.5 border border-white dark:border-slate-900 shadow-sm">
            <AlertTriangle className="text-white" size={size === 'sm' ? 6 : 8} />
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`${sizeClasses[size]} ${person.color} rounded-full flex items-center justify-center text-white font-medium shadow-sm transition-transform hover:scale-110 ${className}`}
      title={person.name}
    >
      {person.initials}
    </div>
  );
};

export default Avatar;
