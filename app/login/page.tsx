import { BrandBanner, BrandLogo } from "@/components/brand";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="min-h-dvh bg-background">
      <h1 className="sr-only">南恩通訊處 團隊檔案庫</h1>
      <section className="bg-primary">
        <BrandBanner priority className="h-52 sm:h-60 md:aspect-[4/1] md:h-auto" />
      </section>
      <section className="mx-auto -mt-12 w-full max-w-md px-5 pb-12">
        <BrandLogo className="mx-auto size-24 shadow-sm" />
        <p className="mt-3 text-center font-brand text-3xl leading-tight text-primary">團隊檔案庫</p>
        <p className="mt-1 text-center text-sm text-muted-foreground">南恩通訊處內部共用，從 LINE 點進來即可。</p>
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
