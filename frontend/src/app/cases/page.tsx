"use client";

import { useState, useCallback } from "react";
import { RotateCcw, Eye, CheckCircle2, XCircle, ChevronLeft } from "lucide-react";

type CasesTab = "articles" | "adjectives" | "prepositions" | "pronouns" | "tips" | "practice";

const CASE_COLORS: Record<string, string> = {
  Nominative: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/40",
  Accusative: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/40",
  Dative:     "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-900/40",
  Genitive:   "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-900/40",
};
const CASE_HEADER: Record<string, string> = {
  Nominative: "bg-blue-600 text-white",
  Accusative: "bg-red-600 text-white",
  Dative:     "bg-green-600 text-white",
  Genitive:   "bg-purple-600 text-white",
};

// ── Data ──────────────────────────────────────────────────────────────────────

const CASES = ["Nominative", "Accusative", "Dative", "Genitive"] as const;
const GENDERS = ["Masculine", "Feminine", "Neuter", "Plural"] as const;

const DEFINITE: Record<string, Record<string, string>> = {
  Nominative: { Masculine: "der", Feminine: "die", Neuter: "das", Plural: "die" },
  Accusative: { Masculine: "den", Feminine: "die", Neuter: "das", Plural: "die" },
  Dative:     { Masculine: "dem", Feminine: "der", Neuter: "dem", Plural: "den" },
  Genitive:   { Masculine: "des", Feminine: "der", Neuter: "des", Plural: "der" },
};
const INDEFINITE: Record<string, Record<string, string>> = {
  Nominative: { Masculine: "ein",   Feminine: "eine",  Neuter: "ein",   Plural: "—" },
  Accusative: { Masculine: "einen", Feminine: "eine",  Neuter: "ein",   Plural: "—" },
  Dative:     { Masculine: "einem", Feminine: "einer", Neuter: "einem", Plural: "—" },
  Genitive:   { Masculine: "eines", Feminine: "einer", Neuter: "eines", Plural: "—" },
};
const NEGATIVE: Record<string, Record<string, string>> = {
  Nominative: { Masculine: "kein",   Feminine: "keine",  Neuter: "kein",   Plural: "keine" },
  Accusative: { Masculine: "keinen", Feminine: "keine",  Neuter: "kein",   Plural: "keine" },
  Dative:     { Masculine: "keinem", Feminine: "keiner", Neuter: "keinem", Plural: "keinen" },
  Genitive:   { Masculine: "keines", Feminine: "keiner", Neuter: "keines", Plural: "keiner" },
};

// Adjective endings
const ADJ_WEAK: Record<string, Record<string, string>> = {
  Nominative: { Masculine: "-e",  Feminine: "-e",  Neuter: "-e",  Plural: "-en" },
  Accusative: { Masculine: "-en", Feminine: "-e",  Neuter: "-e",  Plural: "-en" },
  Dative:     { Masculine: "-en", Feminine: "-en", Neuter: "-en", Plural: "-en" },
  Genitive:   { Masculine: "-en", Feminine: "-en", Neuter: "-en", Plural: "-en" },
};
const ADJ_MIXED: Record<string, Record<string, string>> = {
  Nominative: { Masculine: "-er", Feminine: "-e",  Neuter: "-es", Plural: "-en" },
  Accusative: { Masculine: "-en", Feminine: "-e",  Neuter: "-es", Plural: "-en" },
  Dative:     { Masculine: "-en", Feminine: "-en", Neuter: "-en", Plural: "-en" },
  Genitive:   { Masculine: "-en", Feminine: "-en", Neuter: "-en", Plural: "-en" },
};
const ADJ_STRONG: Record<string, Record<string, string>> = {
  Nominative: { Masculine: "-er", Feminine: "-e",  Neuter: "-es", Plural: "-e"  },
  Accusative: { Masculine: "-en", Feminine: "-e",  Neuter: "-es", Plural: "-e"  },
  Dative:     { Masculine: "-em", Feminine: "-er", Neuter: "-em", Plural: "-en" },
  Genitive:   { Masculine: "-en", Feminine: "-er", Neuter: "-en", Plural: "-er" },
};

// Personal pronouns
const PRONOUNS = [
  { sub: "ich",  acc: "mich", dat: "mir",   gen: "meiner" },
  { sub: "du",   acc: "dich", dat: "dir",   gen: "deiner" },
  { sub: "er",   acc: "ihn",  dat: "ihm",   gen: "seiner" },
  { sub: "sie",  acc: "sie",  dat: "ihr",   gen: "ihrer"  },
  { sub: "es",   acc: "es",   dat: "ihm",   gen: "seiner" },
  { sub: "wir",  acc: "uns",  dat: "uns",   gen: "unser"  },
  { sub: "ihr",  acc: "euch", dat: "euch",  gen: "euer"   },
  { sub: "sie",  acc: "sie",  dat: "ihnen", gen: "ihrer"  },
  { sub: "Sie",  acc: "Sie",  dat: "Ihnen", gen: "Ihrer"  },
];

