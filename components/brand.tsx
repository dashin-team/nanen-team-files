import Image from "next/image";

export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`relative block shrink-0 overflow-hidden rounded-full bg-white ring-2 ring-white ${className}`}>
      <Image src="/brand/logo.png" alt="大心" fill unoptimized className="object-cover" sizes="96px" />
    </span>
  );
}

export function BrandBanner({
  className = "",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand/banner.jpg"
      alt="南恩通訊處。台南最大心，服務最用心。富邦人壽。"
      width={2400}
      height={600}
      priority={priority}
      sizes="100vw"
      unoptimized
      className={`block h-auto w-full ${className}`}
      style={{ width: "100%", height: "auto" }}
    />
  );
}
