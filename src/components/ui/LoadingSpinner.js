import React from 'react';
import { motion } from 'framer-motion';

/**
 * Loading Spinner Component
 * @param {string} size - Spinner size: sm, md, lg, xl
 * @param {string} color - Spinner color
 * @param {string} text - Loading text
 */
const LoadingSpinner = ({ size = 'md', color = 'blue', text }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const colorClasses = {
    blue: 'border-blue-600',
    green: 'border-green-600',
    red: 'border-red-600',
    yellow: 'border-yellow-600',
    purple: 'border-purple-600',
    white: 'border-white'
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: 'linear'
        }}
        className={`${sizeClasses[size]} border-4 ${colorClasses[color]} border-t-transparent rounded-full`}
      />
      {text && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-gray-600 text-sm font-medium"
        >
          {text}
        </motion.p>
      )}
    </div>
  );
};

/**
 * Full Page Loading Spinner
 */
export const FullPageLoader = ({ text = 'Loading...' }) => {
  return (
    <div className="fixed inset-0 bg-white bg-opacity-90 backdrop-blur-sm z-50 flex items-center justify-center">
      <LoadingSpinner size="xl" color="blue" text={text} />
    </div>
  );
};

export default LoadingSpinner;
