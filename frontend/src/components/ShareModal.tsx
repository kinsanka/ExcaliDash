import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
import clsx from "clsx";
import {
  X,
  Plus,
  Link as LinkIcon,
  AlertTriangle,
  Globe,
  Lock,
  ChevronDown,
  Calendar,
  Shield,
  Check,
  RefreshCw,
  Search,
} from "lucide-react";
import * as api from "../api";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../context/I18nContext";

type Props = {
  drawingId: string;
  drawingName: string;
  isOpen: boolean;
  onClose: () => void;
};

const toIsoFromDatetimeLocal = (value: string): string | undefined => {
  const trimmed = (value || "").trim();
  if (!trimmed) return undefined;
  const date = new Date(trimmed);
  if (!Number.isFinite(date.getTime())) return undefined;
  return date.toISOString();
};

const calculateExpiresAt = (option: string, customDate?: string): string | undefined => {
  if (option === "never") return undefined;
  if (option === "custom") return toIsoFromDatetimeLocal(customDate || "");

  const now = new Date();
  switch (option) {
    case "1h": now.setHours(now.getHours() + 1); break;
    case "1d": now.setDate(now.getDate() + 1); break;
    case "2d": now.setDate(now.getDate() + 2); break;
    case "7d": now.setDate(now.getDate() + 7); break;
    case "30d": now.setDate(now.getDate() + 30); break;
    default: return undefined;
  }
  return now.toISOString();
};

