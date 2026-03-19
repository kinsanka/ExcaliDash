import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDangerous?: boolean;
  showCancel?: boolean;
  variant?: 'warning' | 'success';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = "Delete",
  cancelText,
  onConfirm,
  onCancel,
  isDangerous = true,
  showCancel = true,
  variant = 'warning'
}) => {
  const { t } = useI18n();
  if (!isOpen) return null;

  const isSuccess = variant === 'success';
  const IconComponent = isSuccess ? CheckCircle : AlertTriangle;
  const iconClasses = isSuccess 
    ? "w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-300 border-2 border-emerald-200 dark:border-emerald-900/30"
    : "w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-300 border-2 border-rose-200 dark:border-rose-900/30";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-neutral-900/20 backdrop-blur-sm"
        onClick={onCancel}
      />

      <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl border-2 border-black dark:border-neutral-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.08)] p-6 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center gap-4">
          <div className={iconClasses}>
            <IconComponent size={24} strokeWidth={2.5} />
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">{title}</h3>
            <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400 leading-relaxed">
              {message}
            </div>
          </div>

          <div className="flex gap-3 w-full mt-2">
            {showCancel && (
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2.5 bg-emerald-50 dark:bg-neutral-800 text-emerald-700 dark:text-emerald-200 font-bold rounded-xl border-2 border-emerald-200 dark:border-neutral-700 hover:bg-emerald-100 dark:hover:bg-neutral-700 hover:border-emerald-300 dark:hover:border-neutral-600 hover:-translate-y-0.5 transition-all duration-200"
              >
                {cancelText || t("common.cancel")}
              </button>
            )}

            <button
              onClick={onConfirm}
              className={`flex-1 px-4 py-2.5 font-bold rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all duration-200 ${isDangerous
                ? 'bg-rose-600 text-white'
                : 'bg-indigo-600 text-white'
                }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
