import React from 'react';
import { AlertCircle, HelpCircle, X, ShieldAlert } from 'lucide-react';

export interface ConfirmConfig {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  type?: 'primary' | 'success' | 'danger';
  onConfirm: () => void;
  onCancel?: () => void;
}

interface ConfirmationDialogProps {
  config: ConfirmConfig;
  closeDialog: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({ config, closeDialog }) => {
  if (!config.isOpen) return null;

  const {
    title,
    message,
    confirmText,
    cancelText = 'Cancel',
    type = 'primary',
    onConfirm,
    onCancel,
  } = config;

  const handleConfirm = () => {
    onConfirm();
    closeDialog();
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    closeDialog();
  };

  const getThemeColor = () => {
    switch (type) {
      case 'danger':
        return {
          iconBg: 'bg-rose-50 border-rose-100',
          icon: <ShieldAlert className="w-6 h-6 text-rose-600" />,
          btn: 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500/20',
        };
      case 'success':
        return {
          iconBg: 'bg-emerald-50 border-emerald-100',
          icon: <AlertCircle className="w-6 h-6 text-emerald-600" />,
          btn: 'bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500/20',
        };
      default:
        return {
          iconBg: 'bg-blue-50 border-blue-100',
          icon: <HelpCircle className="w-6 h-6 text-blue-600" />,
          btn: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500/20',
        };
    }
  };

  const theme = getThemeColor();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto no-print" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      {/* Overlay Backdrop */}
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div 
          onClick={handleCancel}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300" 
          aria-hidden="true"
        ></div>

        {/* Center alignment spacer */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        {/* Dialog Panel */}
        <div className="relative inline-block align-bottom bg-white rounded-3xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md sm:w-full border border-slate-100">
          <div className="absolute top-4 right-4">
            <button 
              onClick={handleCancel}
              className="text-slate-400 hover:text-slate-650 hover:bg-slate-100/50 p-1.5 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-white px-6 pt-6 pb-4">
            <div className="sm:flex sm:items-start gap-4">
              {/* Severity Icon */}
              <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-2xl border ${theme.iconBg} sm:mx-0`}>
                {theme.icon}
              </div>

              {/* Text content */}
              <div className="mt-3 text-center sm:mt-0 sm:text-left space-y-1">
                <h3 className="text-base font-bold text-slate-800" id="modal-title">
                  {title}
                </h3>
                <p className="text-xs leading-relaxed text-slate-500 font-medium">
                  {message}
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="bg-slate-50/50 px-6 py-4 flex flex-col sm:flex-row-reverse gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleConfirm}
              className={`w-full sm:w-auto inline-flex justify-center items-center px-4 py-2 border border-transparent text-xs font-bold rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all cursor-pointer ${theme.btn}`}
            >
              {confirmText}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2 border border-slate-200 text-xs font-semibold rounded-xl text-slate-650 bg-white hover:bg-slate-50 focus:outline-none transition-all cursor-pointer"
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
