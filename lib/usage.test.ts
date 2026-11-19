import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_BLOB_QUOTA_BYTES } from "./constants";
import { formatSize } from "./format";
import type { StoredFile } from "./storage/types";
import { assertFitsQuota, blobQuotaBytes, countsTowardUsage, summarizeUsage } from "./usage";

function file(pathname: string, size: number, folder = "客戶檔案"): StoredFile {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    name: "筆記.pdf",
    folder,
    uploader: "仕翰",
    uploadedAt: "2026-01-01T00:00:00.000Z",
    size,
    contentType: "application/pdf",
    pathname,
  };
}

test("usage sums only the shihan prefix and ignores the other site", () => {
  const usage = summarizeUsage(
    [
      file("shihan/files/11111111-1111-4111-8111-111111111111", 120 * 1024 * 1024, "客戶檔案"),
      file("shihan/files/22222222-2222-4222-8222-222222222222", 5 * 1024 * 1024, "月會檔案"),
      file("files/33333333-3333-4333-8333-333333333333", 800 * 1024 * 1024, "商品DM"),
      file("catalog/index.json", 9999, "講師分類"),
    ],
    DEFAULT_BLOB_QUOTA_BYTES,
  );
  assert.equal(usage.usedBytes, 125 * 1024 * 1024);
  assert.equal(usage.quotaBytes, DEFAULT_BLOB_QUOTA_BYTES);
  assert.equal(usage.remainingBytes, DEFAULT_BLOB_QUOTA_BYTES - usage.usedBytes);
  assert.equal(usage.folderBytes["客戶檔案"], 120 * 1024 * 1024);
  assert.equal(usage.folderBytes["月會檔案"], 5 * 1024 * 1024);
  assert.equal(usage.folderBytes["商品DM"], undefined);
  assert.equal(countsTowardUsage("shihan/catalog/index.json"), true);
  assert.equal(countsTowardUsage("files/other"), false);
  assert.equal(formatSize(usage.quotaBytes), "1 GB");
  assert.equal(formatSize(120 * 1024 * 1024), "120 MB");
  assert.equal(formatSize(DEFAULT_BLOB_QUOTA_BYTES - 90), "1 GB");
  assert.equal(formatSize(800 * 1024 * 1024), "800 MB");
});

test("quota env overrides the hobby default and blocks an overflow", () => {
  const previous = process.env.BLOB_QUOTA_BYTES;
  process.env.BLOB_QUOTA_BYTES = "1000";
  try {
    assert.equal(blobQuotaBytes(), 1000);
    const files = [file("shihan/files/11111111-1111-4111-8111-111111111111", 800)];
    assert.doesNotThrow(() => assertFitsQuota(files, 200));
    assert.throws(() => assertFitsQuota(files, 201), /空間不夠/);
  } finally {
    if (previous === undefined) delete process.env.BLOB_QUOTA_BYTES;
    else process.env.BLOB_QUOTA_BYTES = previous;
  }
});

test("blank or invalid quota env falls back to 1 GB", () => {
  const previous = process.env.BLOB_QUOTA_BYTES;
  try {
    delete process.env.BLOB_QUOTA_BYTES;
    assert.equal(blobQuotaBytes(), DEFAULT_BLOB_QUOTA_BYTES);
    process.env.BLOB_QUOTA_BYTES = "nope";
    assert.equal(blobQuotaBytes(), DEFAULT_BLOB_QUOTA_BYTES);
    process.env.BLOB_QUOTA_BYTES = "0";
    assert.equal(blobQuotaBytes(), DEFAULT_BLOB_QUOTA_BYTES);
  } finally {
    if (previous === undefined) delete process.env.BLOB_QUOTA_BYTES;
    else process.env.BLOB_QUOTA_BYTES = previous;
  }
});
