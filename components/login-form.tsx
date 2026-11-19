"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readJson } from "@/lib/transfer";

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await readJson(await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      }));
      router.replace("/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "登入失敗，請再試一次。");
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(event);
      }}
      className="rounded-[1.6rem] bg-card p-6 ring-1 ring-border"
    >
      <label htmlFor="password" className="text-sm font-medium">
        團隊密碼
      </label>
      <div className="mt-2 flex gap-2">
        <Input
          id="password"
          name="password"
          type={visible ? "text" : "password"}
          autoComplete="current-password"
          autoFocus
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-12 px-3 text-base"
          placeholder="輸入團隊共用密碼"
        />
        <Button
          type="button"
          variant="outline"
          className="h-12 shrink-0 px-3 text-base"
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? "隱藏" : "顯示"}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="mt-5 h-12 w-full text-base">
        {pending ? "正在進入…" : "進入文件庫"}
      </Button>
      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        密碼是團隊共用的。請用電話或當面告訴夥伴，不要貼在 LINE 群組，也不要轉給保戶。
      </p>
    </form>
  );
}
