import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { localStorage as driver } from "./local";

test("local storage uploads, renames, ranges, and deletes", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "team-files-"));
  process.env.DATA_DIR = directory;
  try {
    const empty = await driver.list();
    assert.deepEqual(empty.folders.slice(0, 3), ["客戶檔案", "講師分類", "月會檔案"]);
    assert.equal(empty.files.length, 0);

    const created = await driver.createFolder("競賽辦法");
    assert.ok(created.folders.includes("競賽辦法"));

    const bytes = new TextEncoder().encode("%PDF-1.1\nteam\n%%EOF\n");
    const file = await driver.addBytes({
      name: "客戶筆記.pdf",
      folder: "客戶檔案",
      uploader: "梁仕翰",
      bytes,
    });
    assert.equal(file.uploader, "梁仕翰");
    assert.equal(file.size, bytes.byteLength);

    const renamed = await driver.updateFile(file.id, { name: "新版筆記.pdf", folder: "月會檔案" });
    assert.equal(renamed.name, "新版筆記.pdf");
    assert.equal(renamed.folder, "月會檔案");

    const full = await driver.openFile(file.id, null);
    assert.ok(full);
    assert.equal(full.status, 200);
    const downloaded = new Uint8Array(await new Response(full.stream).arrayBuffer());
    assert.deepEqual(downloaded, bytes);

    const partial = await driver.openFile(file.id, "bytes=0-3");
    assert.ok(partial);
    assert.equal(partial.status, 206);
    assert.equal(partial.contentRange, `bytes 0-3/${bytes.byteLength}`);
    const slice = new Uint8Array(await new Response(partial.stream).arrayBuffer());
    assert.equal(slice.length, 4);

    await driver.removeFile(file.id);
    assert.equal((await driver.list()).files.length, 0);
    await driver.deleteFolder("競賽辦法");
    assert.equal((await driver.list()).folders.includes("競賽辦法"), false);
    await assert.rejects(() => driver.deleteFolder("客戶檔案"), /預設資料夾不能刪除/);
    await assert.rejects(
      () => driver.addBytes({ name: "virus.exe", folder: "客戶檔案", uploader: "梁仕翰", bytes }),
      /不支援/,
    );
  } finally {
    delete process.env.DATA_DIR;
    await rm(directory, { recursive: true, force: true });
  }
});