const CustomSelect: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string; danger?: boolean }[];
  className?: string;
  icon?: React.ReactNode;
  align?: "left" | "right";
  showCheck?: boolean;
  variant?: "ghost" | "bordered";
}> = ({ value, onChange, options, className, icon, align = "left", showCheck = true, variant = "ghost" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const currentOption = options.find(o => o.value === value) || options[0];

  return (
    <div className={clsx("relative inline-flex items-center", className)} ref={containerRef}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className={clsx(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all text-sm font-bold outline-none",
          variant === "bordered" 
            ? "border-2 border-black dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.05)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
            : "hover:bg-gray-100 dark:hover:bg-neutral-800 text-slate-700 dark:text-neutral-300"
        )}
      >
        {icon}
        <span>{currentOption.label}</span>
        <ChevronDown size={14} className={clsx("transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className={clsx(
          "absolute top-full z-[100] mt-2 min-w-[160px] bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-700 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] overflow-hidden animate-in fade-in zoom-in-95 duration-100",
          align === "right" ? "right-0" : "left-0"
        )}>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={clsx(
                "w-full text-left px-4 py-2.5 text-sm font-bold transition-colors flex items-center justify-between border-b last:border-b-0 border-slate-100 dark:border-neutral-800",
                opt.value === value && showCheck
                  ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400" 
                  : opt.danger
                    ? "text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                    : "text-slate-700 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-800"
              )}
            >
              {opt.label}
              {opt.value === value && showCheck && <Check size={14} strokeWidth={3} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const ShareModal: React.FC<Props> = ({ drawingId, drawingName, isOpen, onClose }) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const text = {
    failedLoad: t("share.failedLoad"),
    addPeople: t("share.addPeople"),
    failedShareUser: t("share.failedShareUser"),
    failedRevokeAccess: t("share.failedRevokeAccess"),
    failedUpdateLink: t("share.failedUpdateLink"),
    failedRevokeLink: t("share.failedRevokeLink"),
    shareTitle: t("share.shareTitle", { drawingName }),
    peopleWithAccess: t("share.peopleWithAccess"),
    you: t("share.you"),
    owner: t("share.owner"),
    viewer: t("share.viewer"),
    editor: t("share.editor"),
    removeAccess: t("share.removeAccess"),
    generalAccess: t("share.generalAccess"),
    restricted: t("share.restricted"),
    anyoneWithLink: t("share.anyoneWithLink"),
    anyoneInternet: t("share.anyoneInternet"),
    onlyPeopleAccess: t("share.onlyPeopleAccess"),
    whenDisabledRestricted: t("share.whenDisabledRestricted"),
    securityWarning: t("share.securityWarning"),
    editLinkWarning: t("share.editLinkWarning"),
    copied: t("share.copied"),
    copyLink: t("share.copyLink"),
    done: t("share.done"),
    externalNoAutoDisable: t("share.externalNoAutoDisable"),
    externalWillAutoDisable: t("share.externalWillAutoDisable"),
    externalAutoDisableOn: (time: string) => t("share.externalAutoDisableOn", { time }),
    expiry1h: t("share.expiry1h"),
    expiry1d: t("share.expiry1d"),
    expiry2d: t("share.expiry2d"),
    expiry7d: t("share.expiry7d"),
    expiry30d: t("share.expiry30d"),
    expiryNever: t("share.expiryNever"),
    expiryCustom: t("share.expiryCustom"),
  };
  const currentUserId = user?.id || null;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState<{
    permissions: api.DrawingPermissionRow[];
    linkShares: api.DrawingLinkShareRow[];
  } | null>(null);

  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<api.ShareResolvedUser[]>([]);
  const [userPermission, setUserPermission] = useState<"view" | "edit">("view");

  const [linkPermission, setLinkPermission] = useState<"view" | "edit">("view");
  const [expiryOption, setExpiryOption] = useState("1d");
  const [customExpiry, setCustomExpiry] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareableEditorUrl = `${origin}/shared/${drawingId}`;

  const activeLink = useMemo(() => {
    const now = Date.now();
    return (
      (sharing?.linkShares || []).find((s) => {
        if (s.revokedAt) return false;
        if (!s.expiresAt) return true;
        const ts = Date.parse(String(s.expiresAt));
        if (!Number.isFinite(ts)) return false;
        return ts > now;
      }) || null
    );
  }, [sharing]);

  const formatAutoDisableText = (expiresAt: string | null): string => {
    if (!expiresAt) return text.externalNoAutoDisable;
    const ts = Date.parse(String(expiresAt));
    if (!Number.isFinite(ts)) return text.externalWillAutoDisable;
    return text.externalAutoDisableOn(new Date(ts).toLocaleString());
  };

  const EXPIRY_OPTIONS = [
    { label: text.expiry1h, value: "1h" },
    { label: text.expiry1d, value: "1d" },
    { label: text.expiry2d, value: "2d" },
    { label: text.expiry7d, value: "7d" },
    { label: text.expiry30d, value: "30d" },
    { label: text.expiryNever, value: "never" },
    { label: text.expiryCustom, value: "custom" },
  ];

  // Keep the permission dropdown aligned with the actual active link policy from the server.
  useEffect(() => {
    if (!isOpen) return;
    if (!activeLink) return;
    setLinkPermission(activeLink.permission);
  }, [activeLink, isOpen]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getDrawingSharing(drawingId);
      setSharing(data);
    } catch (err: unknown) {
      let message = text.failedLoad;
      if (api.isAxiosError(err)) {
        const serverMessage = typeof err.response?.data?.message === "string" ? err.response.data.message : null;
        if (serverMessage) message = serverMessage;
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [drawingId]);

  useEffect(() => {
    if (!isOpen) return;
    setUserQuery("");
    setUserResults([]);
    setUserPermission("view");
    setLinkPermission("view");
    setExpiryOption("1d");
    setCustomExpiry("");
    setIsCopied(false);
    void refresh();
  }, [isOpen, refresh]);

  useEffect(() => {
    if (!isOpen) return;
    const q = userQuery.trim();
    if (q.length < 3) {
      setUserResults([]);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const users = await api.resolveShareUsers(drawingId, q);
        const filtered = currentUserId ? users.filter((u) => u.id !== currentUserId) : users;
        if (!cancelled) setUserResults(filtered);
      } catch {
        if (!cancelled) setUserResults([]);
      }
    };
    const t = window.setTimeout(run, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [currentUserId, drawingId, isOpen, userQuery]);

  const handleCopy = async (text: string) => {
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable (permission denied / insecure context).
    }
  };

  const handleAddUser = async (uId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await api.upsertDrawingPermission(drawingId, { granteeUserId: uId, permission: userPermission });
      await refresh();
      setUserQuery("");
      setUserResults([]);
    } catch (err: unknown) {
      let message = text.failedShareUser;
      if (api.isAxiosError(err)) {
        const serverMessage = typeof err.response?.data?.message === "string" ? err.response.data.message : null;
        if (serverMessage) message = serverMessage;
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeUser = async (permissionId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await api.revokeDrawingPermission(drawingId, permissionId);
      await refresh();
    } catch {
      setError(text.failedRevokeAccess);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateLink = async (newPermission?: "view" | "edit", newExpiry?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      if (activeLink) {
        await api.revokeLinkShare(drawingId, activeLink.id);
      }
      
      const perm = newPermission ?? linkPermission;
      setLinkPermission(perm);
      const expiresAt = newExpiry ?? calculateExpiresAt(expiryOption, customExpiry);
      
      await api.createLinkShare(drawingId, {
        permission: perm,
        expiresAt,
      });

      await refresh();
      void handleCopy(shareableEditorUrl);
    } catch (err: unknown) {
      let message = text.failedUpdateLink;
      if (api.isAxiosError(err)) {
        const serverMessage = typeof err.response?.data?.message === "string" ? err.response.data.message : null;
        if (serverMessage) message = serverMessage;
      }
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeLink = async () => {
    if (!activeLink) return;
    setIsLoading(true);
    setError(null);
    try {
      await api.revokeLinkShare(drawingId, activeLink.id);
      await refresh();
    } catch {
      setError(text.failedRevokeLink);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const currentLinkUrl = activeLink ? shareableEditorUrl : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-[540px] bg-white dark:bg-neutral-900 rounded-[24px] border-2 border-black dark:border-neutral-700 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] dark:shadow-[12px_12px_0px_0px_rgba(255,255,255,0.05)] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="px-8 py-6 flex items-center justify-between border-b-2 border-black dark:border-neutral-700">
          <h2 className="text-xl font-black text-slate-800 dark:text-neutral-100 truncate pr-4" title={drawingName}>
            {text.shareTitle}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl border-2 border-transparent hover:border-black dark:hover:border-neutral-600 transition-all group shrink-0"
          >
            <X size={20} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-200" />
          </button>
        </div>

        <div className="flex-1 px-8 pt-8 pb-10 space-y-8 overflow-visible">
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-900/20 border-2 border-rose-600 dark:border-rose-500 text-sm font-bold text-rose-600 dark:text-rose-400 flex items-center gap-3">
              <AlertTriangle size={18} strokeWidth={3} />
              {error}
            </div>
          )}

          <section className="relative">
            <div className="relative group">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors">
                <Search size={20} strokeWidth={2.5} />
              </div>
              <input
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder={text.addPeople}
                className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-black dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 text-slate-900 dark:text-neutral-100 focus:outline-none focus:ring-0 focus:border-indigo-600 dark:focus:border-indigo-500 transition-all font-bold placeholder:text-slate-400 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.05)]"
              />
            </div>

            {userResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-3 border-2 border-black dark:border-neutral-700 rounded-xl bg-white dark:bg-neutral-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)] overflow-hidden z-[200] animate-in fade-in slide-in-from-top-2">
                {userResults.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleAddUser(u.id)}
                    className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors group border-b last:border-b-0 border-slate-100 dark:border-neutral-800"
                  >
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-black text-lg border-2 border-black dark:border-neutral-600">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-black text-slate-900 dark:text-neutral-100 truncate">{u.name}</div>
                      <div className="text-xs font-bold text-slate-500 dark:text-neutral-400 truncate">{u.email}</div>
                    </div>
                    <Plus size={20} className="text-slate-400 group-hover:text-indigo-600 transition-colors" strokeWidth={3} />
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-neutral-500 px-1">{text.peopleWithAccess}</h3>
            
            <div className="space-y-1">
              <div className="flex items-center gap-4 px-1 py-3 min-h-[64px]">
                <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-neutral-800 flex items-center justify-center text-slate-600 dark:text-neutral-300 font-black text-xl border-2 border-black dark:border-neutral-600 shrink-0">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="text-base font-black text-slate-900 dark:text-neutral-100 leading-tight">
                    {user?.name} <span className="text-slate-400 dark:text-neutral-500 font-bold ml-1">({text.you})</span>
                  </div>
                  <div className="text-sm font-bold text-slate-500 dark:text-neutral-400 mt-0.5">{user?.email}</div>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500 pr-4 shrink-0">{text.owner}</div>
              </div>

              {(sharing?.permissions || []).map((p) => (
                <div key={p.id} className="flex items-center gap-4 px-1 py-3 min-h-[64px] group">
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-black text-xl border-2 border-indigo-600 dark:border-indigo-500 shrink-0">
                    {p.granteeUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <div className="text-base font-black text-slate-900 dark:text-neutral-100 leading-tight truncate">{p.granteeUser.name}</div>
                    <div className="text-sm font-bold text-slate-500 dark:text-neutral-400 mt-0.5 truncate">{p.granteeUser.email}</div>
                  </div>
                  <div className="shrink-0 flex items-center h-full">
                    <CustomSelect
                      value={p.permission}
                      onChange={async (val) => {
                        if (val === "remove") {
                          await handleRevokeUser(p.id);
                        } else {
                          await api.upsertDrawingPermission(drawingId, { granteeUserId: p.granteeUserId, permission: val as any });
                          void refresh();
                        }
                      }}
                      options={[
                        { label: text.viewer, value: "view" },
                        { label: text.editor, value: "edit" },
                        { label: text.removeAccess, value: "remove", danger: true },
                      ]}
                      align="right"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="pt-8 border-t-2 border-black dark:border-neutral-700">
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-neutral-500 px-1 mb-6">{text.generalAccess}</h3>
            
            <div className="flex items-start gap-5 px-1">
              <div className={clsx(
                "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border-2 transition-all mt-1",
                activeLink 
                  ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-600 dark:border-emerald-500 shadow-[2px_2px_0px_0px_rgba(5,150,105,0.2)]" 
                  : "bg-slate-50 dark:bg-neutral-800 text-slate-400 dark:text-neutral-500 border-slate-400 dark:border-neutral-600"
              )}>
                {activeLink ? <Globe size={24} strokeWidth={3} /> : <Lock size={24} strokeWidth={3} />}
              </div>
              
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <CustomSelect
                    value={activeLink ? "anyone" : "restricted"}
                    onChange={(val) => {
                      if (val === "anyone") void handleUpdateLink();
                      else void handleRevokeLink();
                    }}
                    options={[
                      { label: text.restricted, value: "restricted" },
                      { label: text.anyoneWithLink, value: "anyone" },
                    ]}
                    className="-ml-3"
                    showCheck={false}
                  />
                </div>
                
                <p className="text-sm font-bold text-slate-500 dark:text-neutral-400 leading-snug px-1">
                  {activeLink 
                    ? text.anyoneInternet
                    : text.onlyPeopleAccess}
                </p>

                {activeLink && (
                  <div className="pt-5 space-y-6 animate-in fade-in slide-in-from-top-1 duration-200">
                    <p className="text-xs font-black text-slate-500 dark:text-neutral-400 px-1">
                      {formatAutoDisableText(activeLink.expiresAt)}
                      {" "}{text.whenDisabledRestricted}
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <CustomSelect
                        value={linkPermission}
                        onChange={(val) => handleUpdateLink(val as any)}
                        options={[
                          { label: text.viewer, value: "view" },
                          { label: text.editor, value: "edit" },
                        ]}
                        icon={<Shield size={16} strokeWidth={2.5} className="text-slate-400" />}
                        variant="bordered"
                      />

                      <CustomSelect
                        value={expiryOption}
                        onChange={(val) => {
                          setExpiryOption(val);
                          if (val !== "custom") {
                            const nextExpiry = calculateExpiresAt(val);
                            void handleUpdateLink(undefined, nextExpiry);
                          }
                        }}
                        options={EXPIRY_OPTIONS}
                        icon={<Calendar size={16} strokeWidth={2.5} className="text-slate-400" />}
                        variant="bordered"
                      />
                    </div>

                    {expiryOption === "custom" && (
                      <input
                        type="datetime-local"
                        value={customExpiry}
                        onChange={(e) => setCustomExpiry(e.target.value)}
                        onBlur={() => void handleUpdateLink()}
                        className="w-full px-4 py-3 rounded-xl border-2 border-black dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 text-sm font-black focus:outline-none focus:border-indigo-600 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.05)]"
                      />
                    )}

                    {linkPermission === "edit" && (
                      <div className="p-5 rounded-xl bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-500 space-y-3 shadow-[4px_4px_0px_0px_rgba(245,158,11,0.2)]">
                        <div className="flex items-start gap-3">
                           <AlertTriangle size={20} strokeWidth={3} className="text-amber-600 shrink-0 mt-0.5" />
                           <div className="text-xs text-amber-900 dark:text-amber-200 font-black leading-relaxed">
                             <span className="uppercase tracking-[0.1em] text-[10px]">{text.securityWarning}</span><br/>
                             {text.editLinkWarning}
                           </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        <div className="px-8 py-8 flex items-center justify-between border-t-2 border-black dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800/50 rounded-b-[22px]">
          <button
            onClick={() => handleCopy(currentLinkUrl)}
            disabled={!activeLink}
            className={clsx(
              "flex items-center gap-3 px-6 py-3.5 rounded-xl border-2 font-black text-sm uppercase tracking-widest transition-all active:translate-x-[1px] active:translate-y-[1px]",
              isCopied 
                ? "bg-emerald-500 text-white border-black shadow-none translate-x-[1px] translate-y-[1px]" 
                : "bg-white dark:bg-neutral-900 border-black dark:border-neutral-600 text-indigo-600 dark:text-indigo-400 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.05)] hover:-translate-y-0.5",
              !activeLink && "opacity-40 grayscale cursor-not-allowed shadow-none"
            )}
          >
            {isCopied ? <Check size={20} strokeWidth={3} /> : <LinkIcon size={20} strokeWidth={3} />}
            {isCopied ? text.copied : text.copyLink}
          </button>
          
          <button
            onClick={onClose}
            className="px-12 py-3.5 rounded-xl bg-indigo-600 dark:bg-indigo-500 text-white border-2 border-black font-black text-sm uppercase tracking-[0.2em] hover:-translate-y-0.5 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] active:translate-y-0 active:shadow-none transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          >
            {text.done}
          </button>
        </div>

        {isLoading && (
          <div className="absolute inset-0 bg-white/20 dark:bg-black/10 backdrop-blur-[1px] flex items-center justify-center z-[300] pointer-events-none rounded-[24px]">
             <div className="bg-white dark:bg-neutral-900 border-2 border-black dark:border-neutral-700 p-5 rounded-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <RefreshCw size={28} strokeWidth={3} className="animate-spin text-indigo-600 dark:text-indigo-400" />
             </div>
          </div>
        )}
      </div>
    </div>
  );
};
