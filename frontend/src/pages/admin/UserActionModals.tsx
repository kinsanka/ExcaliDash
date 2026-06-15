import React from 'react';
import { ConfirmModal } from '../../components/ConfirmModal';
import type { AdminUser } from './types';
import { useI18n } from '../../context/I18nContext';

type PasswordResult = {
  email: string;
  tempPassword: string;
};

type UserActionModalsProps = {
  impersonateTarget: AdminUser | null;
  resetPasswordResult: PasswordResult | null;
  onConfirmImpersonation: (user: AdminUser) => void | Promise<void>;
  onCancelImpersonation: () => void;
  onCopyPassword: (result: PasswordResult) => void | Promise<void>;
  onClosePassword: () => void;
};

export const UserActionModals: React.FC<UserActionModalsProps> = ({
  impersonateTarget,
  resetPasswordResult,
  onConfirmImpersonation,
  onCancelImpersonation,
  onCopyPassword,
  onClosePassword,
}) => {
  const { t } = useI18n();

  return (
  <>
    <ConfirmModal
      isOpen={Boolean(impersonateTarget)}
      title={t('admin.startImpersonation')}
      message={
        impersonateTarget
          ? t('admin.impersonationConfirm', { email: impersonateTarget.email })
          : ''
      }
      confirmText={t('admin.impersonate')}
      onConfirm={() => {
        if (impersonateTarget) {
          void onConfirmImpersonation(impersonateTarget);
        }
        onCancelImpersonation();
      }}
      onCancel={onCancelImpersonation}
    />

    <ConfirmModal
      isOpen={Boolean(resetPasswordResult)}
      title={t('admin.tempPasswordTitle')}
      message={
        resetPasswordResult ? (
          <div className="space-y-3">
            <div className="text-xs">
              {t('admin.tempPasswordDesc', { email: resetPasswordResult.email })}
            </div>
            <div className="px-3 py-2 rounded-xl border-2 border-black dark:border-neutral-700 bg-white dark:bg-neutral-900 font-mono text-sm text-slate-900 dark:text-neutral-100 break-all">
              {resetPasswordResult.tempPassword}
            </div>
          </div>
        ) : (
          ''
        )
      }
      confirmText={t('admin.copy')}
      cancelText={t('admin.close')}
      isDangerous={false}
      variant="success"
      onConfirm={() => {
        if (!resetPasswordResult) return;
        void onCopyPassword(resetPasswordResult);
        onClosePassword();
      }}
      onCancel={onClosePassword}
    />
  </>
  );
};
