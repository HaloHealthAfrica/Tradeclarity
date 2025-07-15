import React from 'react';
import toast, { Toast, ToastOptions } from 'react-hot-toast';

// Custom toast styles
const toastStyles = {
  success: {
    style: {
      background: '#10b981',
      color: '#ffffff',
    },
    iconTheme: {
      primary: '#ffffff',
      secondary: '#10b981',
    },
  },
  error: {
    style: {
      background: '#ef4444',
      color: '#ffffff',
    },
    iconTheme: {
      primary: '#ffffff',
      secondary: '#ef4444',
    },
  },
  warning: {
    style: {
      background: '#f59e0b',
      color: '#ffffff',
    },
    iconTheme: {
      primary: '#ffffff',
      secondary: '#f59e0b',
    },
  },
  info: {
    style: {
      background: '#3b82f6',
      color: '#ffffff',
    },
    iconTheme: {
      primary: '#ffffff',
      secondary: '#3b82f6',
    },
  },
};

// Toast types
export type ToastType = 'success' | 'error' | 'warning' | 'info';

// Toast interface
export interface ToastMessage {
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

// Custom toast component
const CustomToast: React.FC<{ t: Toast; message: ToastMessage }> = ({ t, message }) => {
  const getIcon = () => {
    switch (message.type) {
      case 'success':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        );
      case 'info':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`${
        t.visible ? 'animate-enter' : 'animate-leave'
      } max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
    >
      <div className="flex-0 w-0 p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">{getIcon()}</div>
          <div className="ml-3 flex-1 pt-0.5">
            {message.title && (
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {message.title}
              </p>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {message.message}
            </p>
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              className="bg-white dark:bg-gray-800 rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              onClick={() => toast.dismiss(t.id)}
            >
              <span className="sr-only">Close</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Toast service class
export class ToastService {
  static show(message: ToastMessage, options?: ToastOptions) {
    try {
      const toastOptions: ToastOptions = {
        duration: message.duration || 4000,
        position: 'top-right',
        ...toastStyles[message.type],
        ...options,
      };

      return toast.custom(
        (t) => <CustomToast t={t} message={message} />,
        toastOptions
      );
    } catch (error) {
      console.error('Error showing toast:', error as Error);
      // Fallback to default toast
      if (message.type === 'success') {
        return toast.success(message.message, {
          duration: message.duration || 4000,
          ...options,
        });
      } else if (message.type === 'error') {
        return toast.error(message.message, {
          duration: message.duration || 4000,
          ...options,
        });
      } else {
        // For 'warning' and 'info', use generic toast
        return toast(message.message, {
          duration: message.duration || 4000,
          ...options,
        });
      }
    }
  }

  static success(message: string, title?: string, duration?: number) {
    return this.show({ type: 'success', message, title, duration });
  }

  static error(message: string, title?: string, duration?: number) {
    return this.show({ type: 'error', message, title, duration });
  }

  static warning(message: string, title?: string, duration?: number) {
    return this.show({ type: 'warning', message, title, duration });
  }

  static info(message: string, title?: string, duration?: number) {
    return this.show({ type: 'info', message, title, duration });
  }

  static dismiss(toastId?: string) {
    if (toastId) {
      toast.dismiss(toastId);
    } else {
      toast.dismiss();
    }
  }

  static dismissAll() {
    toast.dismiss();
  }
}

// Hook for easy toast usage
export const useToast = () => {
  return {
    show: ToastService.show,
    success: ToastService.success,
    error: ToastService.error,
    warning: ToastService.warning,
    info: ToastService.info,
    dismiss: ToastService.dismiss,
    dismissAll: ToastService.dismissAll,
  };
};

// Toast provider component
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <>
      {children}
      {/* Toast container is automatically rendered by react-hot-toast */}
    </>
  );
}; 