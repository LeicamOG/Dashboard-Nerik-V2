import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ children, className = '', title, action }) => {
  return (
    <div className={`bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg p-6 shadow-sm dark:shadow-xl backdrop-blur-sm transition-colors duration-300 ${className}`}>
      {(title || action) && (
        <div className="flex justify-between items-center mb-6">
          {title && (
            <h3 className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-widest">
              {title}
            </h3>
          )}
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};