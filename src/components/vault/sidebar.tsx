"use client";

import React, { useState, useMemo, useCallback, useRef } from "react";
import { DriveFile, DriveFolder, SortOrder } from "@/types";
import {
  useDriveFiles,
  useFolderFiles,
  useDeleteFile,
  useRenameFile,
  useMoveFile,
} from "@/hooks/use-drive-files";
import { useVault } from "@/hooks/use-vault";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  FileText,
  ArrowUpDown,
  FolderOpen,
  FolderClosed,
  Trash2,
  Pencil,
  MoreVertical,
  Plus,
  FolderPlus,
  Clock,
  RefreshCw,
  PenLine,
  ChevronRight,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

// ─── Drag data type ─────────────────────────────────────────────────────────

interface DragPayload {
  fileId: string;
  fileName: string;
  parentId: string;
}

const DRAG_TYPE = "application/x-vault-file";

// ─── Sidebar ────────────────────────────────────────────────────────────────

interface SidebarProps {
  selectedFileId: string | null;
  onSelectFile: (file: DriveFile) => void;
  editorOpen?: boolean;
  onOpenEditor?: () => void;
}

export function Sidebar({
  selectedFileId,
  onSelectFile,
  editorOpen,
  onOpenEditor,
}: SidebarProps) {
  const { data: files, isLoading, refetch, isRefetching } = useDriveFiles();
  const { currentFolder, subfolders, createNewSubfolder, refreshSubfolders } =
    useVault();
  const deleteMutation = useDeleteFile();
  const renameMutation = useRenameFile();
  const moveMutation = useMoveFile();

  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<DriveFile | null>(null);
  const [newName, setNewName] = useState("");
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set()
  );
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const toggleFolder = useCallback((folderId: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }, []);

  // Filter & sort files
  const sortFiles = useCallback(
    (fileList: DriveFile[]) => {
      const result = [...fileList];
      result.sort((a, b) => {
        switch (sortOrder) {
          case "newest":
            return (
              new Date(b.modifiedTime).getTime() -
              new Date(a.modifiedTime).getTime()
            );
          case "oldest":
            return (
              new Date(a.modifiedTime).getTime() -
              new Date(b.modifiedTime).getTime()
            );
          case "name":
            return a.name.localeCompare(b.name);
        }
      });
      return result;
    },
    [sortOrder]
  );

  const filteredFiles = useMemo(() => {
    if (!files) return [];
    let result = [...files];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((f) => f.name.toLowerCase().includes(q));
    }

    return sortFiles(result);
  }, [files, searchQuery, sortFiles]);

  const handleDelete = useCallback(
    async (file: DriveFile) => {
      try {
        await deleteMutation.mutateAsync(file.id);
        toast.success(`Deleted "${file.name}"`);
      } catch {
        toast.error("Failed to delete file");
      }
    },
    [deleteMutation]
  );

  const handleRenameSubmit = useCallback(async () => {
    if (!renameTarget || !newName.trim()) return;
    try {
      await renameMutation.mutateAsync({
        fileId: renameTarget.id,
        newName: newName.trim(),
      });
      toast.success("File renamed");
      setRenameDialogOpen(false);
    } catch {
      toast.error("Failed to rename file");
    }
  }, [renameTarget, newName, renameMutation]);

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim()) return;
    try {
      await createNewSubfolder(newFolderName.trim());
      toast.success(`Created folder "${newFolderName.trim()}"`);
      setNewFolderDialogOpen(false);
      setNewFolderName("");
    } catch {
      toast.error("Failed to create folder");
    }
  }, [newFolderName, createNewSubfolder]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffH = diffMs / (1000 * 60 * 60);
    if (diffH < 1) return "Just now";
    if (diffH < 24) return `${Math.floor(diffH)}h ago`;
    if (diffH < 48) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // ─── Drag handlers for folder drop targets ──────────────────────────────

  const handleFolderDragOver = useCallback(
    (folderId: string) => (e: React.DragEvent) => {
      if (e.dataTransfer.types.includes(DRAG_TYPE)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOverFolderId(folderId);
      }
    },
    []
  );

  const handleFolderDragLeave = useCallback(
    (folderId: string) => (e: React.DragEvent) => {
      // Only clear if we're actually leaving the folder element (not entering a child)
      const relatedTarget = e.relatedTarget as Node | null;
      if (!e.currentTarget.contains(relatedTarget)) {
        setDragOverFolderId((prev) => (prev === folderId ? null : prev));
      }
    },
    []
  );

  const handleFolderDrop = useCallback(
    (targetFolderId: string) => async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverFolderId(null);

      const raw = e.dataTransfer.getData(DRAG_TYPE);
      if (!raw) return;

      try {
        const payload: DragPayload = JSON.parse(raw);

        // Don't move into the same folder
        if (payload.parentId === targetFolderId) {
          return;
        }

        await moveMutation.mutateAsync({
          fileId: payload.fileId,
          newParentId: targetFolderId,
          oldParentId: payload.parentId,
        });

        toast.success(`Moved "${payload.fileName}" to folder`);
      } catch {
        toast.error("Failed to move file");
      }
    },
    [moveMutation]
  );

  // ─── Render a draggable file item ───────────────────────────────────────

  const renderFileItem = (
    file: DriveFile,
    indent = false,
    parentId?: string
  ) => (
    <DraggableFileItem
      key={file.id}
      file={file}
      indent={indent}
      parentId={parentId ?? currentFolder?.id ?? ""}
      isSelected={selectedFileId === file.id}
      onSelect={() => onSelectFile(file)}
      onRename={() => {
        setRenameTarget(file);
        setNewName(file.name);
        setRenameDialogOpen(true);
      }}
      onDelete={() => handleDelete(file)}
      formatDate={formatDate}
    />
  );

  // Total file count across root + all expanded folders is complex to compute
  // so we just show root count
  const totalFiles = files?.length ?? 0;

  return (
    <aside className="flex flex-col w-72 border-r border-border bg-card shrink-0 h-full">
      {/* Search + actions */}
      <div className="p-3 space-y-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="inline-flex items-center gap-1 h-7 px-2.5 text-sm rounded-[min(var(--radius-md),12px)] hover:bg-muted hover:text-foreground transition-colors cursor-pointer" />
              }
            >
              <ArrowUpDown className="h-3 w-3" />
              {sortOrder === "newest"
                ? "Newest"
                : sortOrder === "oldest"
                  ? "Oldest"
                  : "Name"}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setSortOrder("newest")}>
                Newest first
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOrder("oldest")}>
                Oldest first
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOrder("name")}>
                By name
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-sm gap-1 cursor-pointer"
            onClick={() => setNewFolderDialogOpen(true)}
          >
            <FolderPlus className="h-3 w-3" />
            Folder
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 ml-auto cursor-pointer"
            onClick={() => {
              refetch();
              refreshSubfolders();
            }}
            disabled={isRefetching}
          >
            <RefreshCw
              className={`h-3 w-3 ${isRefetching ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {/* Accordion subfolders */}
          {subfolders.map((folder) => (
            <FolderAccordion
              key={folder.id}
              folder={folder}
              isExpanded={expandedFolders.has(folder.id)}
              onToggle={() => toggleFolder(folder.id)}
              onDragOver={handleFolderDragOver(folder.id)}
              onDragLeave={handleFolderDragLeave(folder.id)}
              onDrop={handleFolderDrop(folder.id)}
              isDragOver={dragOverFolderId === folder.id}
              selectedFileId={selectedFileId}
              onSelectFile={onSelectFile}
              renderFileItem={renderFileItem}
              sortFiles={sortFiles}
              searchQuery={searchQuery}
            />
          ))}

          {/* Root-level files */}
          {isLoading ? (
            <div className="space-y-2 p-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-2">
                  <Skeleton className="h-4 w-4 rounded" />
                  <div className="space-y-1 flex-1">
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-2.5 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredFiles.length === 0 && subfolders.length === 0 ? (
            <div className="text-center py-8 px-4">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">
                {searchQuery
                  ? "No files match your search"
                  : "No markdown files yet"}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {!searchQuery && "Drop .md files to get started"}
              </p>
            </div>
          ) : (
            filteredFiles.map((file) => renderFileItem(file))
          )}
        </div>
      </ScrollArea>

      {/* New Note button */}
      {onOpenEditor && (
        <div className="px-3 py-2">
          <Button
            variant={editorOpen ? "secondary" : "outline"}
            size="sm"
            className="w-full gap-2 text-xs cursor-pointer"
            onClick={onOpenEditor}
          >
            <PenLine className="h-3.5 w-3.5" />
            {editorOpen ? "Editor Open" : "New Note"}
          </Button>
        </div>
      )}

      {/* File count */}
      {totalFiles > 0 && (
        <div className="px-3 py-2 border-t border-border text-xs text-muted-foreground">
          {filteredFiles.length} of {totalFiles} file
          {totalFiles !== 1 && "s"}
        </div>
      )}

      {/* Rename dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename file</DialogTitle>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRenameSubmit()}
          />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRenameDialogOpen(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRenameSubmit}
              disabled={!newName.trim()}
              className="cursor-pointer"
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New folder dialog */}
      <Dialog open={newFolderDialogOpen} onOpenChange={setNewFolderDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create subfolder</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
          />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setNewFolderDialogOpen(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim()}
              className="cursor-pointer"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}

/* ─── Draggable File Item ───────────────────────────────────────────────── */

interface DraggableFileItemProps {
  file: DriveFile;
  indent: boolean;
  parentId: string;
  isSelected: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
  formatDate: (dateStr: string) => string;
}

function DraggableFileItem({
  file,
  indent,
  parentId,
  isSelected,
  onSelect,
  onRename,
  onDelete,
  formatDate,
}: DraggableFileItemProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isDragReady, setIsDragReady] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemRef = useRef<HTMLDivElement>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Long-press: enable draggable after 300ms hold
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;

      longPressTimer.current = setTimeout(() => {
        setIsDragReady(true);
        if (itemRef.current) {
          itemRef.current.setAttribute("draggable", "true");
        }
      }, 300);
    },
    []
  );

  const handlePointerUp = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  const handlePointerCancel = useCallback(() => {
    clearLongPress();
    setIsDragReady(false);
    if (itemRef.current) {
      itemRef.current.removeAttribute("draggable");
    }
  }, [clearLongPress]);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      const payload: DragPayload = {
        fileId: file.id,
        fileName: file.name,
        parentId,
      };
      e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
      e.dataTransfer.effectAllowed = "move";
      setIsDragging(true);
    },
    [file.id, file.name, parentId]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setIsDragReady(false);
    if (itemRef.current) {
      itemRef.current.removeAttribute("draggable");
    }
  }, []);

  return (
    <div
      ref={itemRef}
      className={`group flex items-center gap-2 w-full rounded-md px-2.5 py-2 text-sm cursor-pointer transition-colors ${
        isDragging
          ? "opacity-40"
          : isDragReady
            ? "ring-2 ring-primary/40 bg-primary/5"
            : isSelected
              ? "bg-primary/10 text-foreground"
              : "hover:bg-accent text-foreground"
      }`}
      onClick={onSelect}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <FileText
        className={`h-4 w-4 shrink-0 ${
          isSelected ? "text-primary" : "text-muted-foreground"
        }`}
      />
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium text-sm" title={file.name}>{file.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Clock className="h-2.5 w-2.5 text-muted-foreground/60" />
          <span className="text-xs text-muted-foreground/60">
            {formatDate(file.modifiedTime)}
          </span>
          {file.size && (
            <span className="text-[10px] text-muted-foreground/40">
              {(parseInt(file.size) / 1024).toFixed(0)}KB
            </span>
          )}
        </div>
      </div>

      {/* Actions menu */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              onClick={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-accent-foreground/10 transition-opacity cursor-pointer"
            />
          }
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onRename();
            }}
          >
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* ─── Folder Accordion ──────────────────────────────────────────────────── */

interface FolderAccordionProps {
  folder: DriveFolder;
  isExpanded: boolean;
  onToggle: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragOver: boolean;
  selectedFileId: string | null;
  onSelectFile: (file: DriveFile) => void;
  renderFileItem: (
    file: DriveFile,
    indent?: boolean,
    parentId?: string
  ) => React.ReactNode;
  sortFiles: (files: DriveFile[]) => DriveFile[];
  searchQuery: string;
}

function FolderAccordion({
  folder,
  isExpanded,
  onToggle,
  onDragOver,
  onDragLeave,
  onDrop,
  isDragOver,
  renderFileItem,
  sortFiles,
  searchQuery,
}: FolderAccordionProps) {
  // Only fetch when expanded
  const { data: folderFiles, isLoading } = useFolderFiles(
    isExpanded ? folder.id : null
  );

  const filteredFiles = useMemo(() => {
    if (!folderFiles) return [];
    let result = [...folderFiles];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((f) => f.name.toLowerCase().includes(q));
    }
    return sortFiles(result);
  }, [folderFiles, searchQuery, sortFiles]);

  return (
    <div>
      {/* Folder header — drop target */}
      <button
        onClick={onToggle}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`flex items-center gap-2 w-full rounded-md px-2.5 py-2 text-sm transition-colors group cursor-pointer ${
          isDragOver
            ? "bg-primary/15 ring-2 ring-primary/40"
            : "hover:bg-accent"
        }`}
      >
        {isExpanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
        {isExpanded ? (
          <FolderOpen className="h-4 w-4 text-amber-500 shrink-0" />
        ) : (
          <FolderClosed className="h-4 w-4 text-amber-500 shrink-0" />
        )}
        <span className="truncate text-sm font-medium" title={folder.name}>{folder.name}</span>
        {isExpanded && folderFiles && (
          <span className="text-xs text-muted-foreground ml-auto">
            {filteredFiles.length}
          </span>
        )}
      </button>

      {/* Expanded content — indented */}
      {isExpanded && (
        <div className="ml-3 pl-3 border-l border-border/50 space-y-1">
          {isLoading ? (
            <div className="py-2 px-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Loading...
                </span>
              </div>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="py-2 px-2.5">
              <span className="text-xs text-muted-foreground/60">
                {searchQuery ? "No matches" : "Empty folder"}
              </span>
            </div>
          ) : (
            filteredFiles.map((file) => renderFileItem(file, true, folder.id))
          )}
        </div>
      )}
    </div>
  );
}
