import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-20 text-center">
      <div className="text-4xl font-black">找不到頁面</div>
      <div className="mt-3 text-sm text-muted-foreground">
        你要找的頁面不存在，或網址輸入錯誤。
      </div>
      <div className="mt-8">
        <Link href="/">
          <Button className="rounded-full font-bold">回到首頁</Button>
        </Link>
      </div>
    </div>
  );
}
