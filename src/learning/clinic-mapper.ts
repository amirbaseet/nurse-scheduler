/**
 * Maps raw clinic strings from weekly_schedules.json to canonical clinic codes.
 *
 * The historical data has ~400 unique free-text strings for 23 clinics.
 * This mapper handles: variants, misspellings, compound "A + B" assignments,
 * room numbers, and non-clinic entries (holidays, training, etc.).
 */

export type ParsedClinic = {
  primary: string | null;
  secondary: string | null;
};

// ── Full-string entries that are NOT clinic assignments ──────────────
const SKIP_ENTRIES = new Set([
  "חופש",
  "חופש נוסף",
  "BLS",
  "CPR",
  "אונליין",
  "יום עיון",
  "עיון",
  "אבני בוחן",
  "בחירה",
  "ניהול סיכונים",
  "עתקון רשמת מכשרים",
  "בדיקות פנל גנטי",
  "בית חנינה",
  "יום הולדת הנביא מוחמד",
  "יום העצמאות",
  "ראש השנה ההג'רית",
  "كل عام و انتم بخير",
  "كل عام وانتم بخير",
]);

// ── Multi-word clinic patterns (checked BEFORE splitting on +) ──────
// Sorted by length descending so "עיניים ילדיים" matches before "עיניים"
const MULTI_WORD_CLINICS: readonly [string, string | null][] = [
  // Non-clinic multi-word (must be nulled out before clinic matching)
  ["עגלת החייאה חדשה", null],
  ["יום בריאות סרטן השד", null],
  ["הדרכת ביטחון", null],
  ["עגלת החייאה", null],
  ["עגלת אחיאה", null],

  // Clinic multi-word patterns
  ["אי ספיקת לב", "heart_failure"],
  ["עיניים ילדיים", "pediatric_ophthalmology"],
  ["עיניים ילדים", "pediatric_ophthalmology"],
  ["אורטופידיה ילדים", "pediatric_orthopedics"],
  ["אורטופידה ילדים", "pediatric_orthopedics"],
  ["אורטופיד ילדים", "pediatric_orthopedics"],
  ["Type 1 Diabetes", "type1_diabetes"],
  ["סכרת type 1", "type1_diabetes"],
  ["סכרת type1", "type1_diabetes"],
  ["typ1 סכרת", "type1_diabetes"],
  ["העמסת סוכר", "sugar_load"],
  ["העמסת סכרת", "sugar_load"],
  ["מערך שד", "breast"],
  ["מתאמות שד", "breast"],
  ["כף יד", "hand_clinic"],
  ["כף רגל", "hand_clinic"],
  ["אי ספיקה", "heart_failure"],
  ["אי ס.ל", "heart_failure"],
  ["ע.ילדים", "pediatric_ophthalmology"],
  ["type 1", "type1_diabetes"],
  ["typ 1", "type1_diabetes"],
  ["ע.י", "pediatric_ophthalmology"],
];

// ── Single-word clinic mappings ─────────────────────────────────────
// Sorted by length descending to prevent partial matches
// (e.g. "אורטופידיה" before "אורטופיד")
const SINGLE_WORD_CLINICS: readonly [string, string][] = [
  ["סקלירוטראפיה", "sclerotherapy"],
  ["סקלרותרפיה", "sclerotherapy"],
  ["אורטופידיה", "orthopedics"],
  ["תעסוקתית", "occupational_therapy"],
  ["פלאסטיקה", "plastic_surgery"],
  ["פלסטיקה", "plastic_surgery"],
  ["כירורגיה", "surgery"],
  ["אורטופיד", "orthopedics"],
  ["אורטופד", "orthopedics"],
  ["מקצועית", "professional"],
  ["אווסטין", "avastin"],
  ["שטראוס", "strauss"],
  ["עיניים", "ophthalmology"],
  ["Avastin", "avastin"],
  ["avastin", "avastin"],
  ["סוכרת", "diabetes"],
  ["סיכרת", "diabetes"],
  ["סכרת", "diabetes"],
  ["סוכר", "diabetes"],
  ["זוליר", "xolair"],
  ["חיסון", "vaccination"],
  ["חיסן", "vaccination"],
  ["מנטו", "mantoux"],
  ["א.א.ג", "ent"],
  ["א.ק.ג", "ecg"],
  ["type1", "type1_diabetes"],
  ["typ1", "type1_diabetes"],
  ["מ.ש", "urinary_catheter"],
  ["שד", "breast"],
];

