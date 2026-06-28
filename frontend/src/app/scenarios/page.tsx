"use client";

import { useState, useEffect, useRef } from "react";
import { LevelBadge } from "@/src/components/layout/LevelBadge";
import { ConfirmLeaveDialog } from "@/src/components/layout/ConfirmLeaveDialog";
import { listScenarios, chatScenario, batchAnalyzeWords, saveWord, ttsSpeak, NetworkError } from "@/src/lib/api";
import { useAppStore } from "@/src/lib/store";
import { Send, Mic, MicOff, Volume2, ArrowLeft, BookmarkPlus, Loader2 } from "lucide-react";
import { clsx } from "clsx";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

function stripForTTS(text: string): string {
  return text
    .replace(/#{1,3}\s/g, "")
    .replace(/\*\*?|__|~~|`/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\u{FE00}-\u{FE0F}\u{1F3FB}-\u{1F3FF}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\n+/g, " ")
    .trim();
}

interface ChatVocabBtn {
  text: string;
  x: number;
  y: number;
}

export default function ScenariosPage() {
  const { userLevel, translationLanguages, hasPendingChat, setHasPendingChat } = useAppStore();
  const langs = translationLanguages.length > 0
    ? translationLanguages
    : [{ code: "en", name: "English", nativeName: "English", rtl: false }];

  const [scenarios, setScenarios] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");
  const [vocabBtn, setVocabBtn] = useState<ChatVocabBtn | null>(null);
  const [vocabSaving, setVocabSaving] = useState(false);
  const [vocabToast, setVocabToast] = useState("");
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [ttsLoading, setTtsLoading] = useState<string | null>(null);
  const [speakingContent, setSpeakingContent] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    listScenarios().then(setScenarios).finally(() => setLoading(false));
  }, []);

  // Track whether there's an active user conversation
  useEffect(() => {
    const active = selected != null && messages.some((m) => m.role === "user");
    setHasPendingChat(active);
  }, [messages, selected]);

  // Clear on unmount
  useEffect(() => {
    return () => setHasPendingChat(false);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Detect text selection within agent German text
  useEffect(() => {
    const onMouseUp = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) { setVocabBtn(null); return; }
      const text = sel.toString().trim();
      if (!text || text.length < 2) { setVocabBtn(null); return; }
      try {
        const range = sel.getRangeAt(0);
        const ancestor = range.commonAncestorContainer as Node;
        const el = (ancestor.nodeType === Node.TEXT_NODE ? ancestor.parentElement : ancestor as Element);
        if (!el?.closest(".agent-text")) { setVocabBtn(null); return; }
        const rect = range.getBoundingClientRect();
        setVocabBtn({ text, x: rect.left + rect.width / 2, y: rect.top });
      } catch {
        setVocabBtn(null);
      }
    };
    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, []);

  const saveVocabFromChat = async () => {
    if (!vocabBtn || vocabSaving) return;
    setVocabSaving(true);
    try {
      const results = await batchAnalyzeWords([vocabBtn.text], userLevel, translationLanguages);
      if (results[0]) await saveWord(results[0]);
      clearTimeout(toastTimer.current);
      setVocabToast(`"${vocabBtn.text}" saved!`);
      toastTimer.current = setTimeout(() => setVocabToast(""), 2500);
    } catch {
      // silent fail
    } finally {
      setVocabSaving(false);
      setVocabBtn(null);
      window.getSelection()?.removeAllRanges();
    }
  };

  const startScenario = (scenario: any) => {
    setSelected(scenario);
    setSessionId(null);
    const opening = scenario.opening_message || "Guten Tag!";
    setMessages([{
      role: "system",
      text: `You are now chatting with: ${scenario.persona}`,
      emoji: scenario.avatar_emoji,
    }, {
      role: "agent",
      text: `${scenario.avatar_emoji} ${opening}`,
    }]);
  };

  const stopAudio = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setSpeakingContent(null);
    setTtsLoading(null);
  };

  const handleSpeak = async (text: string) => {
    if (speakingContent === text || ttsLoading === text) { stopAudio(); return; }
    stopAudio();
    setTtsLoading(text);
    try {
      const blob = await ttsSpeak(stripForTTS(text), "de");
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); setSpeakingContent(null); audioRef.current = null; };
      audio.onerror = () => { URL.revokeObjectURL(url); setSpeakingContent(null); audioRef.current = null; };
      setTtsLoading(null);
      setSpeakingContent(text);
      await audio.play();
    } catch {
      setTtsLoading(null);
      setSpeakingContent(null);
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.lang = "de-DE";
    recognition.continuous = true;
    recognition.interimResults = false;
    let accumulated = "";
    recognition.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          accumulated += (accumulated ? " " : "") + e.results[i][0].transcript.trim();
        }
      }
      setInput(accumulated);
    };
    recognition.onend = () => setListening(false);
    recognition.start();
    setListening(true);
    recognitionRef.current = recognition;
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const sendMessage = async () => {
    if (!input.trim() || !selected || sending) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", text: userMsg }]);
    setSending(true);

    try {
      const res = await chatScenario(
        selected.id, userMsg, sessionId, userLevel, true,
        langs.map((l) => ({ code: l.code, name: l.name }))
      );
      setSessionId(res.session_id);

      setMessages((m) => [...m, {
        role: "agent",
        text: res.agent_response,
        response_translations: res.response_translations || {},
        correction: res.correction,
        correction_fa: res.correction_explanation_fa,
        correction_en: res.correction_explanation_en,
        vocab: res.vocabulary_used,
      }]);

      if (autoPlay) handleSpeak(res.agent_response);
    } catch (err) {
      const msg = err instanceof NetworkError
        ? "⚡ Connection issue — please try again when you're back online."
        : "Something went wrong on the AI side — please try again.";
      setMessages((m) => [...m, { role: "agent", text: msg }]);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!selected) {
    const subjects = ["all", ...Array.from(new Set(scenarios.map((s) => s.subject).filter(Boolean))).sort()];
    const types = ["all", "Informal", "Formal", "Professional"];

    const filtered = scenarios.filter((s) => {
      if (filterLevel !== "all" && s.cefr_level !== filterLevel) return false;
      if (filterType !== "all" && s.scenario_type !== filterType) return false;
      if (filterSubject !== "all" && s.subject !== filterSubject) return false;
      return true;
    });

    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">Scenarios</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Practice real German conversations with AI characters. Each scenario has a goal — complete it!
        </p>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6 items-center">
          <div className="flex gap-1 flex-wrap">
            {["all", ...LEVELS].map((l) => (
              <button
                key={l}
                onClick={() => setFilterLevel(l)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                  filterLevel === l
                    ? "bg-brand-600 text-white border-brand-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-brand-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                }`}
              >
                {l === "all" ? "All levels" : l}
              </button>
            ))}
          </div>
          <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 hidden sm:block" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
          >
            {types.map((t) => (
              <option key={t} value={t}>{t === "all" ? "All types" : t}</option>
            ))}
          </select>
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
          >
            {subjects.map((s) => (
              <option key={s} value={s}>{s === "all" ? "All subjects" : s}</option>
            ))}
          </select>
          <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">{filtered.length} scenarios</span>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <button
              key={s.id}
              onClick={() => startScenario(s)}
              className="text-left p-5 bg-white rounded-2xl border border-slate-200 hover:border-brand-300 hover:shadow-md transition-all group dark:bg-slate-900 dark:border-slate-700 dark:hover:border-brand-700"
            >
              <div className="text-3xl mb-3">{s.avatar_emoji}</div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">{s.name}</h3>
                <LevelBadge level={s.cefr_level} />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{s.description}</p>
              {(s.subject || s.scenario_type) && (
                <div className="flex gap-1.5 mb-2 flex-wrap">
                  {s.subject && (
                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full dark:bg-slate-800 dark:text-slate-400">{s.subject}</span>
                  )}
                  {s.scenario_type && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      s.scenario_type === "Professional" ? "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-300" :
                      s.scenario_type === "Formal" ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300" :
                      "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-300"
                    }`}>{s.scenario_type}</span>
                  )}
                </div>
              )}
              <p className="text-xs text-brand-600 font-medium">Goal: {s.goal}</p>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-3 text-center py-16 text-slate-400 dark:text-slate-500">
              No scenarios match these filters.
            </div>
          )}
        </div>
      </div>
    );
  }

  const goBack = () => {
    if (hasPendingChat) {
      setShowLeaveConfirm(true);
    } else {
      setSelected(null);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-w-3xl mx-auto">
      {showLeaveConfirm && (
        <ConfirmLeaveDialog
          onConfirm={() => { setHasPendingChat(false); setSelected(null); setShowLeaveConfirm(false); }}
          onCancel={() => setShowLeaveConfirm(false)}
        />
      )}
      {/* Floating vocab save button */}
      {vocabBtn && (
        <div
          className="fixed z-[70] pointer-events-auto"
          style={{ left: vocabBtn.x, top: vocabBtn.y - 46, transform: "translateX(-50%)" }}
        >
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={saveVocabFromChat}
            disabled={vocabSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-full shadow-lg hover:bg-emerald-700 active:scale-95 transition-all whitespace-nowrap disabled:opacity-70"
          >
            {vocabSaving ? <Loader2 size={11} className="animate-spin" /> : <BookmarkPlus size={11} />}
            Save &ldquo;{vocabBtn.text.length > 16 ? vocabBtn.text.slice(0, 16) + "…" : vocabBtn.text}&rdquo;
          </button>
          <div className="flex justify-center -mt-px">
            <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-emerald-600" />
          </div>
        </div>
      )}

      {/* Vocab toast */}
      {vocabToast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-xs px-4 py-2 rounded-full shadow-lg pointer-events-none">
          ✓ {vocabToast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <button onClick={goBack} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <ArrowLeft size={18} />
          </button>
          <span className="text-2xl">{selected.avatar_emoji}</span>
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-100">{selected.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{selected.persona}</p>
          </div>
          <LevelBadge level={selected.cefr_level} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoPlay((v) => !v)}
            title={autoPlay ? "Auto-play on — each response uses TTS API tokens" : "Auto-play off — click to enable"}
            className={clsx(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
              autoPlay
                ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            )}
          >
            <Volume2 size={13} />
            {autoPlay ? "Auto: ON" : "Auto"}
          </button>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
            Corrections on
          </span>
        </div>
      </div>

      {/* Goal banner */}
      <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-800 dark:bg-amber-900/20 dark:border-amber-900/40 dark:text-amber-300">
        <span className="font-semibold">Goal:</span> {selected.goal}
        <span className="ml-3 text-amber-600 italic">Highlight German words to save to vocabulary</span>
      </div>


      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg, i) => {
          if (msg.role === "system") {
            return (
              <div key={i} className="text-center">
                <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                  {msg.emoji} {msg.text}
                </span>
              </div>
            );
          }
          return (
            <div key={i} className={clsx("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div className={clsx(
                "max-w-sm rounded-2xl px-4 py-3 text-sm space-y-2",
                msg.role === "user"
                  ? "bg-brand-600 text-white rounded-br-sm"
                  : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
              )}>
                <div className="flex items-start gap-2">
                  <p className={clsx("whitespace-pre-wrap flex-1", msg.role === "agent" && "agent-text select-text")}>
                    {msg.text}
                  </p>
                  {msg.role === "agent" && (
                    <button
                      onClick={() => handleSpeak(msg.text)}
                      className={clsx(
                        "shrink-0 p-1 rounded-full transition-colors hover:bg-slate-100 dark:hover:bg-slate-700",
                        speakingContent === msg.text
                          ? "text-brand-500 dark:text-brand-400"
                          : "text-slate-400 dark:text-slate-500"
                      )}
                    >
                      {ttsLoading === msg.text
                        ? <Loader2 size={14} className="animate-spin" />
                        : speakingContent === msg.text
                          ? <Volume2 size={14} className="animate-pulse" />
                          : <Volume2 size={14} />}
                    </button>
                  )}
                </div>

                {/* Translation of agent response */}
                {msg.role === "agent" && msg.response_translations && Object.keys(msg.response_translations).length > 0 && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                    {langs.map((lang) => {
                      const t = msg.response_translations?.[lang.code];
                      return t ? (
                        <p key={lang.code} className="text-xs text-slate-400 dark:text-slate-500" dir={lang.rtl ? "rtl" : "ltr"}>
                          <span className="font-medium text-slate-500 dark:text-slate-400">{lang.nativeName}:</span> {t}
                        </p>
                      ) : null;
                    })}
                  </div>
                )}

                {msg.correction && (
                  <div className="pt-2 border-t border-red-100 dark:border-red-900/40">
                    <p className="text-xs font-semibold text-red-500">Correction:</p>
                    <p className="text-xs text-red-600 italic">{msg.correction}</p>
                    {msg.correction_en && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{msg.correction_en}</p>}
                    {msg.correction_fa && <p className="text-xs text-slate-500 dark:text-slate-400 rtl text-right">{msg.correction_fa}</p>}
                  </div>
                )}

                {msg.vocab && msg.vocab.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {msg.vocab.map((v: string, vi: number) => (
                      <span key={vi} className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full border border-brand-100 dark:bg-brand-900/20 dark:text-brand-300 dark:border-brand-900/40">
                        {v}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm dark:bg-slate-800 dark:border-slate-700">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700">
        <div className="flex gap-2">
          <button
            onClick={listening ? stopListening : startListening}
            className={clsx(
              "p-2.5 rounded-xl transition-colors",
              listening ? "bg-red-500 text-white animate-pulse" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            )}
          >
            {listening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Schreib auf Deutsch... (or use mic)"
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-brand-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100 dark:placeholder-slate-500"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="p-2.5 bg-brand-600 text-white rounded-xl hover:bg-brand-700 disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
