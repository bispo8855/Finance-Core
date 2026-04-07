import { APP_CONFIG } from '@/config/app';

interface AppBrandProps {
  collapsed?: boolean;
}

export function AppBrand({ collapsed }: AppBrandProps) {
  if (collapsed) {
    return (
      <div className="flex items-center justify-center w-full pt-2">
        <img
          src="/aurys-icon.svg"
          alt={APP_CONFIG.name}
          className="h-8 w-8 object-contain animate-in fade-in zoom-in duration-500"
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 min-w-0 transition-all duration-300 pt-2 mb-2">
      <img
        src="/aurys-icon.svg"
        alt={APP_CONFIG.name}
        className="h-7 w-7 md:h-8 md:w-8 object-contain shrink-0 drop-shadow-sm"
      />
      <span className="text-lg font-semibold tracking-tight text-white transition-all">
        {APP_CONFIG.name}
      </span>
    </div>
  );
}
