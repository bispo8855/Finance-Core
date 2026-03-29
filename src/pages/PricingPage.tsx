import { PricingHeader } from "@/components/pricing/PricingHeader";
import { PricingForm } from "@/components/pricing/PricingForm";
import { PricingResults } from "@/components/pricing/PricingResults";
import { usePricing } from "@/hooks/usePricing";

export default function PricingPage() {
  const { state, actions, result } = usePricing();

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 w-full animate-in fade-in duration-500">
      <PricingHeader />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form Configuration */}
        <div className="lg:col-span-7 xl:col-span-8">
          <PricingForm state={state} actions={actions} result={result} />
        </div>

        {/* Right Column: Results & Diagnostics */}
        <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-8">
          <PricingResults result={result} />
        </div>
      </div>
    </div>
  );
}
