import { Link } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { useI18n } from '../context/I18nContext';

export const PasswordResetRequest: React.FC = () => {
  const { t } = useI18n();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Logo className="mx-auto h-12 w-auto" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            {t("auth.passwordHelp")}
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {t("auth.noResetEmail")}
          </p>
        </div>
        <div className="mt-8 space-y-6">
          <div className="rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 text-left space-y-3">
            <div className="text-sm text-gray-700 dark:text-gray-200">
              {t("auth.contactAdminForPassword")}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-300">
              {t("auth.ifLockedOut")}
            </div>
            <pre className="text-xs bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-3 overflow-x-auto">
cd backend && node scripts/admin-recover.cjs --identifier you@example.com --generate --activate --disable-login-rate-limit
            </pre>
          </div>

          <div className="text-center">
            <Link
              to="/login"
              className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
            >
              {t("auth.backToLogin")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
