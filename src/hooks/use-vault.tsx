"use client";

/**
 * Vault Context
 *
 * Manages the "current folder" state and root folder bootstrap.
 * Think of this as the vault's navigation state.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { DriveFolder } from "@/types";
import { useAuth } from "@/hooks/use-auth";
import {
  ensureRootFolder,
  listSubfolders,
  createSubfolder,
} from "@/services/google-drive";

interface VaultContextValue {
  /** The AI_NOTES root folder (null while bootstrapping). */
  rootFolder: DriveFolder | null;
  /** Currently selected folder to browse/upload into. */
  currentFolder: DriveFolder | null;
  /** Subfolders of the current folder. */
  subfolders: DriveFolder[];
  /** Navigation breadcrumb path. */
  folderPath: DriveFolder[];
  /** Whether we're still bootstrapping the root folder. */
  isBootstrapping: boolean;
  /** Error during bootstrap. */
  bootstrapError: string | null;
  /** Navigate into a subfolder. */
  navigateToFolder: (folder: DriveFolder) => void;
  /** Navigate up to a specific folder in the path. */
  navigateToPathIndex: (index: number) => void;
  /** Create a new subfolder in the current folder. */
  createNewSubfolder: (name: string) => Promise<DriveFolder>;
  /** Refresh subfolders list. */
  refreshSubfolders: () => Promise<void>;
}

const VaultContext = createContext<VaultContextValue | null>(null);

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) throw new Error("useVault must be used inside <VaultProvider>");
  return ctx;
}

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, isAuthenticated } = useAuth();

  const [rootFolder, setRootFolder] = useState<DriveFolder | null>(null);
  const [currentFolder, setCurrentFolder] = useState<DriveFolder | null>(null);
  const [subfolders, setSubfolders] = useState<DriveFolder[]>([]);
  const [folderPath, setFolderPath] = useState<DriveFolder[]>([]);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  // Bootstrap: ensure AI_NOTES exists
  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    let cancelled = false;
    setIsBootstrapping(true);
    setBootstrapError(null);

    ensureRootFolder(accessToken)
      .then((folder) => {
        if (cancelled) return;
        setRootFolder(folder);
        setCurrentFolder(folder);
        setFolderPath([folder]);
      })
      .catch((err) => {
        if (cancelled) return;
        setBootstrapError(err.message);
      })
      .finally(() => {
        if (!cancelled) setIsBootstrapping(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, accessToken]);

  // Load subfolders when currentFolder changes
  const refreshSubfolders = useCallback(async () => {
    if (!accessToken || !currentFolder) return;
    try {
      const folders = await listSubfolders(accessToken, currentFolder.id);
      setSubfolders(folders);
    } catch (err) {
      console.error("Failed to list subfolders:", err);
      setSubfolders([]);
    }
  }, [accessToken, currentFolder]);

  useEffect(() => {
    refreshSubfolders();
  }, [refreshSubfolders]);

  const navigateToFolder = useCallback(
    (folder: DriveFolder) => {
      setCurrentFolder(folder);
      setFolderPath((prev) => [...prev, folder]);
    },
    []
  );

  const navigateToPathIndex = useCallback(
    (index: number) => {
      setFolderPath((prev) => {
        const newPath = prev.slice(0, index + 1);
        setCurrentFolder(newPath[newPath.length - 1]);
        return newPath;
      });
    },
    []
  );

  const createNewSubfolder = useCallback(
    async (name: string): Promise<DriveFolder> => {
      if (!accessToken || !currentFolder)
        throw new Error("Not authenticated or no current folder");
      const folder = await createSubfolder(accessToken, name, currentFolder.id);
      await refreshSubfolders();
      return folder;
    },
    [accessToken, currentFolder, refreshSubfolders]
  );

  return (
    <VaultContext.Provider
      value={{
        rootFolder,
        currentFolder,
        subfolders,
        folderPath,
        isBootstrapping,
        bootstrapError,
        navigateToFolder,
        navigateToPathIndex,
        createNewSubfolder,
        refreshSubfolders,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
}
