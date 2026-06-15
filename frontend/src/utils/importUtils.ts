import { exportToSvg } from "@excalidraw/excalidraw";
import { api } from "../api";
import { type UploadStatus } from "../context/UploadContext";
import { translate } from "../i18n";

type ExcalidrawLikeData = {
  // Standard Excalidraw file has { type, version, source, elements, appState, files }.
  type?: unknown;
  version?: unknown;
  source?: unknown;
  elements?: unknown;
  appState?: unknown;
  files?: unknown;
  // Some older exports nested the drawing under { data: { ... } }.
  data?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type LegacyExportDrawing = {
  id?: string;
  name?: string;
  elements: unknown[];
  appState: Record<string, unknown>;
  files?: Record<string, unknown>;
  collectionId?: string | null;
  collectionName?: string | null;
  createdAt?: string | number;
  updatedAt?: string | number;
  preview?: string | null;
  version?: number;
};

type LegacyExportJson = {
  version?: string;
  exportedAt?: string;
  userId?: string;
  drawings: LegacyExportDrawing[];
};

const isLegacyExportJson = (data: unknown): data is LegacyExportJson => {
  if (typeof data !== "object" || data === null) return false;
  const maybe = data as Record<string, unknown>;
  if (!Array.isArray(maybe.drawings)) return false;
  return true;
};

const coerceTimestamp = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return Date.now();
};

const parseOptionalJson = <T>(raw: unknown, fallback: T): T => {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  if (typeof raw === "object" && raw !== null) {
    return raw as T;
  }
  return fallback;
};

const extractDrawingData = (
  input: unknown
): { elements: any[]; appState: Record<string, any>; files: Record<string, any> } | null => {
  if (typeof input !== "object" || input === null) return null;
  const raw = input as ExcalidrawLikeData;

  const maybeNested = raw.data;
  const candidate: ExcalidrawLikeData =
    typeof maybeNested === "object" && maybeNested !== null ? (maybeNested as ExcalidrawLikeData) : raw;

  const elements = parseOptionalJson<any[]>(candidate.elements, []);
  const appState = parseOptionalJson<Record<string, any>>(candidate.appState, {});
  const files = parseOptionalJson<Record<string, any>>(candidate.files, {});

  if (!Array.isArray(elements)) return null;
  if (typeof appState !== "object" || appState === null) return null;
  if (typeof files !== "object" || files === null) return null;

  return { elements, appState, files };
};

const makeSvgPreview = async (
  elements: any[],
  appState: Record<string, any>,
  files: Record<string, any>
) => {
  return exportToSvg({
    elements,
    appState: {
      ...appState,
      exportBackground: true,
      viewBackgroundColor: appState.viewBackgroundColor || "#ffffff",
    },
    files: files || {},
    exportPadding: 10,
  });
};

const createCollectionResolver = () => {
  let existingCollectionsByLowerName: Map<string, string> | null = null;

  const ensureCollectionsIndex = async () => {
    if (existingCollectionsByLowerName) return;
    const response = await api.get<{ id: string; name: string }[]>("/collections");
    existingCollectionsByLowerName = new Map(
      (response.data || [])
        .filter(
          (c) => c && typeof c.name === "string" && typeof c.id === "string"
        )
        .map((c) => [c.name.trim().toLowerCase(), c.id])
    );
  };

  const getOrCreateCollectionIdByName = async (name: string) => {
    await ensureCollectionsIndex();
    const key = name.trim().toLowerCase();
    const existing = existingCollectionsByLowerName!.get(key);
    if (existing) return existing;
    const created = await api.post<{ id: string; name: string }>("/collections", {
      name,
    });
    existingCollectionsByLowerName!.set(key, created.data.id);
    return created.data.id;
  };

  return { getOrCreateCollectionIdByName };
};

const basenameWithoutExt = (filePath: string): string => {
  const base = filePath.split("/").pop() || filePath;
  return base.replace(/\.(json|excalidraw)$/, "");
};

