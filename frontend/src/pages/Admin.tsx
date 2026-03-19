import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBeforeUnload, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ConfirmModal } from '../components/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';
import type { Collection } from '../types';
import { Shield, UserPlus, RefreshCw, UserCog, LogIn, Settings as SettingsIcon, KeyRound } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { getPasswordPolicy, validatePassword } from '../utils/passwordPolicy';
import { PasswordRequirements } from '../components/PasswordRequirements';
import { useI18n } from '../context/I18nContext';
import {
  IMPERSONATION_KEY,
  type ImpersonationState,
  readImpersonationState,
  USER_KEY,
} from '../utils/impersonation';

type AdminUser = {
  id: string;
  username: string | null;
  email: string;
  name: string;
  role: 'ADMIN' | 'USER' | string;
  mustResetPassword: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type LoginRateLimitFormState = {
  enabled: boolean;
  windowMinutes: number;
  max: number;
};

const sanitizePositiveInt = (value: number, fallback = 1) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.round(value));
};

export const Admin: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { user: authUser, authEnabled } = useAuth();
  const isAdmin = authUser?.role === 'ADMIN';
  const passwordPolicy = getPasswordPolicy({ translate: t });
  const text = {
    loading: t('common.loading'),
    title: t('admin.title'),
    subtitle: t('admin.subtitle'),
    refresh: t('admin.refresh'),
    newUser: t('admin.newUser'),
    failedLoadUsers: t('admin.failedLoadUsers'),
    failedRegistrationStatus: t('admin.failedRegistrationStatus'),
    registrationEnabled: t('admin.registrationEnabled'),
    registrationDisabled: t('admin.registrationDisabled'),
    failedRegistrationUpdate: t('admin.failedRegistrationUpdate'),
    tempPasswordGeneratedFor: (email: string) => t('admin.tempPasswordGeneratedFor', { email }),
    failedResetPassword: t('admin.failedResetPassword'),
    failedRateLimitLoad: t('admin.failedRateLimitLoad'),
    rateLimitSaved: t('admin.rateLimitSaved'),
    failedRateLimitSave: t('admin.failedRateLimitSave'),
    enterIdentifier: t('admin.enterIdentifier'),
    resetRateLimitSuccess: (identifier: string) => t('admin.resetRateLimitSuccess', { identifier }),
    failedRateLimitReset: t('admin.failedRateLimitReset'),
    userCreated: t('admin.userCreated'),
    failedCreateUser: t('admin.failedCreateUser'),
    userUpdated: t('admin.userUpdated'),
    failedUpdateUser: t('admin.failedUpdateUser'),
    stopCurrentImpersonation: t('admin.stopCurrentImpersonation'),
    missingSessionState: t('admin.missingSessionState'),
    unknownAdmin: t('admin.unknownAdmin'),
    failedImpersonate: t('admin.failedImpersonate'),
    createUserTitle: t('admin.createUserTitle'),
    emailAddress: t('admin.emailAddress'),
    displayName: t('admin.displayName'),
    username: t('admin.username'),
    optional: t('admin.optional'),
    tempPassword: t('admin.tempPassword'),
    role: t('admin.role'),
    roleUser: t('admin.roleUser'),
    roleAdmin: t('admin.roleAdmin'),
    passwordReset: t('admin.passwordReset'),
    mustResetPassword: t('admin.mustResetPassword'),
    noResetRequired: t('admin.noResetRequired'),
    accountStatus: t('admin.accountStatus'),
    active: t('admin.active'),
    inactive: t('admin.inactive'),
    create: t('admin.create'),
    userRegistration: t('admin.userRegistration'),
    userRegistrationEnabledDesc: t('admin.userRegistrationEnabledDesc'),
    userRegistrationDisabledDesc: t('admin.userRegistrationDisabledDesc'),
    registration: t('admin.registration'),
    saving: t('admin.saving'),
    enabled: t('admin.enabled'),
    disabled: t('admin.disabled'),
    loginRateLimiting: t('admin.loginRateLimiting'),
    loginRateLimitingDesc: t('admin.loginRateLimitingDesc'),
    rateLimiting: t('admin.rateLimiting'),
    windowMinutes: t('admin.windowMinutes'),
    maxAttempts: t('admin.maxAttempts'),
    resetLockout: t('admin.resetLockout'),
    resetLockoutPlaceholder: t('admin.resetLockoutPlaceholder'),
    unsavedChanges: t('admin.unsavedChanges'),
    allChangesSaved: t('admin.allChangesSaved'),
    resetting: t('admin.resetting'),
    reset: t('admin.reset'),
    users: t('admin.users'),
    user: t('admin.user'),
    mustReset: t('admin.mustReset'),
    actions: t('admin.actions'),
    yes: t('admin.yes'),
    no: t('admin.no'),
    impersonate: t('admin.impersonate'),
    useProfileForOwnPassword: t('admin.useProfileForOwnPassword'),
    generateTempPassword: t('admin.generateTempPassword'),
    generating: t('admin.generating'),
    resetPassword: t('admin.resetPassword'),
    noUsersFound: t('admin.noUsersFound'),
    startImpersonation: t('admin.startImpersonation'),
    impersonationConfirm: (email: string) => t('admin.impersonationConfirm', { email }),
    tempPasswordTitle: t('admin.tempPasswordTitle'),
    tempPasswordDesc: (email: string) => t('admin.tempPasswordDesc', { email }),
    copy: t('admin.copy'),
    close: t('admin.close'),
  };

  const [collections, setCollections] = useState<Collection[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createName, setCreateName] = useState('');
  const [createUsername, setCreateUsername] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState<'ADMIN' | 'USER'>('USER');
  const [createMustReset, setCreateMustReset] = useState(true);
  const [createActive, setCreateActive] = useState(true);

  const [impersonateTarget, setImpersonateTarget] = useState<AdminUser | null>(null);
  const [resetPasswordLoadingId, setResetPasswordLoadingId] = useState<string | null>(null);
  const [resetPasswordResult, setResetPasswordResult] = useState<{ email: string; tempPassword: string } | null>(null);

  const [registrationEnabled, setRegistrationEnabled] = useState<boolean | null>(null);
  const [registrationLoading, setRegistrationLoading] = useState(false);

  const [loginRateLimitLoading, setLoginRateLimitLoading] = useState(false);
  const [loginRateLimitSaving, setLoginRateLimitSaving] = useState(false);
  const [loginRateLimitEnabled, setLoginRateLimitEnabled] = useState(true);
  const [loginRateLimitWindowMinutes, setLoginRateLimitWindowMinutes] = useState(15);
  const [loginRateLimitMax, setLoginRateLimitMax] = useState(20);
  const [savedLoginRateLimit, setSavedLoginRateLimit] = useState<LoginRateLimitFormState | null>(null);
  const [loginRateLimitAutoSaveQueued, setLoginRateLimitAutoSaveQueued] = useState(false);
  const lastAutoSaveAttemptKeyRef = useRef<string | null>(null);
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const normalizedLoginRateLimit = useMemo<LoginRateLimitFormState>(
    () => ({
      enabled: loginRateLimitEnabled,
      windowMinutes: sanitizePositiveInt(loginRateLimitWindowMinutes),
      max: sanitizePositiveInt(loginRateLimitMax),
    }),
    [loginRateLimitEnabled, loginRateLimitWindowMinutes, loginRateLimitMax]
  );

  const loginRateLimitDirty = Boolean(
    savedLoginRateLimit &&
      (savedLoginRateLimit.enabled !== normalizedLoginRateLimit.enabled ||
        savedLoginRateLimit.windowMinutes !== normalizedLoginRateLimit.windowMinutes ||
        savedLoginRateLimit.max !== normalizedLoginRateLimit.max)
  );

  const hasPendingLoginRateLimitChanges = loginRateLimitDirty || loginRateLimitSaving || loginRateLimitAutoSaveQueued;
  const normalizedLoginRateLimitKey = `${normalizedLoginRateLimit.enabled}:${normalizedLoginRateLimit.windowMinutes}:${normalizedLoginRateLimit.max}`;

  useEffect(() => {
    if (authEnabled === false) {
      navigate('/settings', { replace: true });
      return;
    }
    if (authEnabled && !isAdmin) {
      navigate('/', { replace: true });
      return;
    }
  }, [authEnabled, isAdmin, navigate]);

  const loadCollections = async () => {
    try {
      const data = await api.getCollections();
      setCollections(data);
    } catch (err) {
      console.error('Failed to fetch collections:', err);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    setError('');
    try {
      const response = await api.api.get<{ users: AdminUser[] }>('/auth/users');
      setUsers(response.data.users || []);
    } catch (err: unknown) {
      let message = text.failedLoadUsers;
      if (api.isAxiosError(err)) {
        message = err.response?.data?.message || err.response?.data?.error || message;
      }
      setError(message);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadRegistrationStatus = async () => {
    setRegistrationLoading(true);
    try {
      const response = await api.api.get<{ registrationEnabled: boolean }>('/auth/status');
      setRegistrationEnabled(Boolean(response.data.registrationEnabled));
    } catch (err: unknown) {
      let message = text.failedRegistrationStatus;
      if (api.isAxiosError(err)) {
        message = err.response?.data?.message || err.response?.data?.error || message;
      }
      setError(message);
    } finally {
      setRegistrationLoading(false);
    }
  };

  const toggleRegistration = async () => {
    if (!isAdmin || registrationEnabled === null) return;

    setRegistrationLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.api.post<{ registrationEnabled: boolean }>('/auth/registration/toggle', {
        enabled: !registrationEnabled,
      });
      setRegistrationEnabled(Boolean(response.data.registrationEnabled));
      setSuccess(response.data.registrationEnabled ? text.registrationEnabled : text.registrationDisabled);
    } catch (err: unknown) {
      let message = text.failedRegistrationUpdate;
      if (api.isAxiosError(err)) {
        message = err.response?.data?.message || err.response?.data?.error || message;
      }
      setError(message);
    } finally {
      setRegistrationLoading(false);
    }
  };

  const generateTempPassword = async (target: AdminUser) => {
    setResetPasswordLoadingId(target.id);
    setError('');
    setSuccess('');
    try {
      const response = await api.api.post<{ tempPassword: string; user: { id: string; email: string } }>(
        `/auth/users/${target.id}/reset-password`
      );
      setResetPasswordResult({ email: response.data.user?.email || target.email, tempPassword: response.data.tempPassword });
      setSuccess(text.tempPasswordGeneratedFor(target.email));
      await loadUsers();
    } catch (err: unknown) {
      let message = text.failedResetPassword;
      if (api.isAxiosError(err)) {
        message = err.response?.data?.message || err.response?.data?.error || message;
      }
      setError(message);
    } finally {
      setResetPasswordLoadingId(null);
    }
  };

  const loadLoginRateLimitConfig = async () => {
    setLoginRateLimitLoading(true);
    setError('');
    setSavedLoginRateLimit(null);
    setLoginRateLimitAutoSaveQueued(false);
    lastAutoSaveAttemptKeyRef.current = null;
    try {
      const response = await api.api.get<{
        config: { enabled: boolean; windowMs: number; max: number };
      }>('/auth/rate-limit/login');
      const cfg = response.data.config;
      const nextConfig: LoginRateLimitFormState = {
        enabled: Boolean(cfg.enabled),
        windowMinutes: sanitizePositiveInt(Number(cfg.windowMs) / 60000),
        max: sanitizePositiveInt(Number(cfg.max)),
      };
      setLoginRateLimitEnabled(nextConfig.enabled);
      setLoginRateLimitWindowMinutes(nextConfig.windowMinutes);
      setLoginRateLimitMax(nextConfig.max);
      setSavedLoginRateLimit(nextConfig);
    } catch (err: unknown) {
      let message = text.failedRateLimitLoad;
      if (api.isAxiosError(err)) {
        message = err.response?.data?.message || err.response?.data?.error || message;
      }
      setError(message);
    } finally {
      setLoginRateLimitLoading(false);
    }
  };

  const saveLoginRateLimitConfig = useCallback(async () => {
    if (loginRateLimitSaving) return;
    setLoginRateLimitSaving(true);
    setError('');
    try {
      const payload = {
        enabled: normalizedLoginRateLimit.enabled,
        windowMs: Math.max(10_000, Math.round(normalizedLoginRateLimit.windowMinutes * 60_000)),
        max: sanitizePositiveInt(normalizedLoginRateLimit.max),
      };
      const response = await api.api.put<{
        config: { enabled: boolean; windowMs: number; max: number };
      }>('/auth/rate-limit/login', payload);

      const cfg = response.data.config;
      const nextConfig: LoginRateLimitFormState = {
        enabled: Boolean(cfg.enabled),
        windowMinutes: sanitizePositiveInt(Number(cfg.windowMs) / 60000),
        max: sanitizePositiveInt(Number(cfg.max)),
      };
      setLoginRateLimitEnabled(nextConfig.enabled);
      setLoginRateLimitWindowMinutes(nextConfig.windowMinutes);
      setLoginRateLimitMax(nextConfig.max);
      setSavedLoginRateLimit(nextConfig);
      setLoginRateLimitAutoSaveQueued(false);
      toast.success(text.rateLimitSaved);
    } catch (err: unknown) {
      let message = text.failedRateLimitSave;
      if (api.isAxiosError(err)) {
        message = err.response?.data?.message || err.response?.data?.error || message;
      }
      setError(message);
    } finally {
      setLoginRateLimitSaving(false);
    }
  }, [loginRateLimitSaving, normalizedLoginRateLimit]);

  const resetLoginRateLimit = async () => {
    const identifier = resetIdentifier.trim();
    if (!identifier) {
      setError(text.enterIdentifier);
      return;
    }
    setResetLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.api.post('/auth/rate-limit/login/reset', { identifier });
      setSuccess(text.resetRateLimitSuccess(identifier));
      setResetIdentifier('');
    } catch (err: unknown) {
      let message = text.failedRateLimitReset;
      if (api.isAxiosError(err)) {
        message = err.response?.data?.message || err.response?.data?.error || message;
      }
      setError(message);
    } finally {
      setResetLoading(false);
    }
  };

  useEffect(() => {
    if (!authEnabled || !isAdmin) return;
    void loadCollections();
    void loadUsers();
    void loadLoginRateLimitConfig();
    void loadRegistrationStatus();
  }, [authEnabled, isAdmin]);

  useEffect(() => {
    if (!authEnabled || !isAdmin) return;
    if (!savedLoginRateLimit || !loginRateLimitDirty || loginRateLimitSaving) return;
    if (lastAutoSaveAttemptKeyRef.current === normalizedLoginRateLimitKey) return;

    setLoginRateLimitAutoSaveQueued(true);
    const timeoutId = window.setTimeout(() => {
      setLoginRateLimitAutoSaveQueued(false);
      lastAutoSaveAttemptKeyRef.current = normalizedLoginRateLimitKey;
      void saveLoginRateLimitConfig();
    }, 900);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    authEnabled,
    isAdmin,
    savedLoginRateLimit,
    loginRateLimitDirty,
    loginRateLimitSaving,
    normalizedLoginRateLimitKey,
    saveLoginRateLimitConfig,
  ]);

  useEffect(() => {
    if (!loginRateLimitDirty) {
      setLoginRateLimitAutoSaveQueued(false);
      lastAutoSaveAttemptKeyRef.current = null;
    }
  }, [loginRateLimitDirty]);

  useBeforeUnload(
    useCallback(
      (event: BeforeUnloadEvent) => {
        if (!hasPendingLoginRateLimitChanges) return;
        event.preventDefault();
        event.returnValue = '';
      },
      [hasPendingLoginRateLimitChanges]
    )
  );

  const handleSelectCollection = (id: string | null | undefined) => {
    if (id === undefined) navigate('/');
    else if (id === null) navigate('/collections?id=unorganized');
    else navigate(`/collections?id=${id}`);
  };

  const handleCreateCollection = async (name: string) => {
    await api.createCollection(name);
    const newCollections = await api.getCollections();
    setCollections(newCollections);
  };

  const handleEditCollection = async (id: string, name: string) => {
    setCollections(prev => prev.map(c => (c.id === id ? { ...c, name } : c)));
    await api.updateCollection(id, name);
  };

  const handleDeleteCollection = async (id: string) => {
    setCollections(prev => prev.filter(c => c.id !== id));
    await api.deleteCollection(id);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const passwordError = validatePassword(createPassword, passwordPolicy);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    try {
      const payload = {
        email: createEmail.trim().toLowerCase(),
        name: createName.trim(),
        username: createUsername.trim() ? createUsername.trim() : undefined,
        password: createPassword,
        role: createRole,
        mustResetPassword: createMustReset,
        isActive: createActive,
      };

      const response = await api.api.post<{ user: AdminUser }>('/auth/users', payload);
      setUsers(prev => [...prev, response.data.user].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      setSuccess(text.userCreated);
      setCreateEmail('');
      setCreateName('');
      setCreateUsername('');
      setCreatePassword('');
      setCreateRole('USER');
      setCreateMustReset(true);
      setCreateActive(true);
      setCreateOpen(false);
    } catch (err: unknown) {
      let message = text.failedCreateUser;
      if (api.isAxiosError(err)) {
        message = err.response?.data?.message || err.response?.data?.error || message;
      }
      setError(message);
    }
  };

  const patchUser = async (id: string, data: Partial<Pick<AdminUser, 'username' | 'name' | 'role' | 'mustResetPassword' | 'isActive'>>) => {
    setError('');
    setSuccess('');
    try {
      const response = await api.api.patch<{ user: AdminUser }>(`/auth/users/${id}`, data);
      setUsers(prev => prev.map(u => (u.id === id ? response.data.user : u)));
      setSuccess(text.userUpdated);
    } catch (err: unknown) {
      let message = text.failedUpdateUser;
      if (api.isAxiosError(err)) {
        message = err.response?.data?.message || err.response?.data?.error || message;
      }
      setError(message);
    }
  };

  const startImpersonation = async (target: AdminUser) => {
    setError('');
    setSuccess('');

    if (readImpersonationState()) {
      setError(text.stopCurrentImpersonation);
      return;
    }

    const originalUser = localStorage.getItem(USER_KEY);
    if (!originalUser) {
      setError(text.missingSessionState);
      return;
    }

    try {
      const response = await api.api.post<{
        user: { id: string; email: string; name: string };
      }>('/auth/impersonate', { userId: target.id });

      const state: ImpersonationState = {
        original: {
          user: JSON.parse(originalUser),
        },
        impersonator: {
          id: authUser?.id || 'unknown',
          email: authUser?.email || 'unknown',
          name: authUser?.name || text.unknownAdmin,
        },
        target: {
          id: response.data.user.id,
          email: response.data.user.email,
          name: response.data.user.name,
        },
        startedAt: new Date().toISOString(),
      };

      localStorage.setItem(IMPERSONATION_KEY, JSON.stringify(state));
      localStorage.setItem(USER_KEY, JSON.stringify(response.data.user));

      window.location.href = '/';
    } catch (err: unknown) {
      let message = text.failedImpersonate;
      if (api.isAxiosError(err)) {
        message = err.response?.data?.message || err.response?.data?.error || message;
      }
      setError(message);
    }
  };

  if (authEnabled === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">{text.loading}</div>
      </div>
    );
  }

  return (
    <Layout
      collections={collections}
      selectedCollectionId="ADMIN"
      onSelectCollection={handleSelectCollection}
      onCreateCollection={handleCreateCollection}
      onEditCollection={handleEditCollection}
      onDeleteCollection={handleDeleteCollection}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 sm:mb-8 min-w-0">
        <div className="min-w-0">
          <h1 className="text-3xl sm:text-5xl text-slate-900 dark:text-white pl-1" style={{ fontFamily: 'Excalifont' }}>
            {text.title}
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-neutral-400 font-medium">
            {text.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => loadUsers()}
            disabled={loadingUsers}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl border-2 border-black dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-neutral-200 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] hover:-translate-y-0.5 transition-all disabled:opacity-60"
          >
            <RefreshCw size={16} />
            {text.refresh}
          </button>
          <button
            onClick={() => setCreateOpen(v => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl border-2 border-black dark:border-neutral-700 bg-indigo-600 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all"
          >
            <UserPlus size={16} />
            {text.newUser}
          </button>
        </div>
      </div>

      {success && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-xl">
          <p className="text-green-800 dark:text-green-200 font-medium">{success}</p>
        </div>
      )}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl">
          <p className="text-red-800 dark:text-red-200 font-medium">{error}</p>
        </div>
      )}

      {createOpen && (
        <div className="mb-6 bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-700 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-indigo-50 dark:bg-neutral-800 rounded-xl flex items-center justify-center border-2 border-indigo-100 dark:border-neutral-700">
              <UserCog size={24} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{text.createUserTitle}</h2>
          </div>

          <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-neutral-300 mb-2">{text.emailAddress}</label>
              <input
                type="email"
                value={createEmail}
                onChange={e => setCreateEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border-2 border-slate-200 dark:border-neutral-700 rounded-xl text-slate-900 dark:text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-neutral-300 mb-2">{text.displayName}</label>
              <input
                type="text"
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                required
                className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border-2 border-slate-200 dark:border-neutral-700 rounded-xl text-slate-900 dark:text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-neutral-300 mb-2">{text.username} ({text.optional})</label>
              <input
                type="text"
                value={createUsername}
                onChange={e => setCreateUsername(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border-2 border-slate-200 dark:border-neutral-700 rounded-xl text-slate-900 dark:text-white outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-neutral-300 mb-2">{text.tempPassword}</label>
              <input
                type="password"
                value={createPassword}
                onChange={e => setCreatePassword(e.target.value)}
                minLength={passwordPolicy.minLength}
                maxLength={passwordPolicy.maxLength}
                pattern={passwordPolicy.patternHtml}
                required
                className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border-2 border-slate-200 dark:border-neutral-700 rounded-xl text-slate-900 dark:text-white outline-none"
              />
              <PasswordRequirements
                password={createPassword}
                policy={passwordPolicy}
                className="text-slate-600 dark:text-neutral-400"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-neutral-300 mb-2">{text.role}</label>
              <select
                value={createRole}
                onChange={e => setCreateRole(e.target.value as 'ADMIN' | 'USER')}
                className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border-2 border-slate-200 dark:border-neutral-700 rounded-xl text-slate-900 dark:text-white outline-none"
              >
                <option value="USER">{text.roleUser}</option>
                <option value="ADMIN">{text.roleAdmin}</option>
              </select>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
              <div className="flex-1 w-full">
                <label className="block text-sm font-bold text-slate-700 dark:text-neutral-300 mb-2">{text.passwordReset}</label>
                <button
                  type="button"
                  onClick={() => setCreateMustReset(!createMustReset)}
                  className={`w-full px-4 py-3 rounded-xl border-2 font-bold transition-all text-sm ${
                    createMustReset
                      ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200'
                      : 'border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-300'
                  }`}
                >
                  {createMustReset ? text.mustResetPassword : text.noResetRequired}
                </button>
              </div>
              <div className="flex-1 w-full">
                <label className="block text-sm font-bold text-slate-700 dark:text-neutral-300 mb-2">{text.accountStatus}</label>
                <button
                  type="button"
                  onClick={() => setCreateActive(!createActive)}
                  className={`w-full px-4 py-3 rounded-xl border-2 font-bold transition-all text-sm ${
                    createActive
                      ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                      : 'border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-300'
                  }`}
                >
                  {createActive ? text.active : text.inactive}
                </button>
              </div>
            </div>

            <div className="md:col-span-2 flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="px-4 py-2 text-sm font-bold rounded-xl border-2 border-black dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-neutral-200"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-bold rounded-xl border-2 border-black dark:border-neutral-700 bg-indigo-600 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all"
              >
                {text.create}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mb-6 bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-700 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-emerald-50 dark:bg-neutral-800 rounded-xl flex items-center justify-center border-2 border-emerald-100 dark:border-neutral-700">
            <UserPlus size={24} className="text-emerald-700 dark:text-emerald-300" />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{text.userRegistration}</h2>
            <p className="text-sm text-slate-600 dark:text-neutral-400 font-medium">
              {registrationEnabled === null
                ? text.loading
                : registrationEnabled
                  ? text.userRegistrationEnabledDesc
                  : text.userRegistrationDisabledDesc}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-neutral-300 mb-2">{text.registration}</label>
            <button
              type="button"
              onClick={() => void toggleRegistration()}
              disabled={registrationLoading || registrationEnabled === null}
              className={`w-full px-4 py-3 rounded-xl border-2 font-bold transition-all text-sm ${
                registrationEnabled
                  ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                  : 'border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-300'
              }`}
            >
              {registrationEnabled === null ? text.loading : registrationLoading ? text.saving : registrationEnabled ? text.enabled : text.disabled}
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6 bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-700 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-slate-50 dark:bg-neutral-800 rounded-xl flex items-center justify-center border-2 border-slate-200 dark:border-neutral-700">
            <SettingsIcon size={24} className="text-slate-700 dark:text-neutral-200" />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{text.loginRateLimiting}</h2>
            <p className="text-sm text-slate-600 dark:text-neutral-400 font-medium">
              {text.loginRateLimitingDesc}
            </p>
          </div>
          {loginRateLimitLoading && (
            <span className="ml-auto text-sm text-slate-500 dark:text-neutral-500 font-medium">{text.loading}</span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-neutral-300 mb-2">{text.rateLimiting}</label>
            <button
              type="button"
              onClick={() => setLoginRateLimitEnabled(!loginRateLimitEnabled)}
              className={`w-full px-4 py-3 rounded-xl border-2 font-bold transition-all text-sm ${
                loginRateLimitEnabled
                  ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                  : 'border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-300'
              }`}
            >
              {loginRateLimitEnabled ? text.enabled : text.disabled}
            </button>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-neutral-300 mb-2">{text.windowMinutes}</label>
            <input
              type="number"
              min={1}
              value={loginRateLimitWindowMinutes}
              onChange={e => setLoginRateLimitWindowMinutes(Number(e.target.value))}
              className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border-2 border-slate-200 dark:border-neutral-700 rounded-xl text-slate-900 dark:text-white outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-neutral-300 mb-2">{text.maxAttempts}</label>
            <input
              type="number"
              min={1}
              value={loginRateLimitMax}
              onChange={e => setLoginRateLimitMax(Number(e.target.value))}
              className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border-2 border-slate-200 dark:border-neutral-700 rounded-xl text-slate-900 dark:text-white outline-none"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <label className="block text-sm font-bold text-slate-700 dark:text-neutral-300 mb-2">
              {text.resetLockout}
            </label>
            <input
              list="admin-user-identifiers"
              value={resetIdentifier}
              onChange={e => setResetIdentifier(e.target.value)}
              placeholder={text.resetLockoutPlaceholder}
              className="w-full px-4 py-3 bg-white dark:bg-neutral-800 border-2 border-slate-200 dark:border-neutral-700 rounded-xl text-slate-900 dark:text-white outline-none"
            />
            <datalist id="admin-user-identifiers">
              {users.map(u => (
                <option key={u.id} value={u.email} />
              ))}
            </datalist>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-neutral-400">
              {loginRateLimitSaving || loginRateLimitAutoSaveQueued
                ? text.saving
                : loginRateLimitDirty
                  ? text.unsavedChanges
                  : text.allChangesSaved}
            </p>
            <button
              onClick={() => void resetLoginRateLimit()}
              disabled={resetLoading}
              className="px-4 py-2 text-sm font-bold rounded-xl border-2 border-black dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-neutral-200 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] hover:-translate-y-0.5 transition-all disabled:opacity-60"
            >
              {resetLoading ? text.resetting : text.reset}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-700 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b-2 border-slate-200 dark:border-neutral-700 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 dark:bg-neutral-800 rounded-xl flex items-center justify-center border-2 border-indigo-100 dark:border-neutral-700">
            <Shield size={20} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{text.users}</h2>
          {loadingUsers && <span className="text-sm text-slate-500 dark:text-neutral-500 font-medium">{text.loading}</span>}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-neutral-800/70">
              <tr className="text-left">
                <th className="px-4 sm:px-6 py-3 font-bold text-slate-600 dark:text-neutral-300">{text.user}</th>
                <th className="px-4 sm:px-6 py-3 font-bold text-slate-600 dark:text-neutral-300">{text.role}</th>
                <th className="px-4 sm:px-6 py-3 font-bold text-slate-600 dark:text-neutral-300">{text.active}</th>
                <th className="px-4 sm:px-6 py-3 font-bold text-slate-600 dark:text-neutral-300">{text.mustReset}</th>
                <th className="px-4 sm:px-6 py-3 font-bold text-slate-600 dark:text-neutral-300">{text.actions}</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-t border-slate-100 dark:border-neutral-800">
                  <td className="px-4 sm:px-6 py-4 min-w-[220px]">
                    <div className="font-bold text-slate-900 dark:text-white truncate">{u.name}</div>
                    <div className="text-slate-500 dark:text-neutral-400 truncate">{u.email}</div>
                    {u.username && <div className="text-xs text-slate-400 dark:text-neutral-500">@{u.username}</div>}
                  </td>
                  <td className="px-4 sm:px-6 py-4">
                    <select
                      value={u.role}
                      onChange={e => patchUser(u.id, { role: e.target.value })}
                      disabled={u.id === authUser?.id}
                      className="px-3 py-2 bg-white dark:bg-neutral-800 border-2 border-slate-200 dark:border-neutral-700 rounded-xl font-bold text-slate-900 dark:text-white"
                    >
                      <option value="USER">{text.roleUser}</option>
                      <option value="ADMIN">{text.roleAdmin}</option>
                    </select>
                  </td>
                  <td className="px-4 sm:px-6 py-4">
                    <button
                      onClick={() => patchUser(u.id, { isActive: !u.isActive })}
                      disabled={u.id === authUser?.id}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 font-bold ${
                        u.isActive
                          ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                          : 'border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-300'
                      }`}
                    >
                      {u.isActive ? text.active : text.inactive}
                    </button>
                  </td>
                  <td className="px-4 sm:px-6 py-4">
                    <button
                      onClick={() => patchUser(u.id, { mustResetPassword: !u.mustResetPassword })}
                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 font-bold ${
                        u.mustResetPassword
                          ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200'
                          : 'border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-300'
                      }`}
                    >
                      {u.mustResetPassword ? text.yes : text.no}
                    </button>
                  </td>
                  <td className="px-4 sm:px-6 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setImpersonateTarget(u)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-black dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-neutral-200 font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] hover:-translate-y-0.5 transition-all"
                      >
                        <LogIn size={16} />
                        {text.impersonate}
                      </button>
                      <button
                        onClick={() => void generateTempPassword(u)}
                        disabled={u.id === authUser?.id || resetPasswordLoadingId === u.id}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-black dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-900 dark:text-neutral-200 font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:hover:translate-y-0"
                        title={u.id === authUser?.id ? text.useProfileForOwnPassword : text.generateTempPassword}
                      >
                        <KeyRound size={16} />
                        {resetPasswordLoadingId === u.id ? text.generating : text.resetPassword}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && !loadingUsers && (
                <tr>
                  <td colSpan={5} className="px-6 py-6 text-slate-500 dark:text-neutral-500 font-medium">
                    {text.noUsersFound}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!impersonateTarget}
        title={text.startImpersonation}
        message={
          impersonateTarget
            ? text.impersonationConfirm(impersonateTarget.email)
            : ''
        }
        confirmText={text.impersonate}
        onConfirm={() => {
          if (impersonateTarget) {
            void startImpersonation(impersonateTarget);
          }
          setImpersonateTarget(null);
        }}
        onCancel={() => setImpersonateTarget(null)}
      />

      <ConfirmModal
        isOpen={!!resetPasswordResult}
        title={text.tempPasswordTitle}
        message={
          resetPasswordResult ? (
            <div className="space-y-3">
              <div className="text-xs">
                {text.tempPasswordDesc(resetPasswordResult.email)}
              </div>
              <div className="px-3 py-2 rounded-xl border-2 border-black dark:border-neutral-700 bg-white dark:bg-neutral-900 font-mono text-sm text-slate-900 dark:text-neutral-100 break-all">
                {resetPasswordResult.tempPassword}
              </div>
            </div>
          ) : (
            ''
          )
        }
        confirmText={text.copy}
        cancelText={text.close}
        isDangerous={false}
        variant="success"
        onConfirm={() => {
          if (!resetPasswordResult) return;
          void navigator.clipboard?.writeText(resetPasswordResult.tempPassword);
          setResetPasswordResult(null);
        }}
        onCancel={() => setResetPasswordResult(null)}
      />
      <Toaster position="bottom-center" />
    </Layout>
  );
};
