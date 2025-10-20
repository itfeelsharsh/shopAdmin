import React from 'react';
import { motion } from 'framer-motion';

/**
 * Enhanced Input Component
 * @param {string} label - Input label
 * @param {string} error - Error message
 * @param {string} helpText - Help text
 * @param {node} icon - Icon component
 * @param {string} iconPosition - Icon position: left or right
 * @param {boolean} required - Required field
 */
const Input = ({
  label,
  error,
  helpText,
  icon,
  iconPosition = 'left',
  required = false,
  className = '',
  ...props
}) => {
  const hasError = !!error;

  const baseInputClasses = 'w-full px-4 py-2 border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2';
  const normalClasses = 'border-gray-300 focus:border-blue-500 focus:ring-blue-200';
  const errorClasses = 'border-red-300 focus:border-red-500 focus:ring-red-200';
  const iconPaddingLeft = icon && iconPosition === 'left' ? 'pl-10' : '';
  const iconPaddingRight = icon && iconPosition === 'right' ? 'pr-10' : '';

  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {icon && iconPosition === 'left' && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}

        <motion.input
          whileFocus={{ scale: 1.01 }}
          transition={{ duration: 0.1 }}
          className={`
            ${baseInputClasses}
            ${hasError ? errorClasses : normalClasses}
            ${iconPaddingLeft}
            ${iconPaddingRight}
          `}
          {...props}
        />

        {icon && iconPosition === 'right' && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}
      </div>

      {error && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-red-500 text-sm mt-1"
        >
          {error}
        </motion.p>
      )}

      {helpText && !error && (
        <p className="text-gray-500 text-sm mt-1">{helpText}</p>
      )}
    </div>
  );
};

export default Input;
