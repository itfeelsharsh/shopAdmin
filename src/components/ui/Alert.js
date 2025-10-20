import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle, XCircle, Info, X } from 'react-feather';

/**
 * Alert Component
 * @param {string} variant - Alert type: success, danger, warning, info
 * @param {string} title - Alert title
 * @param {string} message - Alert message
 * @param {boolean} dismissible - Can be dismissed
 * @param {function} onDismiss - Dismiss handler
 * @param {boolean} show - Show state
 */
const Alert = ({
  variant = 'info',
  title,
  message,
  dismissible = false,
  onDismiss,
  show = true
}) => {
  const variantConfig = {
    success: {
      icon: CheckCircle,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      iconColor: 'text-green-500',
      titleColor: 'text-green-800',
      messageColor: 'text-green-700'
    },
    danger: {
      icon: XCircle,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      iconColor: 'text-red-500',
      titleColor: 'text-red-800',
      messageColor: 'text-red-700'
    },
    warning: {
      icon: AlertCircle,
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      iconColor: 'text-yellow-500',
      titleColor: 'text-yellow-800',
      messageColor: 'text-yellow-700'
    },
    info: {
      icon: Info,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      iconColor: 'text-blue-500',
      titleColor: 'text-blue-800',
      messageColor: 'text-blue-700'
    }
  };

  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className={`${config.bgColor} ${config.borderColor} border rounded-lg p-4`}
        >
          <div className="flex items-start gap-3">
            <Icon className={`${config.iconColor} flex-shrink-0 mt-0.5`} size={20} />
            <div className="flex-1">
              {title && (
                <h4 className={`${config.titleColor} font-semibold mb-1`}>
                  {title}
                </h4>
              )}
              {message && (
                <p className={`${config.messageColor} text-sm`}>
                  {message}
                </p>
              )}
            </div>
            {dismissible && onDismiss && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={onDismiss}
                className={`${config.iconColor} hover:opacity-70 transition-opacity`}
              >
                <X size={18} />
              </motion.button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Alert;
