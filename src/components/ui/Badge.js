import React from 'react';
import { motion } from 'framer-motion';

/**
 * Badge Component
 * @param {string} variant - Badge style: success, danger, warning, info, default
 * @param {string} size - Badge size: sm, md, lg
 * @param {node} children - Badge content
 * @param {node} icon - Icon component
 * @param {boolean} dot - Show dot indicator
 * @param {boolean} pulse - Pulse animation
 */
const Badge = ({
  variant = 'default',
  size = 'md',
  children,
  icon,
  dot = false,
  pulse = false,
  className = ''
}) => {
  const variantClasses = {
    success: 'bg-green-100 text-green-800 border-green-200',
    danger: 'bg-red-100 text-red-800 border-red-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
    default: 'bg-gray-100 text-gray-800 border-gray-200',
    purple: 'bg-purple-100 text-purple-800 border-purple-200',
    pink: 'bg-pink-100 text-pink-800 border-pink-200',
    indigo: 'bg-indigo-100 text-indigo-800 border-indigo-200'
  };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5'
  };

  const badgeContent = (
    <span className={`inline-flex items-center gap-1.5 font-semibold rounded-full border ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}>
      {dot && (
        <span className={`w-2 h-2 rounded-full ${pulse ? 'animate-pulse' : ''} ${variant === 'success' ? 'bg-green-500' : variant === 'danger' ? 'bg-red-500' : variant === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
      )}
      {icon && icon}
      {children}
    </span>
  );

  if (pulse && !dot) {
    return (
      <motion.div
        animate={{ scale: [1, 1.05, 1] }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
        className="inline-block"
      >
        {badgeContent}
      </motion.div>
    );
  }

  return badgeContent;
};

export default Badge;