const importLegacyZip = async (
  file: File,
  targetCollectionId: string | null
): Promise<{ success: number; failed: number; errors: string[] }> => {
  const errors: string[] = [];
  let success = 0;
  let failed = 0;

  // Lazy-load to keep the main bundle lighter; zip import is legacy-only.
  const { default: JSZip } = await import("jszip");

  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  const entries = Object.values(zip.files).filter((e: any) => !e.dir);
  const hasExcalidashManifest = entries.some((e: any) => e.name === "excalidash.manifest.json");
  if (hasExcalidashManifest) {
    return {
      success: 0,
      failed: 1,
      errors: [
        translate("import.backupDetectedUseBackupImport", { fileName: file.name }),
      ],
    };
  }

  const collectionResolver = createCollectionResolver();

  const drawableEntries = entries.filter((e: any) => {
    const name = String(e.name || "");
    return name.endsWith(".excalidraw") || name.endsWith(".json");
  });

  if (drawableEntries.length === 0) {
    return {
      success: 0,
      failed: 1,
      errors: [translate("import.zipNoDrawings", { fileName: file.name })],
    };
  }

  for (const entry of drawableEntries) {
    const entryName = String((entry as any).name || "");
    try {
      const raw = await (entry as any).async("string");
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error(`Invalid JSON: ${entryName}`);
      }

      if (isLegacyExportJson(parsed)) {
        // Allow a zip to contain a legacy "{ drawings: [...] }" export as well.
        const exportJson = parsed;
        const drawings = Array.isArray(exportJson.drawings) ? exportJson.drawings : [];
        for (let i = 0; i < drawings.length; i += 1) {
          const d = drawings[i] as LegacyExportDrawing;
          const extracted = extractDrawingData(d);
          if (!extracted) {
            failed += 1;
            errors.push(`${file.name}:${entryName}: drawing ${i + 1}: Invalid structure (missing elements/appState)`);
            continue;
          }

          let collectionId: string | null = null;
          if (targetCollectionId !== null) {
            collectionId = targetCollectionId;
          } else if (d.collectionId === "trash" || d.collectionName === "Trash") {
            collectionId = "trash";
          } else if (typeof d.collectionName === "string" && d.collectionName.trim()) {
            collectionId = await collectionResolver.getOrCreateCollectionIdByName(d.collectionName.trim());
          } else {
            collectionId = null;
          }

          const svg = await makeSvgPreview(extracted.elements, extracted.appState, extracted.files);
          const payload = {
            name:
              typeof d.name === "string" && d.name.trim().length > 0
                ? d.name
                : translate("import.importedDrawingNumbered", { index: i + 1 }),
            elements: extracted.elements,
            appState: extracted.appState,
            files: extracted.files || null,
            collectionId,
            createdAt: coerceTimestamp(d.createdAt),
            updatedAt: coerceTimestamp(d.updatedAt),
            preview: svg.outerHTML,
          };
          await api.post("/drawings", payload, { headers: { "X-Imported-File": "true" } });
          success += 1;
        }
        continue;
      }

      const extracted = extractDrawingData(parsed);
      if (!extracted) {
        throw new Error(`Invalid drawing structure: ${entryName}`);
      }

      let collectionId: string | null = null;
      if (targetCollectionId !== null) {
        collectionId = targetCollectionId;
      } else {
        // v0.3.x /export/json put drawings under "<CollectionName>/<Drawing>.excalidraw"
        const folder = entryName.includes("/") ? entryName.split("/")[0] : "";
        if (folder && folder !== "Unorganized") {
          collectionId = await collectionResolver.getOrCreateCollectionIdByName(folder);
        } else {
          collectionId = null;
        }
      }

      const svg = await makeSvgPreview(extracted.elements, extracted.appState, extracted.files);
      const payload = {
        name:
          basenameWithoutExt(entryName) ||
          basenameWithoutExt(file.name) ||
          translate("import.importedDrawing"),
        elements: extracted.elements,
        appState: extracted.appState,
        files: extracted.files || null,
        collectionId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        preview: svg.outerHTML,
      };

      await api.post("/drawings", payload, { headers: { "X-Imported-File": "true" } });
      success += 1;
    } catch (err: any) {
      failed += 1;
      errors.push(
        `${file.name}:${entryName}: ${err?.message || translate("import.failedZipEntry")}`
      );
    }
  }

  return { success, failed, errors };
};

