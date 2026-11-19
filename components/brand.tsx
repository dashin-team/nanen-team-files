import Image from "next/image";

export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`relative block shrink-0 overflow-hidden rounded-full bg-white ring-2 ring-white ${className}`}>
      <Image src="/brand/logo.png" alt="南恩通訊處標誌，大心，TN826" fill className="object-cover" sizes="96px" />
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
    <div className={`relative overflow-hidden bg-primary ${className}`}>
      <Image
        src="/brand/banner.jpg"
        alt="南恩通訊處。台南最大心，服務最用心。富邦人壽。"
        fill
        priority={priority}
        className="object-cover object-left"
        sizes="100vw"
      />
    </div>
  );
}
