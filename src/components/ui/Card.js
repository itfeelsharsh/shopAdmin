import React from 'react';
import { motion } from 'framer-motion';

/**
 * Animated Card Component
 * @param {node} children - Card content
 * @param {string} title - Card title
 * @param {string} subtitle - Card subtitle
 * @param {node} icon - Icon component
 * @param {boolean} hoverable - Enable hover effect
 * @param {function} onClick - Click handler
 * @param {node} actions - Action buttons/elements
 */
const Card = ({
  children,
  title,
  subtitle,
  icon,
  hoverable = false,
  onClick,
  actions,
  className = '',
  gradient = false
}) => {
  const baseClasses = 'bg-white rounded-xl shadow-md overflow-hidden';
  const hoverClasses = hoverable ? 'cursor-pointer hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300' : '';
  const gradientClasses = gradient ? 'bg-gradient-to-br from-white to-gray-50' : '';

  const cardContent = (
    <>
      {/* Header */}
      {(title || subtitle || icon || actions) && (
        <div className={`px-6 py-4 ${gradient ? 'bg-gradient-to-r from-blue-50 to-indigo-50' : 'border-b border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {icon && (
                <div className="p-2 bg-blue-100 rounded-lg">
                  {icon}
                </div>
              )}
              <div>
                {title && <h3 className="text-lg font-bold text-gray-800">{title}</h3>}
                {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
              </div>
            </div>
            {actions && <div className="flex gap-2">{actions}</div>}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="px-6 py-4">
        {children}
      </div>
    </>
  );

  if (hoverable || onClick) {
    return (
      <motion.div
        whileHover={{ scale: 1.01, y: -2 }}
        transition={{ duration: 0.2 }}
        className={`${baseClasses} ${hoverClasses} ${gradientClasses} ${className}`}
        onClick={onClick}
      >
        {cardContent}
      </motion.div>
    );
  }

  return (
    <div className={`${baseClasses} ${gradientClasses} ${className}`}>
      {cardContent}
    </div>
  );
};

export default Card;
