import { Lightbulb } from "lucide-react";

interface PricingInsightProps {
  insight: string | null;
}

export function PricingInsight({ insight }: PricingInsightProps) {
  if (!insight) return null;

  return (
    <div className="flex items-start gap-3 p-4 bg-indigo-50/50 rounded-lg text-indigo-900 border border-indigo-100/50 shadow-sm mt-4 animate-in fade-in zoom-in-95 duration-500 delay-150">
      <div className="bg-white p-1.5 rounded-full shadow-sm border border-indigo-100 mt-0.5">
        <Lightbulb className="h-4 w-4 text-indigo-500 flex-shrink-0" />
      </div>
      <p className="text-sm leading-relaxed font-medium">
        {insight}
      </p>
    </div>
  );
}