// Prepositions by case
const PREPS_ACC = [
  { prep: "durch", meaning: "through", example: "durch den Park — through the park" },
  { prep: "für",   meaning: "for",     example: "für den Mann — for the man" },
  { prep: "gegen", meaning: "against / around (time)", example: "gegen die Wand — against the wall" },
  { prep: "ohne",  meaning: "without", example: "ohne einen Grund — without a reason" },
  { prep: "um",    meaning: "around / at (time)", example: "um den Tisch — around the table" },
  { prep: "bis",   meaning: "until / up to", example: "bis nächsten Montag — until next Monday" },
  { prep: "entlang", meaning: "along (follows noun)", example: "den Fluss entlang — along the river" },
];
const PREPS_DAT = [
  { prep: "aus",       meaning: "from / out of",  example: "aus dem Haus — out of the house" },
  { prep: "bei",       meaning: "at / near / with", example: "bei der Arbeit — at work" },
  { prep: "mit",       meaning: "with",           example: "mit dem Bus — by bus" },
  { prep: "nach",      meaning: "after / to (cities/countries)", example: "nach der Schule — after school" },
  { prep: "seit",      meaning: "since / for (time)", example: "seit einem Jahr — for a year" },
  { prep: "von",       meaning: "from / of / by", example: "von der Stadt — from the city" },
  { prep: "zu",        meaning: "to (persons/places)", example: "zum Arzt — to the doctor" },
  { prep: "außer",     meaning: "except for",     example: "außer mir — except me" },
  { prep: "gegenüber", meaning: "opposite / towards", example: "dem Bahnhof gegenüber — opposite the station" },
  { prep: "ab",        meaning: "from (a point in time/place)", example: "ab dem ersten Januar — from January 1st" },
];
const PREPS_GEN = [
  { prep: "wegen",      meaning: "because of",      example: "wegen des Wetters — because of the weather" },
  { prep: "trotz",      meaning: "despite",          example: "trotz des Regens — despite the rain" },
  { prep: "während",    meaning: "during",           example: "während der Pause — during the break" },
  { prep: "statt/anstatt", meaning: "instead of",   example: "statt des Busses — instead of the bus" },
  { prep: "aufgrund",   meaning: "due to",           example: "aufgrund der Kosten — due to the costs" },
  { prep: "innerhalb",  meaning: "within",           example: "innerhalb der Stadt — within the city" },
  { prep: "außerhalb",  meaning: "outside of",       example: "außerhalb des Zentrums — outside the center" },
  { prep: "mithilfe",   meaning: "with the help of", example: "mithilfe des Lehrers — with the teacher's help" },
];
const PREPS_TWOWAYS = [
  { prep: "an",      acc_ex: "ans Fenster (wohin? → Akk.)",  dat_ex: "am Fenster (wo? → Dat.)" },
  { prep: "auf",     acc_ex: "auf den Tisch legen",          dat_ex: "auf dem Tisch liegen" },
  { prep: "hinter",  acc_ex: "hinter das Haus gehen",        dat_ex: "hinter dem Haus stehen" },
  { prep: "in",      acc_ex: "in die Küche gehen",           dat_ex: "in der Küche sein" },
  { prep: "neben",   acc_ex: "neben den Stuhl stellen",      dat_ex: "neben dem Stuhl stehen" },
  { prep: "über",    acc_ex: "über die Brücke fahren",       dat_ex: "über der Stadt fliegen" },
  { prep: "unter",   acc_ex: "unter den Tisch legen",        dat_ex: "unter dem Tisch liegen" },
  { prep: "vor",     acc_ex: "vor das Haus gehen",           dat_ex: "vor dem Haus stehen" },
  { prep: "zwischen",acc_ex: "zwischen die Bücher stellen",  dat_ex: "zwischen den Büchern stehen" },
];

// ── Components ────────────────────────────────────────────────────────────────