// ── Non-clinic tokens to skip when found inside compound strings ────
const SKIP_TOKENS = new Set([
  "ישיבה",
  "ישבה",
  "חדרים",
  "חדר",
  "עגלות",
  "מחסן",
  "מכשרים",
  "הדרכת",
  "בילאל",
  "בלאל",
  "אלזהרא",
  "אלחכמה",
  "סנה",
  "פרקטלוג",
  "נשים",
  "ילדים",
  "ילדיים",
]);

/**
 * Extract all recognized clinic codes from a raw text string.
 * Checks multi-word patterns first (longest wins), then single-word.
 * Returns codes in the order they appear.
 */
function extractClinicCodes(raw: string): string[] {
  const found: string[] = [];
  let remaining = raw;

  // Pass 1: Multi-word patterns (longest first)
  for (const [pattern, code] of MULTI_WORD_CLINICS) {
    if (remaining.includes(pattern)) {
      if (code !== null) found.push(code);
      remaining = remaining.replace(pattern, " ");
    }
  }

  // Pass 2: Split remaining on delimiters, then check single-word
  const tokens = remaining
    .split(/[+\-\/]/)
    .map((t) => t.trim())
    .filter(Boolean);

  for (const token of tokens) {
    // Strip trailing digits (room numbers like "א.א.ג 1" → "א.א.ג")
    const cleaned = token.replace(/\s*\d+\s*$/, "").trim();
    if (!cleaned || /^\d+$/.test(cleaned)) continue;
    if (SKIP_TOKENS.has(cleaned)) continue;

    // Check single-word clinics (longest first to avoid partial matches)
    for (const [name, code] of SINGLE_WORD_CLINICS) {
      if (cleaned.includes(name)) {
        found.push(code);
        break; // One clinic per token
      }
    }
  }

  // Deduplicate while preserving order
  const seen = new Set<string>();
  return found.filter((code) => {
    if (seen.has(code)) return false;
    seen.add(code);
    return true;
  });
}

/**
 * Parse a raw clinic string into primary and secondary clinic codes.
 *
 * @param raw - The clinic_raw value from weekly_schedules.json
 * @returns { primary, secondary } with clinic codes or null
 */
export function parseClinicRaw(raw: string): ParsedClinic {
  const trimmed = raw.trim();

  if (!trimmed || SKIP_ENTRIES.has(trimmed)) {
    return { primary: null, secondary: null };
  }

  const codes = extractClinicCodes(trimmed);

  return {
    primary: codes[0] ?? null,
    secondary: codes[1] ?? null,
  };
}

// ── Day name mapping ────────────────────────────────────────────────
const DAY_MAP: Record<string, string> = {
  Sun: "SUN",
  Mon: "MON",
  Tue: "TUE",
  Wed: "WED",
  Thu: "THU",
  Fri: "FRI",
  Sat: "SAT",
};

export function mapDayName(day: string): string | null {
  return DAY_MAP[day] ?? null;
}

// ── Hours parsing ───────────────────────────────────────────────────
/**
 * Parse raw hours string into { start, end, isMorning }.
 * Handles "08:00-16:00" and "0800-1200" formats.
 */
export function parseHours(raw: string | null): {
  start: string;
  end: string;
  isMorning: boolean;
  hours: number;
} | null {
  if (!raw) return null;

  const normalized = raw.replace(/\s/g, "");
  const match = normalized.match(/^(\d{2}):?(\d{2})-(\d{2}):?(\d{2})$/);
  if (!match) return null;

  const [, sh, sm, eh, em] = match;
  const start = `${sh}:${sm}`;
  const end = `${eh}:${em}`;
  const startMinutes = Number(sh) * 60 + Number(sm);
  const endMinutes = Number(eh) * 60 + Number(em);
  const hours = (endMinutes - startMinutes) / 60;

  return {
    start,
    end,
    isMorning: startMinutes < 720, // before 12:00
    hours: Math.max(0, hours),
  };
}
