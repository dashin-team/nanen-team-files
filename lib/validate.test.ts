import assert from "node:assert/strict";
import test from "node:test";
import {
  assertFileAllowed,
  contentDisposition,
  fileRejection,
  isPrivateBlobUrl,
  isSafeBlobPath,
  renameKeepingExtension,
  sanitizePersonName,
} from "./validate";

test("accepts a Chinese PDF name and rejects executables", () => {
  const file = assertFileAllowed("醫療險商品DM.pdf", 1024);
  assert.equal(file.contentType, "application/pdf");
  assert.equal(file.extension, "pdf");
  assert.match(fileRejection("setup.exe", 100) ?? "", /不支援/);
  assert.match(fileRejection("空白.pdf", 0) ?? "", /空的/);
});

test("video limit is higher than documents", () => {
  assert.equal(fileRejection("說明.pdf", 40 * 1024 * 1024 + 1), "檔案超過 40 MB 上限。");
  assert.equal(fileRejection("說明.mp4", 40 * 1024 * 1024 + 1), null);
  assert.equal(fileRejection("說明.mp4", 100 * 1024 * 1024 + 1), "檔案超過 100 MB 上限。");
});

test("rename keeps the extension", () => {
  assert.equal(renameKeepingExtension("舊版.pdf", "新版說明"), "新版說明.pdf");
  assert.throws(() => renameKeepingExtension("舊版.pdf", "新版.docx"), /不能改成別的檔案格式/);
});

test("person name rejects empty and control characters", () => {
  assert.equal(sanitizePersonName(" 梁仕翰 "), "梁仕翰");
  assert.throws(() => sanitizePersonName("   "), /請填上名字/);
  assert.equal(sanitizePersonName("梁\u0000仕翰"), "梁仕翰");
});

test("private blob urls and paths stay inside the files folder", () => {
  assert.equal(
    isPrivateBlobUrl("https://abc.private.blob.vercel-storage.com/files/id"),
    true,
  );
  assert.equal(
    isPrivateBlobUrl("https://abc.public.blob.vercel-storage.com/files/id"),
    false,
  );
  assert.equal(isPrivateBlobUrl("http://abc.private.blob.vercel-storage.com/files/id"), false);
  const id = "11111111-1111-4111-8111-111111111111";
  assert.equal(isSafeBlobPath(`files/${id}`, id), true);
  assert.equal(isSafeBlobPath(`files/${id}-suffix`, id), true);
  assert.equal(isSafeBlobPath(`files/../${id}`, id), false);
  assert.equal(isSafeBlobPath(`other/${id}`, id), false);
});

test("download header keeps the Chinese filename", () => {
  const header = contentDisposition("保障規劃.pdf", true);
  assert.match(header, /^attachment;/);
  assert.match(header, /filename\*=UTF-8''/);
  assert.match(header, /%E4%BF%9D%E9%9A%9C/);
});
