# 臺南市東山區樂齡學習中心網站

這是一個可部署到 **GitHub + Vercel** 的多頁式互動網站，並串接 **Supabase Database + Storage**。

## 已完成頁面

- **首頁 Home**：中心簡介、輪播圖、銀髮老師貼圖。
- **活動花絮 Gallery**：瀑布流照片牆，點擊可放大觀看。
- **課程行事曆 Calendar**：月曆形式顯示每日課程，點日期彈出課程細節與地點。
- **成果心得 Reflections**：左側 4:3 大圖，右側顯示標題、學年度/地點標籤、心得內容、金句塊與學員署名。
- **管理後台 /admin**：固定密碼登入（預設 `114774`），可管理課程、照片與成果心得。

## 技術架構

- React 19 + TypeScript + Vite
- Tailwind CSS v4
- shadcn/ui
- Supabase Database
- Supabase Storage
- Hash routing（適合靜態部署）

## 本機開發

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

## Supabase 初始化

1. 到 Supabase 建立新專案。
2. 開啟 **SQL Editor**。
3. 將 `supabase_init.sql` 全部貼上並執行。
4. 到 **Project Settings → API** 複製：
   - Project URL → `VITE_SUPABASE_URL`
   - anon public key → `VITE_SUPABASE_ANON_KEY`
5. 建立 `.env.local` 或在 Vercel 設定環境變數。

## Vercel 環境變數

在 Vercel 專案的 **Settings → Environment Variables** 新增：

```txt
VITE_SUPABASE_URL=https://你的-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=你的-anon-key
VITE_SUPABASE_STORAGE_BUCKET=senior-center-images
VITE_ADMIN_PASSWORD=114774
```

## GitHub + Vercel 部署

1. 將整個專案推到 GitHub。
2. 在 Vercel 新增 Project，選擇這個 GitHub repo。
3. Framework Preset 選 **Vite**。
4. Build Command：`pnpm build`
5. Output Directory：`dist`
6. 填入環境變數後部署。

## 後台登入

部署後進入：

```txt
/#/admin
```

或從網站右上角「管理後台」按鈕進入。

預設密碼：

```txt
114774
```

## 安全提醒

這版依需求使用「靜態網站 + 固定密碼」方案。因為沒有伺服器端驗證，Supabase SQL 會允許 anon key 對資料表與 Storage 做寫入，讓後台能直接操作資料。

若未來網站要公開給大量使用者或需要更高安全性，建議改用：

- Supabase Auth
- Vercel Serverless Functions
- Supabase Edge Functions
- 更細緻的 RLS policies

## 專案重要檔案

- `src/pages/Home.tsx`：首頁
- `src/pages/Gallery.tsx`：活動花絮
- `src/pages/Calendar.tsx`：課程行事曆
- `src/pages/Reflections.tsx`：成果心得
- `src/pages/Admin.tsx`：管理後台
- `src/lib/supabase.ts`：Supabase client
- `src/lib/db.ts`：前台資料讀取
- `src/lib/adminDb.ts`：後台 CRUD / Storage 上傳
- `supabase_init.sql`：Supabase 初始化腳本
