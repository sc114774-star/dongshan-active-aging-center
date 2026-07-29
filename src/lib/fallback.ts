import type { DbEvent, DbPhoto, DbReflection } from "@/lib/types";

// Placeholder data when Supabase is not configured.
// Keep placeholder images self-contained to avoid external image loading errors in preview/build.

function placeholderImage(title: string, subtitle: string, accent: string, bg: string) {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900">
    <defs>
      <pattern id="dots" width="34" height="34" patternUnits="userSpaceOnUse">
        <circle cx="4" cy="4" r="2" fill="rgba(43,74,88,0.16)" />
      </pattern>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="rgba(43,74,88,0.18)"/>
      </filter>
    </defs>
    <rect width="1200" height="900" fill="${bg}"/>
    <rect width="1200" height="900" fill="url(#dots)" opacity="0.7"/>
    <circle cx="1030" cy="130" r="170" fill="${accent}" opacity="0.28"/>
    <circle cx="120" cy="790" r="220" fill="${accent}" opacity="0.2"/>
    <g filter="url(#shadow)">
      <rect x="130" y="165" width="940" height="570" rx="70" fill="rgba(255,255,255,0.72)" stroke="rgba(43,74,88,0.18)" stroke-width="4"/>
      <path d="M205 650 C340 500, 430 560, 560 420 C690 280, 805 405, 1000 245" fill="none" stroke="${accent}" stroke-width="28" stroke-linecap="round" opacity="0.78"/>
      <circle cx="315" cy="375" r="72" fill="${accent}" opacity="0.85"/>
      <circle cx="500" cy="560" r="54" fill="rgba(43,74,88,0.18)"/>
      <circle cx="760" cy="370" r="64" fill="rgba(43,74,88,0.16)"/>
    </g>
    <text x="600" y="410" text-anchor="middle" font-size="70" font-weight="900" font-family="Noto Sans TC, Arial, sans-serif" fill="rgb(43,74,88)">${title}</text>
    <text x="600" y="500" text-anchor="middle" font-size="36" font-weight="700" font-family="Noto Sans TC, Arial, sans-serif" fill="rgba(43,74,88,0.72)">${subtitle}</text>
  </svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const photoExercise = placeholderImage("樂齡活力", "一起動一動，精神更好", "#f08a5d", "#fff8e8");
const photoClass = placeholderImage("學習時光", "上課的笑聲最療癒", "#76c7b7", "#eef9f6");
const photoCraft = placeholderImage("手作成果", "慢慢做、一起完成", "#f4c95d", "#fff6dc");
const photoGroup = placeholderImage("溫暖合照", "每一次相聚都值得收藏", "#7db7e8", "#eef6ff");

export const fallbackPhotos: DbPhoto[] = [
  {
    id: "p1",
    image_url: photoExercise,
    caption: "一起動一動，精神更好",
    created_at: new Date().toISOString(),
  },
  {
    id: "p2",
    image_url: photoClass,
    caption: "上課的笑聲最療癒",
    created_at: new Date().toISOString(),
  },
  {
    id: "p3",
    image_url: photoCraft,
    caption: "手作時間：慢慢做、一起完成",
    created_at: new Date().toISOString(),
  },
  {
    id: "p4",
    image_url: photoGroup,
    caption: "成果合照：很有成就感",
    created_at: new Date().toISOString(),
  },
];

export const fallbackEvents: DbEvent[] = [
  {
    id: "e1",
    title: "體適能：伸展與平衡",
    date: "2026-07-21",
    location: "青山國小活動教室",
    content: "暖身 → 伸展 → 平衡訓練，請穿著運動鞋。",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "e2",
    title: "手作：花草小盆栽",
    date: "2026-07-24",
    location: "青山國小自然教室",
    content: "材料由中心準備，也歡迎自帶喜歡的小植栽。",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const fallbackReflections: DbReflection[] = [
  {
    id: "r1",
    title: "原來我也做得到",
    content:
      "以前總覺得學新東西很難，但老師一步一步帶著我們做，跟同學一起笑、一起完成，心情就亮起來了。",
    quote: "慢慢來沒關係，只要願意開始，就已經很棒了。",
    author: "學員｜陳○○",
    image_url: photoGroup,
    tags: ["114學年度", "青山社區活動中心"],
    school_year: "114學年度",
    location: "青山社區活動中心",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "r2",
    title: "每週最期待的那一天",
    content:
      "來上課不只是學技能，更像是來見朋友。回家後也更願意出門走走，身體跟心都更有力氣。",
    quote: "把自己照顧好，也是給家人最安心的禮物。",
    author: "學員｜林○○",
    image_url: photoCraft,
    tags: ["114學年度", "東山社區活動中心"],
    school_year: "114學年度",
    location: "東山社區活動中心",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];
