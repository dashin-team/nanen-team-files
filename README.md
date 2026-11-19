# 仕翰的哩哩摳摳

仕翰的私人檔案庫。手機打開、輸入密碼，就能上傳、預覽、下載。沒有另外的帳號。

預設資料夾：客戶檔案、講師分類、月會檔案。也可以自己新增資料夾。

可以放的格式：PDF、JPG、PNG、GIF、WEBP、HEIC、Word、Excel、CSV、PowerPoint、MP4、MOV、WEBM。

大小上限：

- 文件、圖片、表格、簡報：40 MB
- 影片：100 MB

畫面下方的上傳按鈕旁會再寫一次。側欄底部有一條用量條，格式像「已使用 120 MB，共 1 GB」，快滿的時候會變色。每個資料夾也會顯示自己的大小。

## 怎麼用

1. 打開網址，輸入密碼。登入會記住 30 天。
2. 「檔案上的名字」會寫在檔案旁邊，預設是仕翰，也會記在這支手機。
3. 選資料夾，按「上傳檔案」。每一份檔案都可以按「下載」。
4. 圖片、PDF、影片可以預覽。Word、Excel、簡報請下載後開啟。
5. 重新命名和刪除都會再問一次。
6. 用完可以按「登出」。

客戶檔案只在登入後才打得開。雲端檔案放在私有 Blob，網址本身打不開，也不能被列舉。

## 本機先試

需要 Node.js 20 以上。

```bash
cp .env.example .env.local
npm install
npm run dev
```

瀏覽器打開 [http://127.0.0.1:3847](http://127.0.0.1:3847)。沒填 `TEAM_PASSWORD` 時，密碼是「仕翰」。

沒有 `BLOB_READ_WRITE_TOKEN` 時，檔案存在專案裡的 `.data/`。這個資料夾不會進 Git，只存在這台電腦。畫面會寫明這是本機練習，不會說檔案已經在雲端。

## 環境變數

| 名稱 | 新的 Vercel 專案 | 說明 |
| --- | --- | --- |
| `BLOB_READ_WRITE_TOKEN` | 必填 | Private Blob 的讀寫權杖。沒有它，網站在 Vercel 上會拒絕上傳，避免檔案寫進暫時硬碟後消失。 |
| `TEAM_PASSWORD` | 不必填 | 密碼。留空時是「仕翰」。要比對的是原文，中文不會被濾掉；前後空白和手機偶爾多出來的看不見字元會先清掉。 |
| `SESSION_SECRET` | 不必填 | 至少 16 個字。留空時用密碼簽署登入；改密碼後大家要重新登入。若另外設了它，改密碼時也要一起改。 |
| `BLOB_QUOTA_BYTES` | 不必填 | 用量條的上限，單位是位元組。留空時是 `1073741824`（1 GB），對應 [Vercel Blob Hobby 內含的 1 GB/月](https://vercel.com/docs/vercel-blob/usage-and-pricing)。 |

用量只加總這個網站存在 `shihan/` 底下的檔案。別的網站放在同一個 Blob 儲存庫裡的檔案不會算進來，也不會出現在清單裡。

## 放到 Vercel

這個分支要當成另一個 Vercel 專案，Production Branch 設成 `shihan-files`。不要把它合併進 main。

1. 在 Vercel 用這個 GitHub 專案新建一個 Project。
2. Settings → Git → Production Branch 改成 `shihan-files`。
3. Storage → Create → Blob。Access 選 **Private**。勾選加入 read-write token（會寫入 `BLOB_READ_WRITE_TOKEN`），連到這個新專案的 Production。
4. 最好用這個專案自己的 Blob 儲存庫。Hobby 的 1 GB 是整個儲存庫共用的；若和別的網站共用同一個庫，Vercel 的實際上限仍是整庫加總，畫面上的用量條只計算 `shihan/`。
5. 若要改掉預設密碼，再加 `TEAM_PASSWORD`。不要加的話，密碼就是「仕翰」。
6. Deployments 對最新一次正式環境按 Redeploy，讓儲存設定生效。
7. 用密碼登入，上傳一份 PDF，確認可以預覽和下載。換一個沒登入的瀏覽器，確認直接打開檔案網址會被擋下。

檔案實際路徑是 `shihan/catalog/index.json` 和 `shihan/files/<編號>`。下載一律先檢查登入，再由網站從私有 Blob 讀出來。

## 以後要改密碼

1. Vercel → Settings → Environment Variables，編輯 `TEAM_PASSWORD`。
2. 如果有設 `SESSION_SECRET`，也一起改或刪掉。
3. Redeploy。舊的登入會失效。

本機改密碼：編輯 `.env.local` 的 `TEAM_PASSWORD`，停掉 `npm run dev` 再重開。留空則回到「仕翰」。

## 常見狀況

- 密碼明明對卻進不去：改完環境變數後還沒 Redeploy。手機若多了一個空白，登入時會先清掉再比對。
- 畫面說私人雲端還沒接上：沒有 `BLOB_READ_WRITE_TOKEN`，或接上之後沒有重新部署。這時候不能上傳。
- 畫面說本機練習：現在是在自己的電腦跑，檔案在 `.data/`，不是雲端。
- 上傳時說儲存庫必須是 Private：Blob 建成公開的了。請另建一個 Private 儲存庫再連一次。
- 空間不夠：已用空間加上這份檔案會超過上限。
- 檔案太大：文件 40 MB、影片 100 MB。
- Word / Excel / 簡報沒有預覽：請按「下載」再開。

## 橫幅

橫幅在 `public/brand/banner.png`，圓形標誌在 `public/brand/logo.png`。要換圖時蓋掉同名檔案再重新整理。
