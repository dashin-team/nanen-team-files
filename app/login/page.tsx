import { BrandBanner } from "@/components/brand";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="min-h-dvh bg-background">
      <BrandBanner priority />
      <section className="mx-auto w-full max-w-md px-5 pt-6 pb-12">
        <h1 className="text-center font-brand text-3xl leading-tight text-primary">仕翰的哩哩摳摳</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">自己的檔案，收在這裡。輸入密碼就能上傳、預覽和下載。</p>
        <div className="mt-5">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
          客戶資料只在登入後才打得開。這是私人檔案庫。
        </p>
      </section>
    </main>
  );
}
