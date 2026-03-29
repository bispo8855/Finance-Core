import { PricingResult } from "@/types/pricing";
import { Info } from "lucide-react";

interface PricingDiagnosticsProps {
  result: PricingResult;
}

export function PricingDiagnostics({ result }: PricingDiagnosticsProps) {
  if (result.status === 'idle') {
    return (
      <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg text-slate-600 border border-slate-100">
        <Info className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" />
        <div className="space-y-1 text-sm">
          {result.diagnosticMessages.map((msg, i) => (
            <p key={i}>{msg}</p>
          ))}
        </div>
      </div>
    );
  }

  if (result.status === 'invalid' && !result.validation.isValid) {
    return (
      <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg text-red-800 border border-red-100">
        <Info className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
        <div className="space-y-1 text-sm font-medium">
          {result.validation.errors.map((err, i) => (
            <p key={i}>{err}</p>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 p-5 bg-white rounded-lg shadow-sm border border-slate-100">
      <div className="space-y-2 text-sm text-slate-700 leading-relaxed">
        {result.diagnosticMessages.map((msg, i) => (
          <p key={i} className={i === 0 ? "font-medium text-slate-900" : ""}>{msg}</p>
        ))}
      </div>
    </div>
  );
}
