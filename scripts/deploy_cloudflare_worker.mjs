#!/usr/bin/env node
/**
 * Deploy SciLingo static frontend build (`frontend/dist`) to Cloudflare Workers Static Assets.
 *
 * Uses zero external npm dependencies (Node.js 22+ built-in fetch, FormData, File, crypto, fs).
 *
 * Modes:
 *   1. Default (CI / full deploy):
 *      Requires env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID
 *      Optional env: CLOUDFLARE_WORKER_NAME (default: "khtn"), DIST_DIR (default: "<repo>/frontend/dist")
 *
 *   2. --manifest-only <outManifestJsonPath>
 *      Scans `DIST_DIR` and writes `{ fileCount, totalBytes, manifest }` JSON.
 *
 *   3. --upload-buckets <bucketsJsonPath> <outCompletionJwtPath>
 *      Requires env: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_UPLOAD_JWT
 *      Uploads the asset buckets and writes the completion JWT to <outCompletionJwtPath>.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const DEFAULT_DIST_DIR = path.resolve(REPO_ROOT, "frontend", "dist");
const COMPATIBILITY_DATE = "2026-11-25";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
};

const WORKER_SCRIPT = `export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
`;

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

function collectAssets(distDir) {
  if (!fs.existsSync(distDir)) {
    throw new Error(`Build output directory not found: ${distDir}`);
  }

  const manifest = {};
  const hashMap = new Map();
  let fileCount = 0;
  let totalBytes = 0;

  function walk(currentDir, relativeDir = "") {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;

      if (entry.isDirectory()) {
        walk(fullPath, relPath);
      } else if (entry.isFile()) {
        const buffer = fs.readFileSync(fullPath);
        const extension = path.extname(relPath).substring(1);
        const base64 = buffer.toString("base64");
        const hash = crypto
          .createHash("sha256")
          .update(base64 + extension)
          .digest("hex")
          .slice(0, 32);

        const manifestPath = `/${relPath.replace(/\\/g, "/")}`;
        manifest[manifestPath] = { hash, size: buffer.length };
        if (!hashMap.has(hash)) {
          hashMap.set(hash, {
            fullPath,
            manifestPath,
            mimeType: getMimeType(relPath),
          });
        }

        fileCount += 1;
        totalBytes += buffer.length;
      }
    }
  }

  walk(distDir);

  if (fileCount === 0) {
    throw new Error(`No files found inside build output directory: ${distDir}`);
  }

  return { manifest, hashMap, fileCount, totalBytes };
}

async function cfRequest(endpointPath, bearerToken, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${bearerToken}`);

  const response = await fetch(`${CF_API_BASE}${endpointPath}`, {
    ...init,
    headers,
  });

  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      `Cloudflare API ${init.method || "GET"} ${endpointPath} returned non-JSON HTTP ${response.status}`,
    );
  }

  if (!response.ok || parsed.success === false) {
    const errs = (parsed.errors || [])
      .map((e) => `${e.code ?? "?"}: ${e.message ?? "Unknown error"}`)
      .join("; ");
    throw new Error(
      `Cloudflare API ${init.method || "GET"} ${endpointPath} failed (HTTP ${response.status}): ${errs || text.slice(0, 300)}`,
    );
  }

  return parsed;
}

async function uploadBuckets({ accountId, uploadJwt, buckets, hashMap }) {
  let completionJwt = "";

  for (let i = 0; i < buckets.length; i += 1) {
    const bucket = buckets[i];
    const form = new FormData();

    for (const hash of bucket) {
      const asset = hashMap.get(hash);
      if (!asset) {
        throw new Error(`Asset hash from Cloudflare bucket not found in local manifest: ${hash}`);
      }
      const base64 = fs.readFileSync(asset.fullPath).toString("base64");
      form.append(hash, new File([base64], hash, { type: asset.mimeType }));
    }

    const res = await cfRequest(
      `/accounts/${accountId}/workers/assets/upload?base64=true`,
      uploadJwt,
      {
        method: "POST",
        body: form,
      },
    );

    console.log(`Uploaded asset bucket ${i + 1}/${buckets.length} (${bucket.length} files).`);
    if (res.result?.jwt) {
      completionJwt = res.result.jwt;
    }
  }

  if (!completionJwt) {
    throw new Error("Asset upload finished without returning a completion JWT.");
  }

  return completionJwt;
}

async function deployWorkerWithAssets({ accountId, apiToken, workerName, completionJwt }) {
  const metadata = {
    main_module: "worker.js",
    compatibility_date: COMPATIBILITY_DATE,
    bindings: [{ type: "assets", name: "ASSETS" }],
    assets: {
      jwt: completionJwt,
      config: {
        html_handling: "auto-trailing-slash",
        not_found_handling: "single-page-application",
      },
    },
  };

  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" }),
  );
  form.append(
    "worker.js",
    new Blob([WORKER_SCRIPT], { type: "application/javascript+module" }),
    "worker.js",
  );

  const deployRes = await cfRequest(
    `/accounts/${accountId}/workers/scripts/${workerName}`,
    apiToken,
    {
      method: "PUT",
      body: form,
    },
  );

  await cfRequest(
    `/accounts/${accountId}/workers/scripts/${workerName}/subdomain`,
    apiToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: true }),
    },
  );

  return deployRes;
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main() {
  const args = process.argv.slice(2);
  const distDir = path.resolve(process.env.DIST_DIR || DEFAULT_DIST_DIR);

  if (args[0] === "--manifest-only") {
    const outPath = args[1];
    if (!outPath) {
      throw new Error("Usage: deploy_cloudflare_worker.mjs --manifest-only <outPath>");
    }
    const { manifest, fileCount, totalBytes } = collectAssets(distDir);
    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    fs.writeFileSync(
      path.resolve(outPath),
      JSON.stringify({ fileCount, totalBytes, manifest }, null, 2),
      "utf8",
    );
    console.log(`Manifest written: ${fileCount} files, ${totalBytes} bytes -> ${outPath}`);
    return;
  }

  if (args[0] === "--upload-buckets") {
    const bucketsJsonPath = args[1];
    const outJwtPath = args[2];
    if (!bucketsJsonPath || !outJwtPath) {
      throw new Error(
        "Usage: deploy_cloudflare_worker.mjs --upload-buckets <bucketsJsonPath> <outCompletionJwtPath>",
      );
    }
    const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
    const uploadJwt = requireEnv("CLOUDFLARE_UPLOAD_JWT");
    const buckets = JSON.parse(fs.readFileSync(path.resolve(bucketsJsonPath), "utf8"));
    if (!Array.isArray(buckets)) {
      throw new Error("Expected JSON array in buckets file.");
    }
    const { hashMap } = collectAssets(distDir);
    const completionJwt = await uploadBuckets({ accountId, uploadJwt, buckets, hashMap });
    fs.mkdirSync(path.dirname(path.resolve(outJwtPath)), { recursive: true });
    fs.writeFileSync(path.resolve(outJwtPath), completionJwt, "utf8");
    console.log(`Uploaded ${buckets.length} bucket(s) and wrote completion token.`);
    return;
  }

  const apiToken = requireEnv("CLOUDFLARE_API_TOKEN");
  const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
  const workerName = (process.env.CLOUDFLARE_WORKER_NAME || "khtn").trim();

  const { manifest, hashMap, fileCount, totalBytes } = collectAssets(distDir);
  console.log(`Prepared ${fileCount} asset files (${totalBytes} bytes) for Worker "${workerName}".`);

  const sessionRes = await cfRequest(
    `/accounts/${accountId}/workers/scripts/${workerName}/assets-upload-session`,
    apiToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manifest }),
    },
  );

  const buckets = sessionRes.result?.buckets || [];
  const uploadJwt = sessionRes.result?.jwt;
  if (!uploadJwt) {
    throw new Error("Cloudflare assets-upload-session did not return a JWT.");
  }

  const completionJwt =
    buckets.length === 0
      ? uploadJwt
      : await uploadBuckets({ accountId, uploadJwt, buckets, hashMap });

  await deployWorkerWithAssets({ accountId, apiToken, workerName, completionJwt });
  console.log(`Deployed Worker "${workerName}" with ${fileCount} static assets.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
