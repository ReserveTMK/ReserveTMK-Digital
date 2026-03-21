import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "crypto";
import { Response } from "express";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

const UPLOAD_BASE = process.env.UPLOAD_DIR || "/tmp/uploads";

// Ensure upload directory exists on startup.
fs.mkdirSync(UPLOAD_BASE, { recursive: true });

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// LocalFile mimics the subset of @google-cloud/storage File used by this app.
class LocalFile {
  public readonly name: string;
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.name = filePath;
  }

  async exists(): Promise<[boolean]> {
    try {
      await fsPromises.access(this.filePath);
      return [true];
    } catch {
      return [false];
    }
  }

  async getMetadata(): Promise<[Record<string, any>]> {
    const metaPath = `${this.filePath}.meta.json`;
    let meta: Record<string, any> = {};
    try {
      meta = JSON.parse(await fsPromises.readFile(metaPath, "utf8"));
    } catch {
      // no metadata file yet
    }
    const stat = await fsPromises.stat(this.filePath).catch(() => null);
    return [{
      contentType: meta.contentType || "application/octet-stream",
      size: stat?.size?.toString() ?? "0",
      metadata: meta.metadata || {},
    }];
  }

  async setMetadata(update: { metadata?: Record<string, any> }): Promise<void> {
    const metaPath = `${this.filePath}.meta.json`;
    const [existing] = await this.getMetadata();
    const merged = {
      contentType: existing.contentType,
      metadata: { ...(existing.metadata || {}), ...(update.metadata || {}) },
    };
    await fsPromises.mkdir(path.dirname(metaPath), { recursive: true });
    await fsPromises.writeFile(metaPath, JSON.stringify(merged));
  }

  async save(buffer: Buffer, options?: { contentType?: string }): Promise<void> {
    await fsPromises.mkdir(path.dirname(this.filePath), { recursive: true });
    await fsPromises.writeFile(this.filePath, buffer);
    if (options?.contentType) {
      await fsPromises.writeFile(
        `${this.filePath}.meta.json`,
        JSON.stringify({ contentType: options.contentType })
      );
    }
  }

  createReadStream(): fs.ReadStream {
    return fs.createReadStream(this.filePath);
  }
}

// Minimal storage client interface matching the google-cloud/storage subset
// used by callers that import objectStorageClient.bucket(...).file(...).
export const objectStorageClient = {
  bucket: (bucketName: string) => ({
    file: (objectName: string) =>
      new LocalFile(path.join(UPLOAD_BASE, bucketName, objectName)),
  }),
};

export class ObjectStorageService {
  // Returns sub-paths (relative to UPLOAD_BASE) to search for public objects.
  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "public";
    return Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p.length > 0)
      )
    );
  }

  // Returns the sub-path (relative to UPLOAD_BASE) for private objects.
  getPrivateObjectDir(): string {
    return process.env.PRIVATE_OBJECT_DIR || "private";
  }

  async searchPublicObject(filePath: string): Promise<LocalFile | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = path.join(UPLOAD_BASE, searchPath, filePath);
      const file = new LocalFile(fullPath);
      const [exists] = await file.exists();
      if (exists) return file;
    }
    return null;
  }

  async downloadObject(file: LocalFile, res: Response, cacheTtlSec: number = 3600) {
    try {
      const [metadata] = await file.getMetadata();
      const aclPolicy = await getObjectAclPolicy(file as any);
      const isPublic = aclPolicy?.visibility === "public";
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size,
        "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
      });
      const stream = file.createReadStream();
      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) res.status(500).json({ error: "Error streaming file" });
      });
      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) res.status(500).json({ error: "Error downloading file" });
    }
  }

  // Returns a local object path for upload. The client should POST the file
  // to /api/uploads/<id> rather than using a presigned cloud URL.
  async getObjectEntityUploadURL(): Promise<string> {
    const objectId = randomUUID();
    return `/objects/uploads/${objectId}`;
  }

  async getObjectEntityFile(objectPath: string): Promise<LocalFile> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    const relativePath = objectPath.slice("/objects/".length);
    const privateDir = this.getPrivateObjectDir();
    const fullPath = path.join(UPLOAD_BASE, privateDir, relativePath);
    const file = new LocalFile(fullPath);
    const [exists] = await file.exists();
    if (!exists) throw new ObjectNotFoundError();
    return file;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    // Local paths are already normalised; no GCS URL conversion needed.
    return rawPath;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) return normalizedPath;
    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile as any, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: LocalFile;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile: objectFile as any,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}