function CaseTag({ cas }: { cas: string }) {
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${CASE_COLORS[cas]}`}>
      {cas}
    </span>
  );
}

function ArticleTable({
  title, data, footnote,
}: { title: string; data: Record<string, Record<string, string>>; footnote?: string }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">{title}</h3>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <th className="px-3 py-2 text-left text-xs text-slate-500 dark:text-slate-400 font-semibold w-32">Case</th>
              {GENDERS.map((g) => (
                <th key={g} className="px-3 py-2 text-center text-xs text-slate-500 dark:text-slate-400 font-semibold">{g}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CASES.map((cas) => (
              <tr key={cas} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                <td className="px-3 py-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${CASE_COLORS[cas]}`}>
                    {cas.slice(0, 4).toUpperCase()}
                  </span>
                </td>
                {GENDERS.map((g) => (
                  <td key={g} className="px-3 py-2 text-center font-semibold text-slate-800 dark:text-slate-100">
                    {data[cas][g]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footnote && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 italic">{footnote}</p>}
    </div>
  );
}

function AdjTable({ title, data, subtitle }: { title: string; subtitle: string; data: Record<string, Record<string, string>> }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-0.5">{title}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{subtitle}</p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <th className="px-3 py-2 text-left text-xs text-slate-500 dark:text-slate-400 font-semibold w-32">Case</th>
              {GENDERS.map((g) => (
                <th key={g} className="px-3 py-2 text-center text-xs text-slate-500 dark:text-slate-400 font-semibold">{g}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CASES.map((cas) => (
              <tr key={cas} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                <td className="px-3 py-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${CASE_COLORS[cas]}`}>
                    {cas.slice(0, 4).toUpperCase()}
                  </span>
                </td>
                {GENDERS.map((g) => (
                  <td key={g} className="px-3 py-2 text-center font-mono font-semibold text-slate-800 dark:text-slate-100">
                    {data[cas][g]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Practice helpers & components ────────────────────────────────────────────

function normalizePractice(s: string): string {
  return s.trim().toLowerCase().replace(/^-/, "");
}

type PracticeMode =
  | "definite" | "indefinite" | "negative"
  | "adj_weak" | "adj_mixed" | "adj_strong"
  | "pronouns";

const PRACTICE_OPTIONS: { id: PracticeMode; title: string; sub: string; color: string }[] = [
  { id: "definite",   title: "Definite Articles",       sub: "der / die / das  ·  16 cells",   color: "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800" },
  { id: "indefinite", title: "Indefinite Articles",     sub: "ein / eine  ·  16 cells",        color: "bg-sky-50 border-sky-200 dark:bg-sky-900/20 dark:border-sky-800" },
  { id: "negative",   title: "Negative Articles",       sub: "kein / keine  ·  16 cells",      color: "bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-800" },
  { id: "adj_weak",   title: "Weak Adjective Endings",  sub: "after der/die/das  ·  16 cells", color: "bg-violet-50 border-violet-200 dark:bg-violet-900/20 dark:border-violet-800" },
  { id: "adj_mixed",  title: "Mixed Adjective Endings", sub: "after ein / kein  ·  16 cells",  color: "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800" },
  { id: "adj_strong", title: "Strong Adjective Endings",sub: "no article  ·  16 cells",        color: "bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800" },
  { id: "pronouns",   title: "Personal Pronouns",       sub: "acc + dat  ·  18 cells",         color: "bg-teal-50 border-teal-200 dark:bg-teal-900/20 dark:border-teal-800" },
];

const FILL_CONFIGS: Partial<Record<PracticeMode, {
  title: string; subtitle: string; hint: string;
  data: Record<string, Record<string, string>>; mono: boolean;
}>> = {
  definite:  { title: "Definite Articles",       subtitle: "Fill in the correct form of der / die / das",      hint: "der · die · das · den · dem · des",              data: DEFINITE,   mono: false },
  indefinite:{ title: "Indefinite Articles",     subtitle: "Fill in the correct form of ein / eine",           hint: "ein · eine · einem · einer · einen · eines",     data: INDEFINITE, mono: false },
  negative:  { title: "Negative Articles",       subtitle: "Fill in the correct form of kein / keine",         hint: "kein · keine · keinem · keiner · keinen · keines",data: NEGATIVE,  mono: false },
  adj_weak:  { title: "Weak Adjective Endings",  subtitle: "After definite articles: der / die / das",         hint: "-e · -en",                                       data: ADJ_WEAK,   mono: true  },
  adj_mixed: { title: "Mixed Adjective Endings", subtitle: "After indefinite / negative articles: ein / kein", hint: "-e · -en · -er · -es",                           data: ADJ_MIXED,  mono: true  },
  adj_strong:{ title: "Strong Adjective Endings",subtitle: "No article before the adjective",                  hint: "-e · -en · -em · -er · -es",                     data: ADJ_STRONG, mono: true  },
};

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 mb-5 transition-colors"
    >
      <ChevronLeft size={16} />
      Back to practice menu
    </button>
  );
}

function ScoreBar({ score, total }: { score: number; total: number }) {
  const pct = Math.round((score / total) * 100);
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ${
      score === total
        ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
        : pct >= 60
          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200"
          : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"
    }`}>
      {score === total ? "✓ Perfect!" : pct >= 60 ? "Good work!" : "Keep practising!"}&nbsp;
      {score} / {total} correct ({pct}%)
    </div>
  );
}

function FillTable({
  title, subtitle, hint, data, mono, onBack,
}: {
  title: string; subtitle: string; hint: string;
  data: Record<string, Record<string, string>>; mono?: boolean;
  onBack: () => void;
}) {
  const initAnswers = () =>
    Object.fromEntries(CASES.map(c => [c, Object.fromEntries(GENDERS.map(g => [g, ""]))]));

  const [answers, setAnswers] = useState<Record<string, Record<string, string>>>(initAnswers);
  const [checked, setChecked] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const isLocked = (v: string) => v === "—";

  const activeCells = CASES.reduce((s, c) =>
    s + GENDERS.reduce((ss, g) => ss + (isLocked(data[c][g]) ? 0 : 1), 0), 0);

  const score = checked
    ? CASES.reduce((s, c) =>
        s + GENDERS.reduce((ss, g) =>
          ss + (!isLocked(data[c][g]) && normalizePractice(answers[c][g]) === normalizePractice(data[c][g]) ? 1 : 0), 0), 0)
    : 0;

  const handleReset = () => { setAnswers(initAnswers()); setChecked(false); setShowAll(false); };

  const setCell = useCallback((cas: string, g: string, val: string) =>
    setAnswers(prev => ({ ...prev, [cas]: { ...prev[cas], [g]: val } })), []);

  const inputCls = `w-full text-center text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-1 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent${mono ? " font-mono" : ""}`;

  return (
    <div>
      <BackButton onClick={onBack} />
      <div className="mb-3">
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">{title}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
      <div className="mb-4 p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-500 dark:text-slate-400">
        <span className="font-semibold text-slate-600 dark:text-slate-300">Possible forms: </span>
        <span className="font-mono">{hint}</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 mb-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <th className="px-3 py-2 text-left text-xs text-slate-500 dark:text-slate-400 font-semibold w-28">Case</th>
              {GENDERS.map(g => (
                <th key={g} className="px-2 py-2 text-center text-xs text-slate-500 dark:text-slate-400 font-semibold">{g}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CASES.map(cas => (
              <tr key={cas} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                <td className="px-3 py-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${CASE_COLORS[cas]}`}>
                    {cas.slice(0, 4).toUpperCase()}
                  </span>
                </td>
                {GENDERS.map(g => {
                  const correct = data[cas][g];
                  const val = answers[cas][g];
                  const locked = isLocked(correct);
                  const ok = !locked && normalizePractice(val) === normalizePractice(correct);

                  if (locked) return (
                    <td key={g} className="px-2 py-2 text-center text-slate-300 dark:text-slate-600 font-mono">—</td>
                  );
                  if (showAll) return (
                    <td key={g} className="px-2 py-2 text-center">
                      <span className={`text-sm font-semibold text-brand-600 dark:text-brand-400${mono ? " font-mono" : ""}`}>{correct}</span>
                    </td>
                  );
                  if (checked) return (
                    <td key={g} className="px-2 py-2 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`text-sm font-semibold${mono ? " font-mono" : ""} ${ok ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400 line-through"}`}>
                          {val || "—"}
                        </span>
                        {!ok && <span className={`text-xs font-bold text-green-600 dark:text-green-400${mono ? " font-mono" : ""}`}>{correct}</span>}
                        {ok ? <CheckCircle2 size={12} className="text-green-500" /> : <XCircle size={12} className="text-red-500" />}
                      </div>
                    </td>
                  );
                  return (
                    <td key={g} className="px-2 py-2">
                      <input type="text" value={val} onChange={e => setCell(cas, g, e.target.value)}
                        className={inputCls} placeholder="?" />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!checked ? (
        <div className="flex gap-3">
          <button onClick={() => setChecked(true)} className="px-5 py-2 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors">
            Check Answers
          </button>
          <button onClick={handleReset} className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <ScoreBar score={score} total={activeCells} />
          <div className="flex gap-3 flex-wrap">
            <button onClick={handleReset} className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors">
              <RotateCcw size={14} /> Try Again
            </button>
            {!showAll && (
              <button onClick={() => setShowAll(true)} className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <Eye size={14} /> Show All Answers
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const PRONOUNS_PRACTICE_ROWS = [
  { label: "1st sg.",    sub: "ich",  acc: "mich", dat: "mir"   },
  { label: "2nd sg.",    sub: "du",   acc: "dich", dat: "dir"   },
  { label: "3rd sg. m.", sub: "er",   acc: "ihn",  dat: "ihm"   },
  { label: "3rd sg. f.", sub: "sie",  acc: "sie",  dat: "ihr"   },
  { label: "3rd sg. n.", sub: "es",   acc: "es",   dat: "ihm"   },
  { label: "1st pl.",    sub: "wir",  acc: "uns",  dat: "uns"   },
  { label: "2nd pl.",    sub: "ihr",  acc: "euch", dat: "euch"  },
  { label: "3rd pl.",    sub: "sie",  acc: "sie",  dat: "ihnen" },
  { label: "Formal",     sub: "Sie",  acc: "Sie",  dat: "Ihnen" },
];

type PronCol = "acc" | "dat";
const PRON_COLS: PronCol[] = ["acc", "dat"];

function PronounsFill({ onBack }: { onBack: () => void }) {
  const initAnswers = () =>
    Object.fromEntries(PRONOUNS_PRACTICE_ROWS.map((_, i) => [i, { acc: "", dat: "" }]));

  const [answers, setAnswers] = useState<Record<number, Record<PronCol, string>>>(initAnswers);
  const [checked, setChecked] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const total = PRONOUNS_PRACTICE_ROWS.length * PRON_COLS.length;
  const score = checked
    ? PRONOUNS_PRACTICE_ROWS.reduce((s, row, i) =>
        s + PRON_COLS.reduce((ss, col) =>
          ss + (normalizePractice(answers[i][col]) === normalizePractice(row[col]) ? 1 : 0), 0), 0)
    : 0;

  const handleReset = () => { setAnswers(initAnswers()); setChecked(false); setShowAll(false); };

  const setCell = useCallback((idx: number, col: PronCol, val: string) =>
    setAnswers(prev => ({ ...prev, [idx]: { ...prev[idx], [col]: val } })), []);

  const COL_HEAD: Record<PronCol, string> = { acc: "Accusative", dat: "Dative" };
  const COL_HEADER_CLS: Record<PronCol, string> = { acc: CASE_HEADER["Accusative"], dat: CASE_HEADER["Dative"] };
  const COL_OK_CLS: Record<PronCol, string> = {
    acc: "text-red-700 dark:text-red-400",
    dat: "text-green-700 dark:text-green-400",
  };

  const inputCls = "w-full text-center text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-1 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent";

  return (
    <div>
      <BackButton onClick={onBack} />
      <div className="mb-3">
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Personal Pronouns</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Fill in the Accusative and Dative forms</p>
      </div>
      <div className="mb-4 p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-500 dark:text-slate-400">
        <span className="font-semibold text-slate-600 dark:text-slate-300">Possible forms: </span>
        <span className="font-mono">mich · mir · dich · dir · ihn · ihm · sie · ihr · es · uns · euch · sie · ihnen · Sie · Ihnen</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 mb-5">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="px-3 py-2 text-left text-xs text-slate-500 dark:text-slate-400 font-semibold w-24 bg-slate-50 dark:bg-slate-800">Person</th>
              <th className={`px-3 py-2 text-center text-xs font-semibold ${CASE_HEADER["Nominative"]}`}>Nominative (given)</th>
              {PRON_COLS.map(col => (
                <th key={col} className={`px-3 py-2 text-center text-xs font-semibold ${COL_HEADER_CLS[col]}`}>{COL_HEAD[col]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PRONOUNS_PRACTICE_ROWS.map((row, i) => (
              <tr key={i} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                <td className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500">{row.label}</td>
                <td className="px-3 py-2 text-center font-bold text-blue-700 dark:text-blue-400">{row.sub}</td>
                {PRON_COLS.map(col => {
                  const correct = row[col];
                  const val = answers[i][col];
                  const ok = normalizePractice(val) === normalizePractice(correct);

                  if (showAll) return (
                    <td key={col} className="px-3 py-2 text-center">
                      <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">{correct}</span>
                    </td>
                  );
                  if (checked) return (
                    <td key={col} className="px-3 py-2 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={`text-sm font-semibold ${ok ? COL_OK_CLS[col] : "text-red-600 dark:text-red-400 line-through"}`}>{val || "—"}</span>
                        {!ok && <span className={`text-xs font-bold ${COL_OK_CLS[col]}`}>{correct}</span>}
                        {ok ? <CheckCircle2 size={12} className="text-green-500" /> : <XCircle size={12} className="text-red-500" />}
                      </div>
                    </td>
                  );
                  return (
                    <td key={col} className="px-2 py-1.5">
                      <input type="text" value={val} onChange={e => setCell(i, col, e.target.value)}
                        className={inputCls} placeholder="?" />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!checked ? (
        <div className="flex gap-3">
          <button onClick={() => setChecked(true)} className="px-5 py-2 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors">
            Check Answers
          </button>
          <button onClick={handleReset} className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <RotateCcw size={14} /> Reset
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <ScoreBar score={score} total={total} />
          <div className="flex gap-3 flex-wrap">
            <button onClick={handleReset} className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors">
              <RotateCcw size={14} /> Try Again
            </button>
            {!showAll && (
              <button onClick={() => setShowAll(true)} className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <Eye size={14} /> Show All Answers
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CasesPage() {
  const [tab, setTab] = useState<CasesTab>("articles");
  const [practiceMode, setPracticeMode] = useState<PracticeMode | null>(null);

  const innerTabs: { id: CasesTab; label: string }[] = [
    { id: "articles",     label: "Articles" },
    { id: "adjectives",   label: "Adjective Endings" },
    { id: "prepositions", label: "Prepositions" },
    { id: "pronouns",     label: "Pronouns" },
    { id: "tips",         label: "Tips & Tricks" },
    { id: "practice",     label: "✏ Practice" },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">German Cases (Fälle)</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Complete reference for der/die/das in all four grammatical cases
        </p>
        {/* Case legend */}
        <div className="flex gap-3 mt-3 flex-wrap">
          {CASES.map((c) => (
            <span key={c} className={`text-xs font-semibold px-3 py-1 rounded-full border ${CASE_COLORS[c]}`}>
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        {innerTabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === id
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Articles tab ── */}
      {tab === "articles" && (
        <div className="space-y-8">
          <div>
            <h2 className="text-base font-bold text-slate-700 dark:text-slate-200 mb-1">When to use each case</h2>
            <div className="grid sm:grid-cols-2 gap-3 mb-6">
              {[
                { cas: "Nominative", use: "Subject of the sentence (who/what does the action)", ex: "Der Mann schläft. — The man sleeps." },
                { cas: "Accusative", use: "Direct object (whom/what receives the action)", ex: "Ich sehe den Mann. — I see the man." },
                { cas: "Dative",     use: "Indirect object (to/for whom)", ex: "Ich gebe dem Mann das Buch. — I give the man the book." },
                { cas: "Genitive",   use: "Possession (whose / of which)", ex: "Das Auto des Mannes. — The man's car." },
              ].map(({ cas, use, ex }) => (
                <div key={cas} className={`p-3 rounded-xl border ${CASE_COLORS[cas]}`}>
                  <p className="font-bold text-sm">{cas}</p>
                  <p className="text-xs mt-0.5 opacity-80">{use}</p>
                  <p className="text-xs mt-1 font-mono opacity-90">{ex}</p>
                </div>
              ))}
            </div>
          </div>

          <ArticleTable
            title="Definite Articles (der / die / das)"
            data={DEFINITE}
            footnote="Note: Only masculine changes in Accusative (der → den). Feminine & Neuter are the same in Nom & Acc."
          />
          <ArticleTable
            title="Indefinite Articles (ein / eine / ein)"
            data={INDEFINITE}
            footnote="No plural indefinite article in German. Use 'keine' (negative) or just the noun."
          />
          <ArticleTable
            title="Negative Articles (kein / keine / kein)"
            data={NEGATIVE}
            footnote="'kein' follows the same pattern as 'ein' for singular; it also has a plural form unlike 'ein'."
          />

          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-xl text-sm">
            <p className="font-bold text-amber-800 dark:text-amber-200 mb-2">🔑 Key Changes to Memorise</p>
            <ul className="space-y-1 text-amber-700 dark:text-amber-300 text-xs">
              <li><span className="font-mono font-bold">Masculine Accusative:</span> der → den · ein → einen · kein → keinen</li>
              <li><span className="font-mono font-bold">Masculine/Neuter Dative:</span> dem · einem · keinem</li>
              <li><span className="font-mono font-bold">Feminine Dative:</span> der · einer · keiner (same as Masc Genitive!)</li>
              <li><span className="font-mono font-bold">Plural Dative:</span> den + noun adds -n (Männer → den Männern)</li>
              <li><span className="font-mono font-bold">Masculine/Neuter Genitive:</span> des + noun adds -s/es (des Mannes)</li>
            </ul>
          </div>
        </div>
      )}

      {/* ── Adjectives tab ── */}
      {tab === "adjectives" && (
        <div className="space-y-8">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Adjective endings depend on which article (if any) precedes them. There are three declension patterns.
          </p>

          <AdjTable
            title="Weak Declension"
            subtitle="After definite articles: der / die / das / die"
            data={ADJ_WEAK}
          />
          <div className="text-xs text-slate-500 dark:text-slate-400 -mt-4 ml-1 italic">
            Example: <span className="font-mono">der alte Mann · die alte Frau · das alte Haus · die alten Leute</span>
          </div>

          <AdjTable
            title="Mixed Declension"
            subtitle="After indefinite/negative articles: ein / eine / kein / mein / dein / sein …"
            data={ADJ_MIXED}
          />
          <div className="text-xs text-slate-500 dark:text-slate-400 -mt-4 ml-1 italic">
            Example: <span className="font-mono">ein alter Mann · eine alte Frau · ein altes Haus · keine alten Leute</span>
          </div>

          <AdjTable
            title="Strong Declension"
            subtitle="No article before the adjective (adjective carries the gender information)"
            data={ADJ_STRONG}
          />
          <div className="text-xs text-slate-500 dark:text-slate-400 -mt-4 ml-1 italic">
            Example: <span className="font-mono">kalter Kaffee · frische Milch · gutes Brot · alte Menschen</span>
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/40 rounded-xl text-sm">
            <p className="font-bold text-blue-800 dark:text-blue-300 mb-2">💡 Pattern Trick</p>
            <p className="text-blue-700 dark:text-blue-300 text-xs leading-relaxed">
              The adjective ending mirrors the <strong>definite article ending</strong> when there's no article or only a weak article.
              Think of it as: <em>someone</em> has to show the gender — either the article or the adjective does.
              After <strong>der/die/das</strong> (which already shows gender clearly), adjectives mostly end in <strong>-e</strong> or <strong>-en</strong>.
            </p>
          </div>
        </div>
      )}

      {/* ── Prepositions tab ── */}
      {tab === "prepositions" && (
        <div className="space-y-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-sm font-bold px-3 py-1 rounded-full border ${CASE_COLORS["Accusative"]}`}>Accusative Only</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">— always take the accusative case</span>
            </div>
            <div className="space-y-2">
              {PREPS_ACC.map(({ prep, meaning, example }) => (
                <div key={prep} className="flex items-start gap-3 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded-xl text-sm">
                  <span className="font-bold text-red-700 dark:text-red-300 w-20 shrink-0">{prep}</span>
                  <span className="text-slate-500 dark:text-slate-400 w-36 shrink-0 text-xs">{meaning}</span>
                  <span className="text-slate-600 dark:text-slate-300 text-xs italic">{example}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 italic">Mnemonic: <strong>DOGFU</strong> — Durch, Ohne, Gegen, Für, Um</p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-sm font-bold px-3 py-1 rounded-full border ${CASE_COLORS["Dative"]}`}>Dative Only</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">— always take the dative case</span>
            </div>
            <div className="space-y-2">
              {PREPS_DAT.map(({ prep, meaning, example }) => (
                <div key={prep} className="flex items-start gap-3 px-4 py-2.5 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/40 rounded-xl text-sm">
                  <span className="font-bold text-green-700 dark:text-green-300 w-20 shrink-0">{prep}</span>
                  <span className="text-slate-500 dark:text-slate-400 w-36 shrink-0 text-xs">{meaning}</span>
                  <span className="text-slate-600 dark:text-slate-300 text-xs italic">{example}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 italic">Mnemonic: <strong>ABMNSSVZ</strong> — Aus, Bei, Mit, Nach, Seit, Von, Zu + außer, gegenüber, ab</p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-bold px-3 py-1 rounded-full border bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-900/40">Genitive Only</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">— mostly written/formal German</span>
            </div>
            <div className="space-y-2">
              {PREPS_GEN.map(({ prep, meaning, example }) => (
                <div key={prep} className="flex items-start gap-3 px-4 py-2.5 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-900/40 rounded-xl text-sm">
                  <span className="font-bold text-purple-700 dark:text-purple-300 w-28 shrink-0">{prep}</span>
                  <span className="text-slate-500 dark:text-slate-400 w-32 shrink-0 text-xs">{meaning}</span>
                  <span className="text-slate-600 dark:text-slate-300 text-xs italic">{example}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 italic">Note: In spoken German, many genitive prepositions are used with dative (wegen dem Wetter).</p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex gap-1">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${CASE_COLORS["Accusative"]}`}>ACC</span>
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500">or</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${CASE_COLORS["Dative"]}`}>DAT</span>
              </div>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Two-way Prepositions (Wechselpräpositionen)</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Ask <strong>wohin?</strong> (where to? → movement) → Accusative &nbsp;|&nbsp;
              Ask <strong>wo?</strong> (where? → location/state) → Dative
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300 w-20">Prep</th>
                    <th className="px-3 py-2 text-left font-semibold text-red-600 dark:text-red-400">Accusative (wohin?)</th>
                    <th className="px-3 py-2 text-left font-semibold text-green-600 dark:text-green-400">Dative (wo?)</th>
                  </tr>
                </thead>
                <tbody>
                  {PREPS_TWOWAYS.map(({ prep, acc_ex, dat_ex }) => (
                    <tr key={prep} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-200">{prep}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300 italic">{acc_ex}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-300 italic">{dat_ex}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Pronouns tab ── */}
      {tab === "pronouns" && (
        <div className="space-y-8">
          <div>
            <h2 className="text-base font-bold text-slate-700 dark:text-slate-200 mb-3">Personal Pronouns (Personalpronomen)</h2>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <th className="px-3 py-2 text-left text-xs text-slate-500 dark:text-slate-400 font-semibold">Person</th>
                    <th className={`px-3 py-2 text-center text-xs font-semibold ${CASE_HEADER["Nominative"]}`}>Nominative (subject)</th>
                    <th className={`px-3 py-2 text-center text-xs font-semibold ${CASE_HEADER["Accusative"]}`}>Accusative (direct obj.)</th>
                    <th className={`px-3 py-2 text-center text-xs font-semibold ${CASE_HEADER["Dative"]}`}>Dative (indirect obj.)</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold bg-slate-400 text-white">Genitive (rare)</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: "1st sg.", sub: "ich",  acc: "mich", dat: "mir",   gen: "meiner" },
                    { label: "2nd sg.", sub: "du",   acc: "dich", dat: "dir",   gen: "deiner" },
                    { label: "3rd sg. m.", sub: "er",   acc: "ihn",  dat: "ihm",   gen: "seiner" },
                    { label: "3rd sg. f.", sub: "sie",  acc: "sie",  dat: "ihr",   gen: "ihrer"  },
                    { label: "3rd sg. n.", sub: "es",   acc: "es",   dat: "ihm",   gen: "seiner" },
                    { label: "1st pl.", sub: "wir",  acc: "uns",  dat: "uns",   gen: "unser"  },
                    { label: "2nd pl.", sub: "ihr",  acc: "euch", dat: "euch",  gen: "euer"   },
                    { label: "3rd pl.", sub: "sie",  acc: "sie",  dat: "ihnen", gen: "ihrer"  },
                    { label: "Formal", sub: "Sie",  acc: "Sie",  dat: "Ihnen", gen: "Ihrer"  },
                  ].map(({ label, sub, acc, dat, gen }) => (
                    <tr key={label} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <td className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500">{label}</td>
                      <td className="px-3 py-2 text-center font-bold text-blue-700 dark:text-blue-400">{sub}</td>
                      <td className="px-3 py-2 text-center font-bold text-red-700 dark:text-red-400">{acc}</td>
                      <td className="px-3 py-2 text-center font-bold text-green-700 dark:text-green-400">{dat}</td>
                      <td className="px-3 py-2 text-center text-slate-400 dark:text-slate-500 text-xs">{gen}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-700 dark:text-slate-200 mb-3">Possessive Pronouns (Possessivartikel)</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Possessives decline like <strong>kein</strong> (indefinite article pattern — mixed declension)</p>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-400 font-semibold">Pronoun</th>
                    <th className="px-3 py-2 text-center text-slate-500 dark:text-slate-400 font-semibold">Meaning</th>
                    <th className="px-3 py-2 text-center text-slate-500 dark:text-slate-400 font-semibold">Masc Nom</th>
                    <th className="px-3 py-2 text-center text-slate-500 dark:text-slate-400 font-semibold">Fem Nom</th>
                    <th className="px-3 py-2 text-center text-slate-500 dark:text-slate-400 font-semibold">Neut Nom</th>
                    <th className="px-3 py-2 text-center text-slate-500 dark:text-slate-400 font-semibold">Plural Nom</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { pro: "mein-", meaning: "my",        m: "mein",  f: "meine",  n: "mein",  pl: "meine" },
                    { pro: "dein-", meaning: "your (inf.)",m: "dein",  f: "deine",  n: "dein",  pl: "deine" },
                    { pro: "sein-", meaning: "his / its",  m: "sein",  f: "seine",  n: "sein",  pl: "seine" },
                    { pro: "ihr-",  meaning: "her / their",m: "ihr",   f: "ihre",   n: "ihr",   pl: "ihre"  },
                    { pro: "unser-",meaning: "our",        m: "unser", f: "unsere", n: "unser", pl: "unsere"},
                    { pro: "euer-", meaning: "your (pl.)", m: "euer",  f: "eure",   n: "euer",  pl: "eure"  },
                    { pro: "Ihr-",  meaning: "your (form.)",m: "Ihr",  f: "Ihre",   n: "Ihr",   pl: "Ihre"  },
                  ].map(({ pro, meaning, m, f, n, pl }) => (
                    <tr key={pro} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-200">{pro}</td>
                      <td className="px-3 py-2 text-center text-slate-500 dark:text-slate-400">{meaning}</td>
                      <td className="px-3 py-2 text-center font-mono dark:text-slate-200">{m}</td>
                      <td className="px-3 py-2 text-center font-mono dark:text-slate-200">{f}</td>
                      <td className="px-3 py-2 text-center font-mono dark:text-slate-200">{n}</td>
                      <td className="px-3 py-2 text-center font-mono dark:text-slate-200">{pl}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-700 dark:text-slate-200 mb-3">Relative Pronouns (Relativpronomen)</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Relative pronouns mirror definite articles, with a few exceptions in Dative plural and Genitive.</p>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                    <th className="px-3 py-2 text-left text-xs text-slate-500 dark:text-slate-400 font-semibold">Case</th>
                    {GENDERS.map((g) => <th key={g} className="px-3 py-2 text-center text-xs text-slate-500 dark:text-slate-400 font-semibold">{g}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { cas: "Nominative", m: "der",    f: "die",   n: "das",   pl: "die" },
                    { cas: "Accusative", m: "den",    f: "die",   n: "das",   pl: "die" },
                    { cas: "Dative",     m: "dem",    f: "der",   n: "dem",   pl: "denen" },
                    { cas: "Genitive",   m: "dessen", f: "deren", n: "dessen", pl: "deren" },
                  ].map(({ cas, m, f, n, pl }) => (
                    <tr key={cas} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <td className="px-3 py-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${CASE_COLORS[cas]}`}>
                          {cas.slice(0,4).toUpperCase()}
                        </span>
                      </td>
                      {[m, f, n, pl].map((v, i) => (
                        <td key={i} className="px-3 py-2 text-center font-semibold text-slate-800 dark:text-slate-100">{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 italic">
              Note: Dative plural is <strong>denen</strong> (not den), and Genitive uses <strong>dessen/deren</strong>.
            </p>
          </div>
        </div>
      )}

      {/* ── Practice tab ── */}
      {tab === "practice" && (
        <div>
          {!practiceMode ? (
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                Read the reference tables in the other tabs first, then test yourself here.
                All answers are checked case-insensitively. For adjective endings you can type
                with or without the leading <span className="font-mono">-</span> (e.g. <span className="font-mono">en</span> or <span className="font-mono">-en</span>).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRACTICE_OPTIONS.map(({ id, title, sub, color }) => (
                  <button
                    key={id}
                    onClick={() => setPracticeMode(id)}
                    className={`p-4 rounded-xl border-2 text-left hover:scale-[1.01] active:scale-[0.99] transition-all ${color}`}
                  >
                    <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">{title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sub}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : practiceMode === "pronouns" ? (
            <PronounsFill onBack={() => setPracticeMode(null)} />
          ) : (
            (() => {
              const cfg = FILL_CONFIGS[practiceMode];
              if (!cfg) return null;
              return (
                <FillTable
                  key={practiceMode}
                  title={cfg.title}
                  subtitle={cfg.subtitle}
                  hint={cfg.hint}
                  data={cfg.data}
                  mono={cfg.mono}
                  onBack={() => setPracticeMode(null)}
                />
              );
            })()
          )}
        </div>
      )}

      {/* ── Tips tab ── */}
      {tab === "tips" && (
        <div className="space-y-5">
          {[
            {
              title: "The 'der-word' trick",
              color: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/40",
              titleColor: "text-blue-800 dark:text-blue-300",
              tips: [
                "All der-words (dieser, jener, welcher, jeder, mancher) follow the SAME endings as definite articles",
                "Masculine is the only gender that changes in Accusative: der → den / ein → einen",
                "Feminine and Neuter are identical in Nominative and Accusative",
              ],
            },
            {
              title: "Accusative: only masculine changes!",
              color: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/40",
              titleColor: "text-red-800 dark:text-red-300",
              tips: [
                "Only masculine articles change in accusative: der → den, ein → einen",
                "Feminine stays die/eine, Neuter stays das/ein — same as nominative",
                "This makes accusative much easier than it looks",
              ],
            },
            {
              title: "Dative: dem is your friend",
              color: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900/40",
              titleColor: "text-green-800 dark:text-green-300",
              tips: [
                "Masculine and Neuter both use 'dem' in dative — remember: M+N → dem",
                "Feminine dative is 'der' — same as masculine nominative! (context decides)",
                "Plural dative: always 'den' + add -n to the noun (den Männern, den Kindern)",
                "All adjectives end in -en in dative (without exception)",
              ],
            },
            {
              title: "Genitive: the 'S' rule",
              color: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-900/40",
              titleColor: "text-purple-800 dark:text-purple-300",
              tips: [
                "Masculine and Neuter add -s (short words) or -es (longer words) to the noun",
                "des Mannes, des Kindes — but: des Autos (already ends in -s-sound, add -s)",
                "Feminine and Plural both use 'der' in genitive",
                "In spoken German, von + Dative often replaces Genitive: das Buch von dem Mann",
              ],
            },
            {
              title: "Preposition memory tricks",
              color: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/40",
              titleColor: "text-amber-800 dark:text-amber-200",
              tips: [
                "Accusative: DOGFU — Durch, Ohne, Gegen, Für, Um",
                "Dative: ABMNSSVZ — Aus, Bei, Mit, Nach, Seit, Von, Zu + außer, gegenüber",
                "Two-way prepositions: wohin? (where to) → Accusative | wo? (where) → Dative",
                "Verbs of movement use Accusative; verbs of position (liegen, stehen, hängen) use Dative",
              ],
            },
            {
              title: "Noun gender hints",
              color: "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700",
              titleColor: "text-slate-700 dark:text-slate-200",
              tips: [
                "Masculine (-er, -ling, -ist, -or): der Lehrer, der Frühling, der Tourist, der Motor",
                "Feminine (-ung, -keit, -heit, -schaft, -tion, -tät): die Wohnung, die Freiheit",
                "Neuter (-chen, -lein, -ment, -um): das Mädchen, das System, das Zentrum",
                "All infinitives used as nouns are neuter: das Lesen, das Schreiben",
              ],
            },
          ].map(({ title, color, titleColor, tips }) => (
            <div key={title} className={`p-4 rounded-xl border ${color}`}>
              <p className={`font-bold text-sm mb-2 ${titleColor}`}>{title}</p>
              <ul className="space-y-1">
                {tips.map((t, i) => (
                  <li key={i} className="text-xs text-slate-600 dark:text-slate-300 flex gap-2">
                    <span className="text-slate-400 dark:text-slate-500">•</span> {t}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
