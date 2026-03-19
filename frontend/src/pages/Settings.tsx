import React, { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { useNavigate } from 'react-router-dom';
import * as api from '../api';
import type { Collection } from '../types';
import { Upload, Moon, Sun, Info, Archive, RefreshCw, Check } from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';
import { importLegacyFiles } from '../utils/importUtils';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';
import { useI18n } from '../context/I18nContext';

export const Settings: React.FC = () => {
    const { t, isChinese, toggleLanguage } = useI18n();
    const [collections, setCollections] = useState<Collection[]>([]);
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();
    const { authEnabled, user, authMode } = useAuth();

    const [legacyDbImportConfirmation, setLegacyDbImportConfirmation] = useState<{
        isOpen: boolean;
        file: File | null;
        info: null | {
            drawings: number;
            collections: number;
            legacyLatestMigration: string | null;
            currentLatestMigration: string | null;
        };
    }>({ isOpen: false, file: null, info: null });
    const [importError, setImportError] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: '' });
    const [importSuccess, setImportSuccess] = useState<{ isOpen: boolean; message: React.ReactNode }>({ isOpen: false, message: '' });
    const [legacyDbImportLoading, setLegacyDbImportLoading] = useState(false);
    const [authToggleLoading, setAuthToggleLoading] = useState(false);
    const [authToggleError, setAuthToggleError] = useState<string | null>(null);
    const [authToggleConfirm, setAuthToggleConfirm] = useState<{ isOpen: boolean; nextEnabled: boolean | null }>({
        isOpen: false,
        nextEnabled: null,
    });
    const [authDisableFinalConfirmOpen, setAuthDisableFinalConfirmOpen] = useState(false);

    const [backupExportExt, setBackupExportExt] = useState<'excalidash' | 'excalidash.zip'>('excalidash');
    const [backupImportConfirmation, setBackupImportConfirmation] = useState<{
        isOpen: boolean;
        file: File | null;
        info: null | {
            formatVersion: number;
            exportedAt: string;
            excalidashBackendVersion: string | null;
            collections: number;
            drawings: number;
        };
    }>({ isOpen: false, file: null, info: null });
    const [backupImportLoading, setBackupImportLoading] = useState(false);
    const [backupImportSuccess, setBackupImportSuccess] = useState(false);
    const [backupImportError, setBackupImportError] = useState<{ isOpen: boolean; message: string }>({ isOpen: false, message: '' });

    const appVersion = import.meta.env.VITE_APP_VERSION || 'Unknown version';
    const buildLabel = import.meta.env.VITE_APP_BUILD_LABEL;
    const isManagedAuthMode = authMode !== 'local';

    const UPDATE_CHANNEL_KEY = 'excalidash-update-channel';
    const UPDATE_INFO_KEY = 'excalidash-update-info';
    const [updateChannel, setUpdateChannel] = useState<api.UpdateChannel>(() => {
        const raw = typeof window === 'undefined' ? null : window.localStorage?.getItem?.(UPDATE_CHANNEL_KEY) ?? null;
        return raw === 'prerelease' ? 'prerelease' : 'stable';
    });
    const [updateInfo, setUpdateInfo] = useState<api.UpdateInfo | null>(null);
    const [updateLoading, setUpdateLoading] = useState(false);
    const [updateError, setUpdateError] = useState<string | null>(null);
    const settingsText = {
        failedCheckUpdates: t('settings.failedCheckUpdates'),
        failedUpdateAuth: t('settings.failedUpdateAuth'),
        failedExportBackup: t('settings.failedExportBackup'),
        failedVerifyBackup: t('settings.failedVerifyBackup'),
        failedVerifyLegacyDb: t('settings.failedVerifyLegacyDb'),
        importLegacyDbSeparately: t('settings.importLegacyDbSeparately'),
        importCompleteWithErrors: (success: number, failed: number, errors: string) =>
            t('settings.importCompleteWithErrors', { success, failed, errors }),
        importedFiles: (count: number) => t('settings.importedFiles', { count }),
        unknown: t('settings.unknown'),
        failedImportLegacyDb: t('settings.failedImportLegacyDb'),
        legacyDbImported: (
            collectionsCreated: number,
            collectionsUpdated: number,
            drawingsCreated: number,
            drawingsUpdated: number,
        ) =>
            t('settings.legacyDbImported', {
                collectionsCreated,
                collectionsUpdated,
                drawingsCreated,
                drawingsUpdated,
            }),
        failedImportBackup: t('settings.failedImportBackup'),
    };

    useEffect(() => {
        const fetchCollections = async () => {
            try {
                const data = await api.getCollections();
                setCollections(data);
            } catch (err) {
                console.error('Failed to fetch collections:', err);
            }
        };
        fetchCollections();
    }, []);

    const checkForUpdates = async (channel: api.UpdateChannel) => {
        setUpdateLoading(true);
        setUpdateError(null);
        try {
            const info = await api.getUpdateInfo(channel);
            setUpdateInfo(info);
            try {
                window.localStorage?.setItem?.(`${UPDATE_INFO_KEY}:${channel}`, JSON.stringify(info));
            } catch {
            }
        } catch (err: unknown) {
            let message = settingsText.failedCheckUpdates;
            if (api.isAxiosError(err)) {
                message =
                    err.response?.data?.message ||
                    err.response?.data?.error ||
                    message;
            }
            setUpdateError(message);
        } finally {
            setUpdateLoading(false);
        }
    };

    useEffect(() => {
        void checkForUpdates(updateChannel);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const setAuthEnabled = async (enabled: boolean) => {
        setAuthToggleLoading(true);
        setAuthToggleError(null);
        try {
            const response = await api.api.post<{ authEnabled: boolean; bootstrapRequired?: boolean }>(
                '/auth/auth-enabled',
                { enabled },
            );

            if (response.data.authEnabled) {
                window.location.href = response.data.bootstrapRequired ? '/register' : '/login';
                return;
            }

            window.location.reload();
        } catch (err: unknown) {
            let message = settingsText.failedUpdateAuth;
            if (api.isAxiosError(err)) {
                message =
                    err.response?.data?.message ||
                    err.response?.data?.error ||
                    message;
            }
            setAuthToggleError(message);
        } finally {
            setAuthToggleLoading(false);
        }
    };

    const confirmToggleAuthEnabled = () => {
        if (authEnabled === null) return;
        if (authToggleLoading) return;
        setAuthToggleConfirm({ isOpen: true, nextEnabled: !authEnabled });
    };

    const exportBackup = async () => {
        try {
            const extQuery = backupExportExt === 'excalidash.zip' ? '?ext=zip' : '';
            const response = await api.api.get(`/export/excalidash${extQuery}`, { responseType: 'blob' });
            const blob = new Blob([response.data], { type: 'application/zip' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const date = new Date().toISOString().split('T')[0];
            link.download = backupExportExt === 'excalidash.zip'
                ? `excalidash-backup-${date}.excalidash.zip`
                : `excalidash-backup-${date}.excalidash`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err: unknown) {
            console.error('Backup export failed:', err);
            setBackupImportError({ isOpen: true, message: settingsText.failedExportBackup });
        }
    };

    const verifyBackupFile = async (file: File) => {
        setBackupImportLoading(true);
        try {
            const formData = new FormData();
            formData.append('archive', file);
            const response = await api.api.post<{
                valid: boolean;
                formatVersion: number;
                exportedAt: string;
                excalidashBackendVersion: string | null;
                collections: number;
                drawings: number;
            }>('/import/excalidash/verify', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setBackupImportConfirmation({
                isOpen: true,
                file,
                info: {
                    formatVersion: response.data.formatVersion,
                    exportedAt: response.data.exportedAt,
                    excalidashBackendVersion: response.data.excalidashBackendVersion ?? null,
                    collections: response.data.collections,
                    drawings: response.data.drawings,
                },
            });
        } catch (err: unknown) {
            console.error('Backup verify failed:', err);
            let message = settingsText.failedVerifyBackup;
            if (api.isAxiosError(err)) {
                message = err.response?.data?.message || err.response?.data?.error || message;
            }
            setBackupImportError({ isOpen: true, message });
        } finally {
            setBackupImportLoading(false);
        }
    };

    const verifyLegacyDbFile = async (file: File) => {
        setLegacyDbImportLoading(true);
        try {
            const formData = new FormData();
            formData.append('db', file);
            const response = await api.api.post<{
                valid: boolean;
                drawings: number;
                collections: number;
                latestMigration: string | null;
                currentLatestMigration: string | null;
            }>('/import/sqlite/legacy/verify', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setLegacyDbImportConfirmation({
                isOpen: true,
                file,
                info: {
                    drawings: response.data.drawings,
                    collections: response.data.collections,
                    legacyLatestMigration: response.data.latestMigration ?? null,
                    currentLatestMigration: response.data.currentLatestMigration ?? null,
                },
            });
        } catch (err: unknown) {
            console.error('Legacy DB verify failed:', err);
            let message = settingsText.failedVerifyLegacyDb;
            if (api.isAxiosError(err)) {
                message = err.response?.data?.message || err.response?.data?.error || message;
            }
            setImportError({ isOpen: true, message });
        } finally {
            setLegacyDbImportLoading(false);
        }
    };

    const handleCreateCollection = async (name: string) => {
        await api.createCollection(name);
        const newCollections = await api.getCollections();
        setCollections(newCollections);
    };

    const handleEditCollection = async (id: string, name: string) => {
        setCollections(prev => prev.map(c => c.id === id ? { ...c, name } : c));
        await api.updateCollection(id, name);
    };

    const handleDeleteCollection = async (id: string) => {
        setCollections(prev => prev.filter(c => c.id !== id));
        await api.deleteCollection(id);
    };

    const handleSelectCollection = (id: string | null | undefined) => {
        if (id === undefined) navigate('/');
        else if (id === null) navigate('/collections?id=unorganized');
        else navigate(`/collections?id=${id}`);
    };



    return (
        <Layout
            collections={collections}
            selectedCollectionId="SETTINGS"
            onSelectCollection={handleSelectCollection}
            onCreateCollection={handleCreateCollection}
            onEditCollection={handleEditCollection}
            onDeleteCollection={handleDeleteCollection}
        >
            <h1 className="text-3xl sm:text-4xl lg:text-5xl mb-6 lg:mb-8 text-slate-900 dark:text-white pl-1" style={{ fontFamily: 'Excalifont' }}>
                {t("common.settings")}
            </h1>

            {authToggleError && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl">
                    <p className="text-red-800 dark:text-red-200 font-medium">{authToggleError}</p>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="flex flex-col items-center justify-center gap-3 sm:gap-4 p-4 sm:p-6 lg:p-8 bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-700 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)]">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-indigo-50 dark:bg-neutral-800 rounded-2xl flex items-center justify-center border-2 border-indigo-100 dark:border-neutral-700">
                        <Archive size={32} className="text-indigo-600 dark:text-indigo-400 hidden sm:block" />
                        <Archive size={24} className="text-indigo-600 dark:text-indigo-400 sm:hidden" />
                    </div>
                    <div className="text-center">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t('settings.exportBackup')}</h3>
                        <p className="text-xs text-slate-500 dark:text-neutral-400 font-medium max-w-[200px] mx-auto">
                            {t('settings.exportBackupDesc')}
                        </p>
                    </div>
                    <div className="w-full flex flex-col items-stretch gap-2 pt-2">
                        <button
                            onClick={exportBackup}
                            className="w-full px-4 py-2 text-sm font-bold rounded-xl border-2 border-black dark:border-neutral-700 bg-indigo-600 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all"
                        >
                            {t('settings.export')}
                        </button>
                        <select
                            value={backupExportExt}
                            onChange={(e) => setBackupExportExt(e.target.value as any)}
                            className="w-full px-3 py-2 text-sm font-bold rounded-xl border-2 border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white"
                            title={t('settings.downloadName')}
                        >
                            <option value="excalidash">.excalidash</option>
                            <option value="excalidash.zip">.excalidash.zip</option>
                        </select>
                    </div>
                </div>

                <button
                    onClick={toggleTheme}
                    className="w-full flex flex-col items-center justify-center gap-3 sm:gap-4 p-4 sm:p-6 lg:p-8 bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-700 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.2)] hover:-translate-y-1 transition-all duration-200 group"
                >
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-amber-50 dark:bg-neutral-800 rounded-2xl flex items-center justify-center border-2 border-amber-100 dark:border-neutral-700 group-hover:border-amber-200 dark:group-hover:border-neutral-600 transition-colors">
                        {theme === 'light' ? (
                            <Moon size={32} className="text-amber-600 dark:text-amber-400 hidden sm:block" />
                        ) : (
                            <Sun size={32} className="text-amber-600 dark:text-amber-400 hidden sm:block" />
                        )}
                        {theme === 'light' ? (
                            <Moon size={24} className="text-amber-600 dark:text-amber-400 sm:hidden" />
                        ) : (
                            <Sun size={24} className="text-amber-600 dark:text-amber-400 sm:hidden" />
                        )}
                    </div>
                    <div className="text-center">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                            {theme === 'light' ? t('settings.darkMode') : t('settings.lightMode')}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-neutral-400 font-medium max-w-[200px] mx-auto">
                            {theme === 'light' ? t('settings.switchToDarkTheme') : t('settings.switchToLightTheme')}
                        </p>
                    </div>
                </button>

                <button
                    onClick={toggleLanguage}
                    className="w-full flex flex-col items-center justify-center gap-3 sm:gap-4 p-4 sm:p-6 lg:p-8 bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-700 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.2)] hover:-translate-y-1 transition-all duration-200 group"
                >
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-50 dark:bg-neutral-800 rounded-2xl flex items-center justify-center border-2 border-blue-100 dark:border-neutral-700 group-hover:border-blue-200 dark:group-hover:border-neutral-600 transition-colors">
                        <span className="text-lg sm:text-2xl font-black text-blue-600 dark:text-blue-400">{isChinese ? 'EN' : '中'}</span>
                    </div>
                    <div className="text-center">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t("settings.language")}</h3>
                        <p className="text-xs text-slate-500 dark:text-neutral-400 font-medium max-w-[200px] mx-auto">
                            {isChinese ? t("settings.switchToEnglish") : t("settings.switchToChinese")}
                        </p>
                    </div>
                </button>

                <div className="flex flex-col p-4 sm:p-6 bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-700 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)]">
                    <div className="flex items-center gap-3 sm:gap-4 mb-6">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl flex items-center justify-center border-2 border-emerald-100 dark:border-emerald-800/50 relative overflow-hidden group">
                            <div className="absolute inset-0 opacity-[0.2] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] [background-size:12px_12px]"></div>
                            <RefreshCw size={28} className={clsx("text-emerald-600 dark:text-emerald-400 relative z-10 sm:hidden", updateLoading && "animate-spin")} />
                            <RefreshCw size={32} className={clsx("text-emerald-600 dark:text-emerald-400 relative z-10 hidden sm:block", updateLoading && "animate-spin")} />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">{t('settings.updates')}</h3>
                        </div>
                    </div>

                    <div className="space-y-4 flex-1">
                        <div className="p-3 sm:p-4 rounded-xl border-2 border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-800/30">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500" htmlFor="settings-update-channel">
                                    {t('settings.channel')}
                                </label>
                                <span className={clsx(
                                    "px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-tighter border",
                                    updateChannel === 'stable' 
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50" 
                                        : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50"
                                )}>
                                    {updateChannel}
                                </span>
                            </div>
                            <select
                                id="settings-update-channel"
                                value={updateChannel}
                                onChange={(e) => {
                                    const next = (e.target.value === 'prerelease' ? 'prerelease' : 'stable') as api.UpdateChannel;
                                    try {
                                        window.localStorage?.setItem?.(UPDATE_CHANNEL_KEY, next);
                                    } catch {
                                    }
                                    setUpdateChannel(next);
                                    void checkForUpdates(next);
                                }}
                                className="w-full h-10 px-2 sm:px-3 rounded-lg border-2 border-black dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)]"
                            >
                                <option value="stable">{t('settings.stable')}</option>
                                <option value="prerelease">{t('settings.prerelease')}</option>
                            </select>
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-[10px] sm:text-xs font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-widest">{t('settings.currentStatus')}</span>
                            </div>
                            <div className={clsx(
                                "px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border-2 font-bold text-xs sm:text-sm flex items-center gap-2 sm:gap-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)]",
                                updateInfo?.outboundEnabled === false ? "bg-slate-50 border-slate-200 text-slate-500 dark:bg-neutral-800 dark:border-neutral-700" :
                                updateLoading ? "bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-300" :
                                updateInfo?.isUpdateAvailable ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50" :
                                updateError ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300" :
                                "bg-slate-50 border-slate-200 text-slate-600 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300"
                            )}>
                                {updateLoading && <RefreshCw size={14} className="animate-spin flex-shrink-0" />}
                                <span className="truncate">
                                    {updateInfo?.outboundEnabled === false ? t('settings.checksDisabled') :
                                     updateLoading ? t('settings.checking') :
                                     updateInfo?.isUpdateAvailable ? t('settings.versionAvailable', { version: updateInfo.latestVersion ?? '' }) :
                                     updateInfo?.latestVersion ? (
                                        <span className="flex items-center gap-1.5">
                                            <Check size={14} strokeWidth={3} className="text-emerald-500 flex-shrink-0" />
                                            {t('settings.upToDate')}
                                        </span>
                                     ) :
                                     updateError ? updateError :
                                     t('settings.statusUnknown')}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                            onClick={() => void checkForUpdates(updateChannel)}
                            disabled={updateLoading}
                            className="flex items-center justify-center gap-2 h-10 sm:h-11 rounded-xl border-2 border-black dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] text-[9px] sm:text-[10px] font-black uppercase tracking-wider hover:-translate-y-0.5 transition-all active:translate-y-0 active:shadow-none disabled:opacity-50"
                            type="button"
                        >
                            {t('settings.checkNow')}
                        </button>

                        <a
                            href="https://github.com/ZimengXiong/ExcaliDash/releases"
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center gap-2 h-10 sm:h-11 rounded-xl border-2 border-black dark:border-neutral-700 bg-indigo-600 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-[9px] sm:text-[10px] font-black uppercase tracking-wider hover:-translate-y-0.5 transition-all active:translate-y-0 active:shadow-none"
                        >
                            {t('settings.releases')}
                        </a>
                    </div>

                    {updateInfo?.error && !updateLoading && (
                        <div className="mt-4 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-[10px] font-bold text-red-600 dark:text-red-400 italic">
                            {t('settings.errorPrefix', { message: updateInfo.error })}
                        </div>
                    )}
                </div>
            </div>

            <details className="mt-8 bg-white/30 dark:bg-neutral-900/30 border border-slate-200/70 dark:border-neutral-800/70 rounded-2xl p-4 sm:p-6">
                <summary className="cursor-pointer select-none font-bold text-slate-800 dark:text-neutral-200">
                    {t('settings.advancedLegacy')}
                </summary>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    <div className="relative">
                        <input
                            type="file"
                            accept=".excalidash,.zip"
                            className="hidden"
                            id="settings-import-backup"
                            onChange={async (e) => {
                                const file = (e.target.files || [])[0];
                                if (!file) return;
                                await verifyBackupFile(file);
                                e.target.value = '';
                            }}
                        />
                        <button
                            onClick={() => document.getElementById('settings-import-backup')?.click()}
                            disabled={backupImportLoading}
                            className="w-full h-full flex flex-col items-center justify-center gap-3 sm:gap-4 p-4 sm:p-6 lg:p-8 bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-700 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.2)] hover:-translate-y-1 transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-50 dark:bg-neutral-800 rounded-2xl flex items-center justify-center border-2 border-blue-100 dark:border-neutral-700">
                                <Upload size={32} className="text-blue-600 dark:text-blue-400 hidden sm:block" />
                                <Upload size={24} className="text-blue-600 dark:text-blue-400 sm:hidden" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                                    {backupImportLoading ? t('settings.verifying') : t('settings.importBackup')}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-neutral-400 font-medium max-w-[200px] mx-auto">
                                    {t('settings.importBackupDesc')}
                                </p>
                            </div>
                        </button>
                    </div>

                    <button
                        onClick={confirmToggleAuthEnabled}
                        disabled={
                            isManagedAuthMode ||
                            authEnabled === null ||
                            authToggleLoading ||
                            (authEnabled === true && user?.role !== 'ADMIN')
                        }
                        className="w-full flex flex-col items-center justify-center gap-3 sm:gap-4 p-4 sm:p-6 lg:p-8 bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-700 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.2)] hover:-translate-y-1 transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] disabled:hover:translate-y-0"
                    >
                        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-50 dark:bg-neutral-800 rounded-2xl flex items-center justify-center border-2 border-slate-200 dark:border-neutral-700 group-hover:border-slate-300 dark:group-hover:border-neutral-600 transition-colors">
                            <Info size={32} className="text-slate-700 dark:text-neutral-300 hidden sm:block" />
                            <Info size={24} className="text-slate-700 dark:text-neutral-300 sm:hidden" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                                {authEnabled ? t('settings.authOn') : t('settings.authOff')}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-neutral-400 font-medium max-w-[200px] mx-auto">
                                {isManagedAuthMode
                                    ? t('settings.managedByAuthMode', { mode: authMode ?? '' })
                                    : authEnabled
                                        ? user?.role === 'ADMIN'
                                            ? (authToggleLoading ? t('settings.disabling') : t('settings.disableMultiUserLogin'))
                                            : t('settings.onlyAdminsCanDisable')
                                        : authToggleLoading
                                            ? t('settings.enabling')
                                            : t('settings.enableMultiUserLogin')}
                            </p>
                        </div>
                    </button>

                    <div className="relative">
                        <input
                            type="file"
                            multiple
                            accept=".sqlite,.db,.json,.excalidraw,.zip"
                            className="hidden"
                            id="settings-import-legacy"
                            onChange={async (e) => {
                                const files = Array.from(e.target.files || []);
                                if (files.length === 0) return;

                                const databaseFile = files.find(f => f.name.endsWith('.sqlite') || f.name.endsWith('.db'));
                                if (databaseFile) {
                                    if (files.length > 1) {
                                        setImportError({ isOpen: true, message: settingsText.importLegacyDbSeparately });
                                        e.target.value = '';
                                        return;
                                    }

                                    await verifyLegacyDbFile(databaseFile);
                                    e.target.value = '';
                                    return;
                                }

                                const result = await importLegacyFiles(files, null, () => { });

                                if (result.failed > 0) {
                                    setImportError({
                                        isOpen: true,
                                        message: settingsText.importCompleteWithErrors(result.success, result.failed, result.errors.join('\n'))
                                    });
                                } else {
                                    setImportSuccess({ isOpen: true, message: settingsText.importedFiles(result.success) });
                                }

                                e.target.value = '';
                            }}
                        />
                        <button
                            onClick={() => document.getElementById('settings-import-legacy')?.click()}
                            disabled={legacyDbImportLoading}
                            className="w-full h-full flex flex-col items-center justify-center gap-3 sm:gap-4 p-4 sm:p-6 lg:p-8 bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-700 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.2)] hover:-translate-y-1 transition-all duration-200 group"
                        >
                            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-amber-50 dark:bg-neutral-800 rounded-2xl flex items-center justify-center border-2 border-amber-100 dark:border-neutral-700">
                                <Upload size={32} className="text-amber-600 dark:text-amber-400 hidden sm:block" />
                                <Upload size={24} className="text-amber-600 dark:text-amber-400 sm:hidden" />
                            </div>
                            <div className="text-center">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t('settings.legacyImport')}</h3>
                                <p className="text-xs text-slate-500 dark:text-neutral-400 font-medium max-w-[200px] mx-auto">{t('settings.legacyImportDesc')}</p>
                            </div>
                        </button>
                    </div>

                    <div className="flex flex-col items-center justify-center gap-3 sm:gap-4 p-4 sm:p-6 lg:p-8 bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-700 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)]">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-50 dark:bg-neutral-800 rounded-2xl flex items-center justify-center border-2 border-gray-100 dark:border-neutral-700">
                            <Info size={32} className="text-gray-600 dark:text-gray-400 hidden sm:block" />
                            <Info size={24} className="text-gray-600 dark:text-gray-400 sm:hidden" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t('settings.versionInfo')}</h3>
                            <div className="text-[10px] sm:text-xs text-slate-500 dark:text-neutral-400 font-bold flex flex-col items-center gap-1">
                                <span className="text-sm sm:text-base text-slate-900 dark:text-white">
                                    {appVersion}
                                </span>
                                {buildLabel && (
                                    <span className="uppercase tracking-wide text-red-500 dark:text-red-400">
                                        {buildLabel}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </details>

            <ConfirmModal
                isOpen={legacyDbImportConfirmation.isOpen}
                title={t('settings.mergeImportLegacyDb')}
                message={
                    <div className="space-y-2">
                        <div>{t('settings.mergeImportLegacyDbDesc')}</div>
                        {legacyDbImportConfirmation.info && (
                            <div className="text-sm text-slate-700 dark:text-neutral-200 space-y-1">
                                <div>{t('settings.drawingsCount', { count: legacyDbImportConfirmation.info.drawings })}</div>
                                <div>{t('settings.collectionsCount', { count: legacyDbImportConfirmation.info.collections })}</div>
                                <div>{t('settings.legacyMigration', { value: legacyDbImportConfirmation.info.legacyLatestMigration || settingsText.unknown })}</div>
                                <div>{t('settings.currentMigration', { value: legacyDbImportConfirmation.info.currentLatestMigration || settingsText.unknown })}</div>
                            </div>
                        )}
                    </div>
                }
                confirmText={t('settings.mergeImport')}
                cancelText={t('common.cancel')}
                onConfirm={async () => {
                    const file = legacyDbImportConfirmation.file;
                    if (!file) return;
                    setLegacyDbImportConfirmation({ isOpen: false, file: null, info: null });

                    const formData = new FormData();
                    formData.append('db', file);

                    try {
                        const response = await api.api.post<{
                            success: boolean;
                            collections: { created: number; updated: number; idConflicts: number };
                            drawings: { created: number; updated: number; idConflicts: number };
                        }>('/import/sqlite/legacy', formData, {
                            headers: { 'Content-Type': 'multipart/form-data' },
                        });

                        setImportSuccess({
                            isOpen: true,
                            message: settingsText.legacyDbImported(
                                response.data.collections.created,
                                response.data.collections.updated,
                                response.data.drawings.created,
                                response.data.drawings.updated,
                            ),
                        });
                    } catch (err: unknown) {
                        console.error(err);
                        let message = settingsText.failedImportLegacyDb;
                        if (api.isAxiosError(err)) {
                            message = err.response?.data?.message || err.response?.data?.error || message;
                        }
                        setImportError({ isOpen: true, message });
                    }
                }}
                onCancel={() => setLegacyDbImportConfirmation({ isOpen: false, file: null, info: null })}
            />

            <ConfirmModal
                isOpen={importError.isOpen}
                title={t('settings.importFailed')}
                message={importError.message}
                confirmText={t('common.ok')}
                cancelText=""
                showCancel={false}
                isDangerous={false}
                onConfirm={() => setImportError({ isOpen: false, message: '' })}
                onCancel={() => setImportError({ isOpen: false, message: '' })}
            />

            <ConfirmModal
                isOpen={importSuccess.isOpen}
                title={t('settings.importSuccessful')}
                message={importSuccess.message}
                confirmText={t('common.ok')}
                showCancel={false}
                isDangerous={false}
                variant="success"
                onConfirm={() => setImportSuccess({ isOpen: false, message: '' })}
                onCancel={() => setImportSuccess({ isOpen: false, message: '' })}
            />

            <ConfirmModal
                isOpen={authToggleConfirm.isOpen}
                title={authToggleConfirm.nextEnabled ? t('settings.enableAuthenticationTitle') : t('settings.disableAuthenticationTitle')}
                message={
                    authToggleConfirm.nextEnabled
                        ? t('settings.enableAuthenticationDesc')
                        : (
                            <div className="space-y-2 text-left">
                                <div>
                                    {t('settings.disableAuthenticationDesc')}
                                </div>
                                <div className="font-semibold text-rose-700 dark:text-rose-300">
                                    {t('settings.disableAuthenticationRecommend')}
                                </div>
                            </div>
                        )
                }
                confirmText={authToggleConfirm.nextEnabled ? t('settings.enable') : t('settings.continue')}
                cancelText={t('common.cancel')}
                isDangerous={!authToggleConfirm.nextEnabled}
                onConfirm={async () => {
                    const nextEnabled = authToggleConfirm.nextEnabled;
                    setAuthToggleConfirm({ isOpen: false, nextEnabled: null });
                    if (typeof nextEnabled !== 'boolean') return;
                    if (!nextEnabled) {
                        setAuthDisableFinalConfirmOpen(true);
                        return;
                    }
                    await setAuthEnabled(nextEnabled);
                }}
                onCancel={() => setAuthToggleConfirm({ isOpen: false, nextEnabled: null })}
            />

            <ConfirmModal
                isOpen={authDisableFinalConfirmOpen}
                title={t('settings.finalDisableWarningTitle')}
                message={
                    <div className="space-y-2 text-left">
                        <div>
                            {t('settings.finalDisableWarningDesc')}
                        </div>
                        <div className="font-semibold text-rose-700 dark:text-rose-300">
                            {t('settings.finalDisableWarningSafe')}
                        </div>
                    </div>
                }
                confirmText={t('settings.disableAuthentication')}
                cancelText={t('settings.keepEnabledRecommended')}
                isDangerous
                onConfirm={async () => {
                    setAuthDisableFinalConfirmOpen(false);
                    await setAuthEnabled(false);
                }}
                onCancel={() => setAuthDisableFinalConfirmOpen(false)}
            />

            <ConfirmModal
                isOpen={backupImportConfirmation.isOpen}
                title={t('settings.importBackupTitle')}
                message={
                    backupImportConfirmation.info
                        ? t('settings.importBackupConfirmDetailed', {
                            collections: backupImportConfirmation.info.collections,
                            drawings: backupImportConfirmation.info.drawings,
                            formatVersion: backupImportConfirmation.info.formatVersion,
                            exportedAt: backupImportConfirmation.info.exportedAt,
                        })
                        : t('settings.importBackupConfirmSimple')
                }
                confirmText={t('settings.import')}
                cancelText={t('common.cancel')}
                isDangerous={false}
                onConfirm={async () => {
                    const file = backupImportConfirmation.file;
                    if (!file) return;
                    setBackupImportConfirmation({ ...backupImportConfirmation, isOpen: false });
                    setBackupImportLoading(true);
                    try {
                        const formData = new FormData();
                        formData.append('archive', file);
                        await api.api.post('/import/excalidash', formData, {
                            headers: { 'Content-Type': 'multipart/form-data' },
                        });
                        setBackupImportConfirmation({ isOpen: false, file: null, info: null });
                        setBackupImportSuccess(true);
                    } catch (err: unknown) {
                        console.error('Backup import failed:', err);
                        let message = settingsText.failedImportBackup;
                        if (api.isAxiosError(err)) {
                            message = err.response?.data?.message || err.response?.data?.error || message;
                        }
                        setBackupImportError({ isOpen: true, message });
                        setBackupImportConfirmation({ isOpen: false, file: null, info: null });
                    } finally {
                        setBackupImportLoading(false);
                    }
                }}
                onCancel={() => setBackupImportConfirmation({ isOpen: false, file: null, info: null })}
            />

            <ConfirmModal
                isOpen={backupImportSuccess}
                title={t('settings.backupImported')}
                message={t('settings.backupImportedSuccessfully')}
                confirmText={t('common.ok')}
                showCancel={false}
                isDangerous={false}
                variant="success"
                onConfirm={() => setBackupImportSuccess(false)}
                onCancel={() => setBackupImportSuccess(false)}
            />

            <ConfirmModal
                isOpen={backupImportError.isOpen}
                title={t('settings.backupImportFailed')}
                message={backupImportError.message}
                confirmText={t('common.ok')}
                cancelText=""
                showCancel={false}
                isDangerous={false}
                onConfirm={() => setBackupImportError({ isOpen: false, message: '' })}
                onCancel={() => setBackupImportError({ isOpen: false, message: '' })}
            />
        </Layout >
    );
};
