import { mkdtemp, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

export interface OutputFile {
  path: string;
  contents: string;
}

interface StagedFile extends OutputFile {
  existed: boolean;
  directory?: string;
  stagedPath?: string;
  backupPath?: string;
  committed?: boolean;
}

export async function writeFilesAtomically(files: OutputFile[], errorFor: (path: string) => Error): Promise<void> {
  const staged = await prepareFiles(files, errorFor);
  let currentPath = files[0]?.path ?? "";

  try {
    for (const file of staged) {
      currentPath = file.path;
      file.directory = await mkdtemp(join(dirname(file.path), ".figma-token-"));
      file.stagedPath = join(file.directory, basename(file.path));
      file.backupPath = join(file.directory, `${basename(file.path)}.backup`);
      await writeFile(file.stagedPath, file.contents);
    }
    for (const file of staged) {
      currentPath = file.path;
      if (file.existed) await rename(file.path, file.backupPath!);
      await rename(file.stagedPath!, file.path);
      file.committed = true;
    }
  } catch {
    await restoreFiles(staged);
    throw errorFor(currentPath);
  } finally {
    await Promise.all(staged.map((file) => file.directory && rm(file.directory, { recursive: true, force: true })));
  }
}

async function prepareFiles(files: OutputFile[], errorFor: (path: string) => Error): Promise<StagedFile[]> {
  const staged: StagedFile[] = [];
  for (const file of files) {
    try {
      const existing = await stat(file.path);
      if (existing.isDirectory()) throw new Error();
      staged.push({ ...file, existed: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") staged.push({ ...file, existed: false });
      else throw errorFor(file.path);
    }
  }
  return staged;
}

async function restoreFiles(files: StagedFile[]): Promise<void> {
  for (const file of [...files].reverse()) {
    try {
      if (file.committed) await rm(file.path, { force: true });
      if (file.existed && file.backupPath) await rename(file.backupPath, file.path);
    } catch {
      // Preserve the original write error when rollback itself fails.
    }
  }
}
