import { APP_CONFIG } from '@/config/app';

interface AppBrandProps {
  collapsed?: boolean;
}

export function AppBrand({ collapsed }: AppBrandProps) {
  if (collapsed) {
    return (
      <div className="flex items-center justify-center w-full">
        <img
          src={APP_CONFIG.favicon}
          alt={APP_CONFIG.name}
          className="h-9 w-9 object-contain"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-w-0 w-full">
      <img
        src={APP_CONFIG.logo}
        alt={APP_CONFIG.name}
        className="w-[170px] md:w-[190px] h-auto object-contain object-center shrink-0"
      />
      <div className="text-[11px] font-medium text-sidebar-foreground/70 leading-tight text-center -mt-4">
        {APP_CONFIG.subtitle}
      </div>
    </div>
  );
}
