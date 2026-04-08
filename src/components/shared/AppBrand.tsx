import { APP_CONFIG } from '@/config/app';

interface AppBrandProps {
  collapsed?: boolean;
}

export function AppBrand({ collapsed }: AppBrandProps) {
  if (collapsed) {
    return (
      <div className="flex items-center justify-center w-full pt-1">
        <img
          src="/aurys-icon.png"
          alt={APP_CONFIG.name}
          className="h-14 w-14 object-contain animate-in fade-in zoom-in duration-500"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 min-w-0 transition-all duration-300 mb-2">
      <img
        src="/aurys-logo.png"
        alt={APP_CONFIG.name}
        className="h-24 w-auto object-contain shrink-0"
      />
    </div>
  );
}
