import { BrandBanner } from "@/components/brand";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="min-h-dvh bg-background">
      <h1 className="sr-only">南恩通訊處 團隊檔案庫</h1>
      <BrandBanner priority />
      <section className="mx-auto w-full max-w-md px-5 pt-6 pb-12">
        <p className="text-center font-brand text-3xl leading-tight text-primary">團隊檔案庫</p>
        <p className="mt-1 text-center text-sm text-muted-foreground">內部檔案共用。從 LINE 點進來，輸入團隊密碼即可。</p>
        <div className="mt-5">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
          這不是客戶頁面。商品 DM、表單和訓練資料只留在通訊處裡。
        </p>
      </section>
    </main>
  );
}
