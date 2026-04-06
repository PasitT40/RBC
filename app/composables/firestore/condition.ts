const LEGACY_CONDITION_MAP: Record<string, number> = {
  NEW: 5,
  LIKE_NEW: 4.5,
  GOOD: 4,
  FAIR: 3,
};

const MIN_CONDITION = 0;
const MAX_CONDITION = 5;
const CONDITION_STEP = 0.5;
const DEFAULT_CONDITION = 4;

const clampCondition = (value: number) => Math.min(MAX_CONDITION, Math.max(MIN_CONDITION, value));
const roundToConditionStep = (value: number) => Math.round(value / CONDITION_STEP) * CONDITION_STEP;

export function normalizeProductCondition(value: unknown, fallback = DEFAULT_CONDITION) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampCondition(roundToConditionStep(value));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return fallback;

    const numericValue = Number(trimmed);
    if (Number.isFinite(numericValue)) {
      return clampCondition(roundToConditionStep(numericValue));
    }

    return LEGACY_CONDITION_MAP[trimmed.toUpperCase()] ?? fallback;
  }

  return fallback;
}

export function formatProductCondition(value: unknown) {
  return `${normalizeProductCondition(value).toFixed(1)}/5`;
}
