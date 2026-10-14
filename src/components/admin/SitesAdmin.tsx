import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, KeyRound, Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import type { Community } from "@/lib/auth";

// 總管理員專用：新增 / 改名 / 停用 / 排序據點，並可重設據點登入密碼
export default function SitesAdmin() {
  const [sites, setSites] = useState<Community[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newPw, setNewPw] = useState("2026");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const { data, error } = await supabase.from("communities").select("*").order("display_order", { ascending: true });
    if (error) throw error;
    const rows = (data ?? []) as Community[];
    setSites(rows);
    setNames(Object.fromEntries(rows.map((r) => [r.id, r.name])));
  }
  useEffect(() => {
    refresh().catch(() => toast.error("讀取據點失敗"));
  }, []);

  const fail = (err: unknown) => toast.error(err instanceof Error ? err.message : "操作失敗");

  async function rename(s: Community) {
    const name = (names[s.id] ?? "").trim();
    if (!name || name === s.name) return;
    const { error } = await supabase.from("communities").update({ name }).eq("id", s.id);
    if (error) return fail(error);
    toast.success("已更新名稱");
    await refresh();
  }

  async function toggle(s: Community) {
    const next = s.is_active === false;
    if (!next && !confirm(`確定停用「${s.name}」？\n停用後不會出現在登入、網站分頁與選單；資料會保留，之後可重新啟用。`)) return;
    const { error } = await supabase.from("communities").update({ is_active: next }).eq("id", s.id);
    if (error) return fail(error);
    toast.success(next ? "已啟用" : "已停用");
    await refresh();
  }

  async function move(index: number, dir: -1 | 1) {
    const a = sites[index];
    const b = sites[index + dir];
    if (!b) return;
    const r1 = await supabase.from("communities").update({ display_order: index + dir + 1 }).eq("id", a.id);
    const r2 = await supabase.from("communities").update({ display_order: index + 1 }).eq("id", b.id);
    if (r1.error || r2.error) return fail(r1.error ?? r2.error);
    await refresh();
  }

  async function resetPassword(s: Community) {
    const pw = prompt(`為「${s.name}」設定新密碼（至少 4 碼）`);
    if (!pw) return;
    const { error } = await supabase.rpc("set_site_password", { p_slug: s.slug, p_password: pw });
    if (error) return fail(error);
    toast.success("密碼已更新");
  }

  async function add() {
    if (!newName.trim() || !newSlug.trim()) return toast.error("請填寫據點名稱與代碼");
    setBusy(true);
    try {
      const { error } = await supabase.rpc("create_site_account", { p_slug: newSlug.trim().toLowerCase(), p_name: newName.trim(), p_password: newPw });
      if (error) throw error;
      toast.success("已新增據點與登入帳號");
      setNewName("");
      setNewSlug("");
      await refresh();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <Card className="rounded-4xl p-5">
        <div className="text-lg font-black">據點列表</div>
        <div className="mt-1 text-sm text-muted-foreground">停用的據點不會出現在登入頁、網站分頁與下拉選單，但資料都會保留。</div>
        <div className="mt-4 space-y-2">
          {sites.map((s, i) => (
            <div key={s.id} className="rounded-3xl border border-border bg-background p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Input className="min-w-40 flex-1" value={names[s.id] ?? ""} onChange={(e) => setNames({ ...names, [s.id]: e.target.value })} />
                <Button size="icon" variant="outline" className="rounded-full" title="儲存名稱" onClick={() => rename(s)}><Save className="h-4 w-4" /></Button>
                <Button size="icon" variant="outline" className="rounded-full" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                <Button size="icon" variant="outline" className="rounded-full" disabled={i === sites.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant={s.is_active === false ? "destructive" : "secondary"} className="rounded-full">{s.is_active === false ? "已停用" : "使用中"}</Badge>
                <span>代碼：{s.slug}</span>
                <Button size="sm" variant="outline" className="ml-auto rounded-full" onClick={() => resetPassword(s)}><KeyRound className="mr-1 h-3.5 w-3.5" />重設密碼</Button>
                <Button size="sm" variant={s.is_active === false ? "secondary" : "outline"} className="rounded-full" onClick={() => toggle(s)}>{s.is_active === false ? "重新啟用" : "停用"}</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="h-fit rounded-4xl p-5">
        <div className="text-lg font-black">新增據點</div>
        <div className="mt-1 text-sm text-muted-foreground">會同時建立該據點的登入帳號。代碼用小寫英文（例如 xinshe），也會用在快速上傳連結 ?center=代碼。</div>
        <div className="mt-4 space-y-3">
          <Input placeholder="據點名稱（例如 新社社區）" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Input placeholder="代碼（小寫英文）" value={newSlug} onChange={(e) => setNewSlug(e.target.value)} />
          <Input placeholder="初始密碼" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          <Button className="rounded-full font-bold" onClick={add} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}新增據點
          </Button>
        </div>
      </Card>
    </div>
  );
}
