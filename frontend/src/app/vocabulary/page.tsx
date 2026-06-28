"use client";

import { useState, useEffect } from "react";
import { FlashCard } from "@/src/components/vocabulary/FlashCard";
import { QuizGame } from "@/src/components/vocabulary/QuizGame";
import { LevelBadge } from "@/src/components/layout/LevelBadge";
import { getDueWords, listWords, reviewWord, deleteWord, batchAnalyzeWords, saveWord } from "@/src/lib/api";
import { useAppStore } from "@/src/lib/store";
import { BookOpen, Layers, Check, Trash2, Gamepad2, Volume2, Plus, Download, X, Search, ChevronDown, Sparkles, Loader2 } from "lucide-react";
import { speakGerman } from "@/src/lib/speak";
import { getTranslation } from "@/src/lib/languages";

type Mode = "review" | "browse" | "quiz";

function wordStatus(word: any): { label: string; color: string } {
  if (!word.seen_count || word.seen_count === 0)
    return { label: "New", color: "bg-blue-400" };
  if (word.confidence >= 4)
    return { label: "Mastered", color: "bg-emerald-500" };
  if (word.confidence >= 2)
    return { label: "Learning", color: "bg-amber-400" };
  return { label: "Struggling", color: "bg-red-400" };
}

export default function VocabularyPage() {
  const { userLevel, translationLanguages } = useAppStore();
  const langs = translationLanguages.length > 0
    ? translationLanguages
    : [{ code: "en", name: "English", nativeName: "English", rtl: false }];

  const [mode, setMode] = useState<Mode>("review");
  useEffect(() => {
    const saved = sessionStorage.getItem("vocab_mode") as Mode | null;
    if (saved) setMode(saved);
  }, []);
  useEffect(() => { sessionStorage.setItem("vocab_mode", mode); }, [mode]);
  const [dueWords, setDueWords] = useState<any[]>([]);
  const [allWords, setAllWords] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewed, setReviewed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterLevel, setFilterLevel] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedWordId, setExpandedWordId] = useState<string | null>(null);
  const [sessionDone, setSessionDone] = useState(false);

  // Add word state
  const [showAddWord, setShowAddWord] = useState(false);
  const [addInput, setAddInput] = useState("");
  const [addAnalyzing, setAddAnalyzing] = useState(false);
  const [addResult, setAddResult] = useState<any>(null);
  const [addSaved, setAddSaved] = useState(false);
  const [addError, setAddError] = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [due, all] = await Promise.all([getDueWords(30), listWords()]);
      setDueWords(due);
      setAllWords(all);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRate = async (quality: number) => {
    const word = dueWords[currentIndex];
    if (!word) return;
    try {
      await reviewWord(word.id, quality);
      setReviewed((r) => r + 1);
      if (currentIndex + 1 >= dueWords.length) {
        setSessionDone(true);
      } else {
        setCurrentIndex((i) => i + 1);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (wordId: string) => {
    try {
      await deleteWord(wordId);
      setAllWords((prev) => prev.filter((w) => w.id !== wordId));
      setDueWords((prev) => prev.filter((w) => w.id !== wordId));
    } catch (e) {
      console.error(e);
    }
  };

  // ── Add individual word ────────────────────────────────────────────────────

  const handleAnalyzeWord = async () => {
    if (!addInput.trim()) return;
    setAddAnalyzing(true);
    setAddResult(null);
    setAddSaved(false);
    setAddError("");
    try {
      const results = await batchAnalyzeWords([addInput.trim()], userLevel, translationLanguages);
      if (results[0]) setAddResult(results[0]);
    } catch (e: any) {
      setAddError(e?.message?.slice(0, 100) || "Analysis failed");
    } finally {
      setAddAnalyzing(false);
    }
  };

  const handleSaveAddedWord = async () => {
    if (!addResult) return;
    await saveWord(addResult);
    setAddSaved(true);
    setAddInput("");
    setAddResult(null);
    setShowAddWord(false);
    await loadData();
  };

  // ── Export PDF ─────────────────────────────────────────────────────────────

  const exportPDF = () => {
    const wordsToExport = filteredWords.length > 0 ? filteredWords : allWords;
    const headerCells = `
      <th>Word</th>
      <th>Type</th>
      <th>Level</th>
      ${langs.map((l) => `<th>${l.nativeName}</th>`).join("")}
      <th>Example</th>
    `;
    const rows = wordsToExport.map((w) => `
      <tr>
        <td><strong>${w.gender && w.gender !== "null" ? w.gender + " " : ""}${w.german}</strong></td>
        <td>${w.word_type || ""}</td>
        <td>${w.cefr_level || ""}</td>
        ${langs.map((l) => `<td>${getTranslation(w, l.code) || ""}</td>`).join("")}
        <td><em>${w.example_de || ""}</em></td>
      </tr>
    `).join("");

    const html = `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8">
  <title>Vocabulary Export</title>
  <style>
    body { font-family: Georgia, serif; font-size: 11px; margin: 20px; color: #1e293b; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    p.sub { color: #64748b; margin-bottom: 16px; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #f1f5f9; text-align: left; padding: 6px 8px; border: 1px solid #cbd5e1; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; }
    td { padding: 5px 8px; border: 1px solid #e2e8f0; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
    @media print { @page { margin: 1.5cm; } }
  </style>
</head><body>
  <h1>My German Vocabulary</h1>
  <p class="sub">${wordsToExport.length} words</p>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <script>window.onload = () => { window.print(); }</script>
</body></html>`;

    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  // ─────────────────────────────────────────────────────────────────────────

  const filteredWords = allWords.filter((w) => {
    if (filterType !== "all" && w.word_type !== filterType) return false;
    if (filterLevel !== "all" && w.cefr_level !== filterLevel) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        w.german?.toLowerCase().includes(q) ||
        w.english?.toLowerCase().includes(q) ||
        w.persian?.toLowerCase().includes(q) ||
        w.example_de?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (mode === "quiz") {
    return (
      <div className="max-w-md mx-auto h-[calc(100vh-80px)]">
        <QuizGame words={allWords} onClose={() => { setMode("browse"); loadData(); }} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Vocabulary</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {allWords.length} words saved · {dueWords.length} due for review
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setMode("review")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === "review" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            <Layers size={16} /> Review ({dueWords.length})
          </button>
          <button
            onClick={() => setMode("browse")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === "browse" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            }`}
          >
            <BookOpen size={16} /> Browse
          </button>
          <button
            onClick={() => setMode("quiz")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <Gamepad2 size={16} /> Quiz
          </button>
        </div>
      </div>

      {/* ── Flashcard review ── */}
      {mode === "review" && (
        <>
          {dueWords.length === 0 || sessionDone ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">🎉</div>
              <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200">
                {sessionDone ? "Session complete!" : "All caught up!"}
              </h2>
              <p className="text-slate-500 dark:text-slate-400 mt-2">
                {sessionDone
                  ? `You reviewed ${reviewed} words. Come back tomorrow for more.`
                  : "No words due for review. Add more from the book reader."}
              </p>
              {sessionDone && (
                <button
                  onClick={() => { setCurrentIndex(0); setReviewed(0); setSessionDone(false); loadData(); }}
                  className="mt-6 px-6 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700"
                >
                  Start new session
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
                  <span>{currentIndex} / {dueWords.length} reviewed</span>
                  <span>{Math.round((currentIndex / dueWords.length) * 100)}%</span>
                </div>
                <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full">
                  <div
                    className="h-2 bg-brand-600 rounded-full transition-all"
                    style={{ width: `${(currentIndex / dueWords.length) * 100}%` }}
                  />
                </div>
              </div>
              <FlashCard word={dueWords[currentIndex]} onRate={handleRate} />
            </>
          )}
        </>
      )}

      {/* ── Browse ── */}
      {mode === "browse" && (
        <>
          {/* Toolbar: legend + actions */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex gap-4 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
              {[
                { color: "bg-blue-400", label: "New" },
                { color: "bg-red-400", label: "Struggling" },
                { color: "bg-amber-400", label: "Learning" },
                { color: "bg-emerald-500", label: "Mastered" },
              ].map(({ color, label }) => (
                <span key={label} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                  {label}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddWord(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-xs font-semibold rounded-lg hover:bg-brand-700 transition-colors"
              >
                <Plus size={13} /> Add word
              </button>
              <button
                onClick={exportPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                <Download size={13} /> Export PDF
              </button>
            </div>
          </div>

          {/* Add word panel */}
          {showAddWord && (
            <div className="mb-5 p-4 bg-brand-50 border border-brand-200 rounded-xl space-y-3 dark:bg-brand-900/20 dark:border-brand-800">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-brand-800 dark:text-brand-300">Add a word</p>
                <button onClick={() => { setShowAddWord(false); setAddResult(null); setAddInput(""); setAddError(""); }}
                  className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300">
                  <X size={16} />
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={addInput}
                  onChange={(e) => setAddInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !addAnalyzing && handleAnalyzeWord()}
                  placeholder="Type a German word or phrase…"
                  className="flex-1 px-3 py-2 border border-brand-200 rounded-lg text-sm focus:outline-none focus:border-brand-400 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
                  autoFocus
                />
                <button
                  onClick={handleAnalyzeWord}
                  disabled={!addInput.trim() || addAnalyzing}
                  className="px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {addAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  Analyze
                </button>
              </div>
              {addError && <p className="text-xs text-red-500">{addError}</p>}
              {addResult && (
                <div className="bg-white border border-brand-200 rounded-lg p-3 space-y-2 dark:bg-slate-800 dark:border-brand-800">
                  <div className="flex items-center gap-2 flex-wrap">
                    {addResult.gender && addResult.gender !== "null" && (
                      <span className="text-slate-400 dark:text-slate-500 text-sm">{addResult.gender}</span>
                    )}
                    <span className="font-bold text-slate-800 dark:text-slate-100">{addResult.german}</span>
                    <LevelBadge level={addResult.cefr_level} />
                    <span className="text-xs text-slate-500 dark:text-slate-400">{addResult.word_type}</span>
                  </div>
                  <div className="space-y-1">
                    {langs.map((lang) => {
                      const t = addResult.translations?.[lang.code] || addResult[lang.code === "en" ? "english" : "persian"] || "";
                      return t ? (
                        <p key={lang.code} className="text-sm text-slate-600 dark:text-slate-300" dir={lang.rtl ? "rtl" : "ltr"}>
                          <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase">{lang.code}</span> {t}
                        </p>
                      ) : null;
                    })}
                  </div>
                  {addResult.example_de && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic">{addResult.example_de}</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleSaveAddedWord}
                      className="px-4 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700"
                    >
                      Save to vocabulary
                    </button>
                    <button
                      onClick={() => { setAddResult(null); setAddInput(""); }}
                      className="px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              )}
              {addSaved && <p className="text-xs text-emerald-600 font-medium">Saved!</p>}
            </div>
          )}

          {/* Search */}
          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search words, translations, examples…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex gap-3 mb-6 flex-wrap">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
            >
              <option value="all">All types</option>
              <option value="noun">Nouns</option>
              <option value="verb">Verbs</option>
              <option value="adjective">Adjectives</option>
              <option value="adverb">Adverbs</option>
              <option value="phrase">Phrases</option>
            </select>
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
            >
              <option value="all">All levels</option>
              {["A1","A2","B1","B2","C1","C2"].map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <span className="text-sm text-slate-400 dark:text-slate-500 self-center ml-auto">
              {filteredWords.length} words
            </span>
          </div>

          {/* Word list */}
          <div className="space-y-2">
            {filteredWords.map((word) => {
              const st = wordStatus(word);
              const expanded = expandedWordId === word.id;
              const hasExamples = word.example_de || word.example_en || word.example_fa;
              return (
                <div
                  key={word.id}
                  className="bg-white rounded-xl border border-slate-100 hover:border-slate-200 transition-colors dark:bg-slate-900 dark:border-slate-800 dark:hover:border-slate-700"
                >
                  <div
                    className="flex items-center px-4 py-3 gap-3 cursor-pointer select-none"
                    onClick={() => hasExamples && setExpandedWordId(expanded ? null : word.id)}
                  >
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${st.color}`} title={st.label} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {word.gender && word.gender !== "null" && (
                        <span className="text-slate-400 dark:text-slate-500 text-sm">{word.gender}</span>
                      )}
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{word.german}</span>
                      {word.word_type === "verb" && word.extra_info?.is_separable === true && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                          trennbar{word.extra_info.separable_prefix ? ` · ${word.extra_info.separable_prefix}-` : ""}
                        </span>
                      )}
                      {word.word_type === "verb" && word.extra_info?.is_separable === false && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700">
                          untrennbar
                        </span>
                      )}
                      {langs.map((lang) => {
                        const t = getTranslation(word, lang.code);
                        return t ? (
                          <span key={lang.code}>
                            <span className="text-slate-300 dark:text-slate-600">·</span>
                            <span className="text-slate-600 dark:text-slate-300 text-sm ml-1" dir={lang.rtl ? "rtl" : "ltr"}>{t}</span>
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <LevelBadge level={word.cefr_level} />
                    <span title={`Reviewed ${word.seen_count || 0} times`} className="text-xs text-slate-400 dark:text-slate-500 w-10 text-right">
                      ×{word.seen_count || 0}
                    </span>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map((i) => (
                        <span key={i} className={`w-1.5 h-1.5 rounded-full ${i <= (word.confidence || 0) ? "bg-brand-500" : "bg-slate-200 dark:bg-slate-700"}`} />
                      ))}
                    </div>
                    {word.confidence >= 4 && <Check size={13} className="text-emerald-500" />}
                    <button
                      onClick={(e) => { e.stopPropagation(); speakGerman(word.german); }}
                      className="p-1.5 rounded-lg text-slate-300 dark:text-slate-600 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
                      title="Listen"
                    >
                      <Volume2 size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(word.id); }}
                      className="p-1.5 rounded-lg text-slate-300 dark:text-slate-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Delete word"
                    >
                      <Trash2 size={14} />
                    </button>
                    {hasExamples && (
                      <ChevronDown size={14} className={`text-slate-300 dark:text-slate-600 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
                    )}
                  </div>
                  </div>

                  {/* Expandable examples */}
                  {expanded && hasExamples && (
                    <div className="px-5 pb-3 pt-0 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                      {word.example_de && (
                        <p className="text-sm text-slate-700 dark:text-slate-200 flex gap-2 items-start">
                          <span className="text-base leading-snug">🇩🇪</span>
                          <span className="italic">{word.example_de}</span>
                        </p>
                      )}
                      {word.example_en && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 pl-6">{word.example_en}</p>
                      )}
                      {word.example_fa && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 pl-6 text-right" dir="rtl">{word.example_fa}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {filteredWords.length === 0 && (
              <div className="text-center py-12 space-y-2">
                <p className="text-slate-400 dark:text-slate-500">No words found.</p>
                <button onClick={() => setMode("quiz")} className="text-sm text-brand-600 hover:underline">
                  Try the Quiz instead →
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
