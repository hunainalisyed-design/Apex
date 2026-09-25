import { useTranslations } from "next-intl";
import { formatPriceCents } from "@/lib/format/currency";
import { formatNumber } from "@/lib/format/number";
import type { VehicleSummaryDto } from "@/types/catalog";

export interface SpecTableProps {
  left: VehicleSummaryDto;
  right: VehicleSummaryDto;
}

type SpecsTranslator = ReturnType<typeof useTranslations<"specs">>;

interface SpecRow {
  labelKey: "power" | "zeroToHundredKph" | "topSpeed" | "startingPrice";
  format: (vehicle: VehicleSummaryDto, t: SpecsTranslator) => string;
}

const SPEC_ROWS: SpecRow[] = [
  { labelKey: "power", format: (v, t) => t("hpValue", { value: formatNumber(v.horsepower) }) },
  { labelKey: "zeroToHundredKph", format: (v, t) => t("secondsValue", { value: formatNumber(v.zeroToHundredSec) }) },
  { labelKey: "topSpeed", format: (v, t) => t("kphValue", { value: formatNumber(v.topSpeedKph) }) },
  { labelKey: "startingPrice", format: (v) => formatPriceCents(v.basePriceCents, v.currency) },
];

/**
 * The spec-for-spec comparison table (Spec 18, AC-2) — matches SRS §20's example table
 * structure exactly: one row per metric, one column per vehicle. Real <table> semantics
 * (<th scope="col"> for the vehicle headers, <th scope="row"> for each metric) so a screen
 * reader can announce which value belongs to which vehicle and which metric (AC-9).
 * Wrapped in overflow-x-auto by the caller so it scrolls within its own container on a
 * narrow viewport rather than the page itself scrolling horizontally (AC-10).
 */
export function SpecTable({ left, right }: SpecTableProps) {
  const t = useTranslations("specs");
  return (
    <table className="w-full min-w-[28rem] border-collapse text-sm">
      <caption className="sr-only">
        {t("comparing", { left: left.name, right: right.name })}
      </caption>
      <thead>
        <tr className="border-b border-white/10">
          <th scope="col" className="py-2 text-left text-xs uppercase tracking-wide text-white/50">
            <span className="sr-only">{t("spec")}</span>
          </th>
          <th scope="col" className="py-2 text-left font-semibold text-white">
            {left.name}
          </th>
          <th scope="col" className="py-2 text-left font-semibold text-white">
            {right.name}
          </th>
        </tr>
      </thead>
      <tbody>
        {SPEC_ROWS.map((row) => (
          <tr key={row.labelKey} className="border-b border-white/5">
            <th scope="row" className="py-2 pr-4 text-left font-medium text-white/60">
              {t(row.labelKey)}
            </th>
            <td className="py-2 pr-4 text-white/90">{row.format(left, t)}</td>
            <td className="py-2 text-white/90">{row.format(right, t)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
