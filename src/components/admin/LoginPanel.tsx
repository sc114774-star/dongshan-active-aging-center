import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import MascotSticker from "@/components/MascotSticker";
import { ADMIN_TARGET, useAuth } from "@/lib/auth";

export default function LoginPanel() {
  const { communities, signIn } = useAuth();
  const [target, setTarget] = useState("");
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);

  async function login() {
    if (!target) return toast.error("請先選擇社區或管理員");
    if (!pwd) return toast.error("請輸入密碼");
    setBusy(true);
    try {
      await signIn(target, pwd);
      toast.success("登入成功");
      setPwd("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "登入失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 py-10">
      <div className="flex items-center gap-3">
        <MascotSticker variant="calendar" className="h-16 w-16" />
        <div>
          <div className="text-3xl font-black">管理後台</div>
          <div className="mt-1 text-sm text-muted-foreground">請選擇您的社區並輸入密碼。</div>
        </div>
      </div>

      <Card className="space-y-3 rounded-4xl border-border bg-card p-6 shadow-sm">
        <div className="text-sm font-bold">登入</div>
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="選擇社區名稱" />
          </SelectTrigger>
          <SelectContent>
            {communities.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
            <SelectSeparator />
            <SelectItem value={ADMIN_TARGET}>總管理員</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="password"
          placeholder="請輸入密碼"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && login()}
        />
        <Button className="w-full rounded-full font-bold" onClick={login} disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          登入
        </Button>
      </Card>
    </div>
  );
}
