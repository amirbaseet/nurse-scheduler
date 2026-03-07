// ═══════════════════════════════════════════
// Algorithm version type + UI options
// Safe to import from client components (no fs/Node deps)
// ═══════════════════════════════════════════

export type AlgorithmVersion = "v1-clinic-first" | "v2-nurse-first";

export const ALGORITHM_OPTIONS: Array<{
  value: AlgorithmVersion;
  labelKey: string;
  descKey: string;
}> = [
  {
    value: "v1-clinic-first",
    labelKey: "algo_v1_label",
    descKey: "algo_v1_desc",
  },
  {
    value: "v2-nurse-first",
    labelKey: "algo_v2_label",
    descKey: "algo_v2_desc",
  },
];