export const importDrawings = async (
  files: File[],
  targetCollectionId: string | null,
  onSuccess?: () => void | Promise<void>,
  onProgress?: (
    fileIndex: number,
    status: UploadStatus,
    progress: number,
    error?: string
  ) => void
) => {
  const drawingFiles = files.filter(
    (f) => f.name.endsWith(".json") || f.name.endsWith(".excalidraw")
  );

  if (drawingFiles.length === 0) {
    return { success: 0, failed: 0, errors: [translate("import.noSupportedFiles")] };
  }

  let successCount = 0;
  let failCount = 0;
  const errors: string[] = [];

  const originalIndexMap = new Map<number, number>();
  drawingFiles.forEach((df, i) => {
    const originalIndex = files.indexOf(df);
    originalIndexMap.set(i, originalIndex);
  });

  await Promise.all(
    drawingFiles.map(async (file, drawingIndex) => {
      const fileIndex = originalIndexMap.get(drawingIndex) ?? drawingIndex;
      try {
        if (onProgress) onProgress(fileIndex, 'processing', 0);

        const text = await file.text();
        const parsed = JSON.parse(text) as unknown;
        const extracted = extractDrawingData(parsed);
        if (!extracted) throw new Error(`Invalid file structure: ${file.name}`);

        const svg = await makeSvgPreview(extracted.elements, extracted.appState, extracted.files);

        const payload = {
          name: file.name.replace(/\.(json|excalidraw)$/, ""),
          elements: extracted.elements,
          appState: extracted.appState,
          files: extracted.files || null,
          collectionId: targetCollectionId,
          createdAt: (parsed as any)?.createdAt || Date.now(),
          updatedAt: (parsed as any)?.updatedAt || Date.now(),
          preview: svg.outerHTML,
        };

        if (onProgress) onProgress(fileIndex, 'uploading', 0);

        await api.post("/drawings", payload, {
          headers: {
            "X-Imported-File": "true",
          },
          onUploadProgress: (progressEvent) => {
            if (onProgress && progressEvent.total) {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              onProgress(fileIndex, 'uploading', percentCompleted);
            }
          },
        });

        if (onProgress) onProgress(fileIndex, 'success', 100);
        successCount++;

      } catch (err: any) {
        console.error(`Failed to import ${file.name}:`, err);
        failCount++;
        const errorMessage =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          translate("import.uploadFailed");
        errors.push(`${file.name}: ${errorMessage}`);
        if (onProgress) onProgress(fileIndex, 'error', 0, errorMessage);
      }
    })
  );

  if (successCount > 0 && onSuccess) {
    await onSuccess();
  }

  return { success: successCount, failed: failCount, errors };
};

/**
 * Legacy import helper.
 * - Supports individual `.excalidraw` / Excalidraw `.json` drawings (same as importDrawings)
 * - Supports legacy ExcaliDash export `.json` with `{ drawings: [...] }`
 */
