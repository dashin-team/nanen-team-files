import { readFileSync } from "node:fs";

const base = process.env.BASE_URL ?? "http://127.0.0.1:3847";

function passwordFromEnvFile() {
  try {
    const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of text.split("\n")) {
      const match = line.match(/^TEAM_PASSWORD=(.*)$/);
      if (match?.[1]) return match[1].trim();
    }
  } catch {
    return "";
  }
  return "";
}

const password = process.env.TEAM_PASSWORD || passwordFromEnvFile() || "仕翰";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function cookieHeader(response) {
  const cookies = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  return cookies.map((cookie) => cookie.split(";")[0]).join("; ");
}

async function main() {
  const anonymousList = await fetch(`${base}/api/files`);
  assert(anonymousList.status === 401, `未登入清單應為 401，得到 ${anonymousList.status}`);

  const anonymousFile = await fetch(`${base}/api/files/11111111-1111-4111-8111-111111111111/content`);
  assert(anonymousFile.status === 401, `未登入下載應為 401，得到 ${anonymousFile.status}`);

  const home = await fetch(`${base}/`, { redirect: "manual" });
  assert(home.status === 307, `未登入首頁應導向登入，得到 ${home.status}`);
  assert(home.headers.get("location")?.includes("/login"), "導向位置不是登入頁");

  const wrong = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: "不是密碼" }),
  });
  assert(wrong.status === 401, `錯誤密碼應為 401，得到 ${wrong.status}`);

  const login = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  assert(login.status === 200, `登入失敗 ${login.status} ${await login.text()}`);
  const cookie = cookieHeader(login);
  assert(cookie.includes("team_session="), "沒有登入 cookie");

  const auth = { cookie };

  const createdFolder = await fetch(`${base}/api/folders`, {
    method: "POST",
    headers: { "content-type": "application/json", ...auth },
    body: JSON.stringify({ name: "競賽辦法" }),
  });
  assert(createdFolder.status === 201, `新增資料夾失敗 ${createdFolder.status}`);

  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

  async function upload(name, type, bytes, folder, uploader) {
    const form = new FormData();
    form.set("file", new Blob([bytes], { type }), name);
    form.set("folder", folder);
    form.set("uploader", uploader);
    const response = await fetch(`${base}/api/files`, { method: "POST", headers: auth, body: form });
    const body = await response.json();
    assert(response.status === 201, `上傳 ${name} 失敗 ${response.status} ${JSON.stringify(body)}`);
    return body.file;
  }

  const image = await upload("月會照片.png", "image/png", png, "月會檔案", "仕翰");
  const document = await upload("客戶筆記.pdf", "application/pdf", pdf, "客戶檔案", "仕翰");

  const listed = await fetch(`${base}/api/files`, { headers: auth });
  const library = await listed.json();
  assert(listed.status === 200, "清單讀取失敗");
  assert(library.folders.includes("客戶檔案"), "缺少預設資料夾");
  assert(library.folders.includes("講師分類"), "缺少預設資料夾");
  assert(library.folders.includes("月會檔案"), "缺少預設資料夾");
  assert(library.folders.includes("競賽辦法"), "缺少新資料夾");
  assert(library.usage && library.usage.usedBytes > 0, "沒有回報用量");
  const names = library.files.map((file) => file.name);
  assert(names.includes("月會照片.png") && names.includes("客戶筆記.pdf"), `清單沒有檔案 ${names.join(",")}`);
  const uploaded = library.files.find((file) => file.id === document.id);
  assert(uploaded.uploader === "仕翰", "上傳者名稱不對");
  assert(uploaded.folder === "客戶檔案", "資料夾不對");

  const downloaded = await fetch(`${base}/api/files/${document.id}/content?download=1`, { headers: auth });
  assert(downloaded.status === 200, `下載失敗 ${downloaded.status}`);
  assert(downloaded.headers.get("content-type")?.includes("pdf"), "PDF 類型不對");
  assert(downloaded.headers.get("content-disposition")?.includes("attachment"), "下載標頭不對");
  const downloadedBytes = Buffer.from(await downloaded.arrayBuffer());
  assert(downloadedBytes.equals(pdf), "下載內容與上傳不同");

  const preview = await fetch(`${base}/api/files/${image.id}/content`, { headers: auth });
  assert(preview.headers.get("content-type")?.includes("image/png"), "圖片預覽類型不對");
  assert(preview.headers.get("content-disposition")?.startsWith("inline"), "預覽應為 inline");

  const partial = await fetch(`${base}/api/files/${document.id}/content`, {
    headers: { ...auth, range: "bytes=0-3" },
  });
  assert(partial.status === 206, `Range 應為 206，得到 ${partial.status}`);
  assert((await partial.arrayBuffer()).byteLength === 4, "Range 長度不對");

  const bare = await fetch(`${base}/api/files/${document.id}/content`);
  assert(bare.status === 401, "知道網址仍不該下載");

  const renamed = await fetch(`${base}/api/files/${document.id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", ...auth },
    body: JSON.stringify({ name: "新版筆記.pdf", folder: "講師分類" }),
  });
  const renamedBody = await renamed.json();
  assert(renamed.status === 200, `重新命名失敗 ${JSON.stringify(renamedBody)}`);
  assert(renamedBody.file.name === "新版筆記.pdf", "新檔名不對");
  assert(renamedBody.file.folder === "講師分類", "移動資料夾失敗");

  const rejected = await upload("setup.exe", "application/octet-stream", Buffer.from("MZ"), "講師分類", "仕翰").then(
    () => false,
    () => true,
  );
  assert(rejected, "不該接受 exe");

  const removed = await fetch(`${base}/api/files/${image.id}`, { method: "DELETE", headers: auth });
  assert(removed.status === 200, "刪除失敗");
  const afterDelete = await fetch(`${base}/api/files/${image.id}/content`, { headers: auth });
  assert(afterDelete.status === 404, "刪除後仍能下載");

  const removedDoc = await fetch(`${base}/api/files/${document.id}`, { method: "DELETE", headers: auth });
  assert(removedDoc.status === 200, "刪除 PDF 失敗");
  const removedFolder = await fetch(`${base}/api/folders`, {
    method: "DELETE",
    headers: { "content-type": "application/json", ...auth },
    body: JSON.stringify({ name: "競賽辦法" }),
  });
  assert(removedFolder.status === 200, "刪除空資料夾失敗");

  const tooBig = Buffer.alloc(40 * 1024 * 1024 + 1, 1);
  const bigForm = new FormData();
  bigForm.set("file", new Blob([tooBig], { type: "application/pdf" }), "太大.pdf");
  bigForm.set("folder", "講師分類");
  bigForm.set("uploader", "仕翰");
  const big = await fetch(`${base}/api/files`, { method: "POST", headers: auth, body: bigForm });
  assert(big.status === 400, `超過 40MB 應被拒絕，得到 ${big.status}`);

  const logout = await fetch(`${base}/api/auth/logout`, { method: "POST", headers: auth });
  assert(logout.status === 200, "登出失敗");
  const afterLogout = await fetch(`${base}/api/files`, { headers: { cookie: cookieHeader(logout) || "team_session=" } });
  assert(afterLogout.status === 401, "登出後仍能看清單");

  console.log("端對端檢查通過");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
