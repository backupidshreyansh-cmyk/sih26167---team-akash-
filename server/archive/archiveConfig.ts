/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Local Satellite Archive Configuration (Phase 1 Foundation).
 * Provides cross-platform, configurable path resolution for the local archive.
 * Safe on Windows, Linux, and macOS without hard-coded user paths.
 */

import path from 'path';
import fs from 'fs';

export interface ArchiveDirectories {
  rootDir: string;
  imageryDir: string;
  catalogDir: string;
  embeddingsDir: string;
  indexesDir: string;
  thumbnailsDir: string;
  derivedDir: string;
  provenanceDir: string;
  evaluationDir: string;
  reviewDir: string;
}

export class ArchiveConfig {
  private static instanceRoot: string | null = null;

  /**
   * Resolves the archive root directory.
   * Priority:
   * 1. Explicitly configured via configureRoot()
   * 2. Environment variable ARCHIVE_DATA_DIR
   * 3. Default: <project_root>/data
   */
  public static getRootDir(): string {
    if (this.instanceRoot) {
      return this.instanceRoot;
    }
    if (process.env.ARCHIVE_DATA_DIR) {
      return path.resolve(process.env.ARCHIVE_DATA_DIR);
    }
    return path.resolve(process.cwd(), 'data');
  }

  public static configureRoot(customRoot: string): void {
    this.instanceRoot = path.resolve(customRoot);
  }

  public static resetRoot(): void {
    this.instanceRoot = null;
  }

  /**
   * Returns all standardized archive directories.
   */
  public static getDirectories(): ArchiveDirectories {
    const rootDir = this.getRootDir();
    return {
      rootDir,
      imageryDir: path.join(rootDir, 'imagery'),
      catalogDir: path.join(rootDir, 'catalog'),
      embeddingsDir: path.join(rootDir, 'embeddings'),
      indexesDir: path.join(rootDir, 'indexes'),
      thumbnailsDir: path.join(rootDir, 'thumbnails'),
      derivedDir: path.join(rootDir, 'derived'),
      provenanceDir: path.join(rootDir, 'provenance'),
      evaluationDir: path.join(rootDir, 'evaluation'),
      reviewDir: path.join(rootDir, 'review')
    };
  }

  /**
   * Ensures all required local archive directories exist on disk.
   */
  public static async ensureDirectories(): Promise<ArchiveDirectories> {
    const dirs = this.getDirectories();
    for (const dir of Object.values(dirs)) {
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }
    }
    return dirs;
  }

  /**
   * Synchronous directory creation helper.
   */
  public static ensureDirectoriesSync(): ArchiveDirectories {
    const dirs = this.getDirectories();
    for (const dir of Object.values(dirs)) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    return dirs;
  }

  public static getCatalogFilePath(): string {
    return path.join(this.getDirectories().catalogDir, 'catalog.json');
  }

  public static getIndexFilePath(): string {
    return path.join(this.getDirectories().indexesDir, 'archive_index.json');
  }
}