export const importLegacyFiles = async (
  files: File[],
  targetCollectionId: string | null,
  onSuccess?: () => void | Promise<void>,
  onProgress?: (
    fileIndex: number,
    status: UploadStatus,
    progress: number,
    error?: string
  ) => void
) => {
  const drawingFiles = files.filter(
    (f) =>
      f.name.endsWith(".json") ||
      f.name.endsWith(".excalidraw") ||
      f.name.endsWith(".zip")
  );

  if (drawingFiles.length === 0) {
    return { success: 0, failed: 0, errors: [translate("import.noSupportedFiles")] };
  }

  let successCount = 0;
  let failCount = 0;
  const errors: string[] = [];

  const originalIndexMap = new Map<number, number>();
  drawingFiles.forEach((df, i) => {
    const originalIndex = files.indexOf(df);
    originalIndexMap.set(i, originalIndex);
  });

  const collectionResolver = createCollectionResolver();

  await Promise.all(
    drawingFiles.map(async (file, drawingIndex) => {
      const fileIndex = originalIndexMap.get(drawingIndex) ?? drawingIndex;
      try {
        if (onProgress) onProgress(fileIndex, "processing", 0);

        if (file.name.endsWith(".zip")) {
          const result = await importLegacyZip(file, targetCollectionId);
          successCount += result.success;
          failCount += result.failed;
          errors.push(...result.errors);
          if (onProgress) onProgress(fileIndex, result.failed > 0 ? "error" : "success", 100, result.failed > 0 ? result.errors.join("\n") : undefined);
          return;
        }

        const text = await file.text();
        const parsed = JSON.parse(text) as unknown;

        if (isLegacyExportJson(parsed)) {
          const exportJson = parsed;
          const drawings = Array.isArray(exportJson.drawings)
            ? exportJson.drawings
            : [];

          if (drawings.length === 0) {
            throw new Error(translate("import.legacyExportNoDrawings"));
          }

          for (let i = 0; i < drawings.length; i += 1) {
            const d = drawings[i] as LegacyExportDrawing;
            const extracted = extractDrawingData(d);
            if (!extracted) {
              failCount += 1;
              errors.push(
                `${file.name}: drawing ${i + 1}: Invalid structure (missing elements/appState)`
              );
              continue;
            }

            let collectionId: string | null = null;
            if (targetCollectionId !== null) {
              collectionId = targetCollectionId;
            } else if (d.collectionId === "trash" || d.collectionName === "Trash") {
              collectionId = "trash";
            } else if (typeof d.collectionName === "string" && d.collectionName.trim()) {
              collectionId = await collectionResolver.getOrCreateCollectionIdByName(d.collectionName.trim());
            } else {
              collectionId = null;
            }

            const svg = await exportToSvg({
              elements: extracted.elements,
              appState: {
                ...extracted.appState,
                exportBackground: true,
                viewBackgroundColor:
                  (extracted.appState as any).viewBackgroundColor || "#ffffff",
              },
              files: extracted.files,
              exportPadding: 10,
            });

            const payload = {
              name:
                typeof d.name === "string" && d.name.trim().length > 0
                  ? d.name
                  : translate("import.importedDrawingNumbered", { index: i + 1 }),
              elements: extracted.elements,
              appState: extracted.appState,
              files: extracted.files || null,
              collectionId,
              createdAt: coerceTimestamp(d.createdAt),
              updatedAt: coerceTimestamp(d.updatedAt),
              preview: svg.outerHTML,
            };

            await api.post("/drawings", payload, {
              headers: {
                "X-Imported-File": "true",
              },
            });

            successCount += 1;
          }

          if (onProgress) onProgress(fileIndex, "success", 100);
          return;
        }

        if (
          typeof parsed === "object" &&
          parsed !== null &&
          extractDrawingData(parsed)
        ) {
          const mappedOnProgress = onProgress
            ? (_idx: number, status: UploadStatus, progress: number, error?: string) =>
                onProgress(fileIndex, status, progress, error)
            : undefined;
          const result = await importDrawings(
            [file],
            targetCollectionId,
            undefined,
            mappedOnProgress
          );
          successCount += result.success;
          failCount += result.failed;
          errors.push(...result.errors);
          return;
        }

        throw new Error(`Invalid file structure: ${file.name}`);
      } catch (err: any) {
        console.error(`Failed to import ${file.name}:`, err);
        failCount += 1;
        const errorMessage =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          translate("import.uploadFailed");
        errors.push(`${file.name}: ${errorMessage}`);
        if (onProgress) onProgress(fileIndex, "error", 0, errorMessage);
      }
    })
  );

  if (successCount > 0 && onSuccess) {
    await onSuccess();
  }

  return { success: successCount, failed: failCount, errors };
};
