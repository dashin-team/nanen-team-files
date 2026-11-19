# 南恩通訊處 團隊檔案庫

富邦人壽南恩通訊處共用的內部檔案網站。手機從 LINE 點開就能用：輸入同一組團隊密碼、上傳檔案、預覽、下載。沒有個人帳號。

可以放的格式：PDF、JPG、PNG、GIF、WEBP、HEIC、Word、Excel、CSV、PowerPoint、MP4、MOV、WEBM。

大小上限：

- 文件、圖片、表格、簡報：40 MB
- 影片：100 MB

預設資料夾：商品DM、教育訓練、表單文件、行銷素材。夥伴也可以自己新增資料夾。

## 夥伴怎麼用

1. 打開網址，輸入團隊密碼。登入會記住 30 天，同一支手機不用天天重打。
2. 上方填自己的名字。名字會記在這支手機，也會出現在檔案上。
3. 選資料夾，按「上傳檔案」。
4. 圖片、PDF、影片可以預覽。Word、Excel、簡報請下載後開啟。
5. 重新命名和刪除都會再問一次。
6. 用完可以按「登出」。

密碼請用電話或當面告知，不要貼在 LINE 群組，也不要轉給保戶。

## 本機先試

需要 Node.js 20 以上。

```bash
cp .env.example .env.local
```

用記事本打開 `.env.local`，把 `TEAM_PASSWORD=` 後面改成你們要試的密碼，存檔。然後：

```bash
npm install
npm run dev
```

瀏覽器打開 [http://127.0.0.1:3847](http://127.0.0.1:3847)。

沒有設定 `BLOB_READ_WRITE_TOKEN` 時，檔案存在專案裡的 `.data/` 資料夾。這個資料夾不會進 Git，只適合在自己的電腦練習。畫面上方會提示「本機練習模式」。

## 環境變數

| 名稱 | 必填 | 說明 |
| --- | --- | --- |
| `TEAM_PASSWORD` | 是 | 團隊共用密碼。不要寫進程式碼，也不要提交到 Git。 |
| `BLOB_READ_WRITE_TOKEN` | 上線要 | Vercel Blob 的讀寫權杖。本機留空即可。 |
| `SESSION_SECRET` | 否 | 一般不用設。沒設的時候，登入狀態用團隊密碼簽署；改密碼後大家會被登出。如果另外設了它，改密碼時也要一起改，否則舊登入還在。至少 16 個字。 |

## 放到網路上

檔案要一直留著，請用 Vercel，並接一個 **Private（私有）** Blob 儲存庫。不要用公開儲存庫。Vercel 的硬碟是暫時的，沒接 Blob 時網站會拒絕上傳，避免檔案悄悄消失。

請準備：一個 GitHub 帳號、一個 Vercel 帳號（用 GitHub 登入最簡單）。

1. 把這個專案放到 GitHub。若畫面上方有建立存放處的按鈕，先建立；否則請會用 Git 的人幫忙推上去。
2. 打開 [vercel.com/new](https://vercel.com/new)，Import 這個 GitHub 專案。
3. Framework 維持 Next.js，其他不用改。先不要按 Deploy。
4. 在 Environment Variables 新增一筆：
   - Name：`TEAM_PASSWORD`
   - Value：你們的團隊密碼（建議至少 12 個字，不要用生日或分機）
   - 勾選 Production
5. 按 Deploy，等它完成。
6. 進入這個專案的 Storage：
   - Create → Blob
   - Access 一定選 **Private**
   - 勾選 **Add a read-write token env var**（這會寫入 `BLOB_READ_WRITE_TOKEN`，手機直接上傳需要它）
   - 連到這個專案的 Production
7. 回到 Deployments，對剛剛那次部署按 Redeploy，讓新的儲存設定生效。
8. 打開網站，用團隊密碼登入，上傳一份 PDF，確認可以預覽和下載。再換一支沒登入的手機，確認打不開檔案網址。
9. 把網站網址貼到 LINE。密碼另外用電話或當面說。

如果第 6 步沒看到那個勾選：打開 Blob store → Projects → Connect to Project（或 Update Project Connection），勾選加入 read-write token，環境選 Production，存檔後再 Redeploy。

## 以後要改密碼

1. 打開 Vercel 專案 → Settings → Environment Variables。
2. 編輯 `TEAM_PASSWORD`，存檔。
3. 如果有設定 `SESSION_SECRET`，也改掉或刪掉它。沒設定就不用動。
4. 到 Deployments，對最新的正式環境按 Redeploy。環境變數改完要重新部署才會生效。
5. 用電話或當面把新密碼告訴還在團隊裡的人。舊的登入會失效，大家要重新輸入。

有人離開團隊時，請改密碼。這組密碼是共用的，改完之後對方就不能再進。

本機改密碼：編輯 `.env.local` 的 `TEAM_PASSWORD`，停掉 `npm run dev` 再重開。

## 常見狀況

- 密碼明明對卻進不去：Vercel 改完變數後還沒 Redeploy。
- 畫面說雲端儲存還沒接上：沒有 `BLOB_READ_WRITE_TOKEN`，或接上之後沒有重新部署。
- 上傳時說儲存庫必須是 Private：Blob 建成公開的了。請另建一個 Private 儲存庫再連一次。
- 檔案太大：文件 40 MB、影片 100 MB，請先壓縮或分段。
- Word / Excel / 簡報沒有預覽：這是正常的，請按下載，用手機或電腦打開。

## 安全提醒

- 所有檔案網址都要先通過登入。沒有密碼不能看清單，也不能下載。
- 雲端檔案放在私有 Blob，網址本身打不開，必須經過這個網站。
- 請搜尋引擎不要索引這個網站。
- 這是通訊處內部工具，不是富邦人壽的官方客戶網站。

## 換成正式橫幅和標誌

現在放的是依通訊處風格做的暫用圖，路徑固定，之後只要蓋掉同名檔案、重新整理頁面即可：

- 橫幅（約 4:1）：`public/brand/banner.jpg`，用在登入頁上方和檔案頁頂端。
- 圓形標誌：`public/brand/logo.png`，用在導覽列和瀏覽器圖示。

標題字用的楷書小檔在 `public/brand/nanen-kai.woff2`，不用改。
