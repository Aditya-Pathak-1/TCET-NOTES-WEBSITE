import { useState } from 'react';
import type { Flashcard } from '../types';

interface FlashcardDeckProps {
  flashcards: Flashcard[];
  /** If true, renders compact "preview" mode (no keyboard nav labels) */
  compact?: boolean;
}

export default function FlashcardDeck({ flashcards, compact }: FlashcardDeckProps) {
  const [index, setIndex]   = useState(0);
  const [flipped, setFlip]  = useState(false);
  const [shuffled, setShuf] = useState(false);
  const [deck, setDeck]     = useState(flashcards);

  if (!flashcards.length) return null;

  const card   = deck[index];
  const total  = deck.length;
  const progress = ((index + 1) / total) * 100;

  const next = () => { setIndex(i => (i + 1) % total); setFlip(false); };
  const prev = () => { setIndex(i => (i - 1 + total) % total); setFlip(false); };

  const shuffle = () => {
    const copy = [...deck].sort(() => Math.random() - 0.5);
    setDeck(copy);
    setIndex(0);
    setFlip(false);
    setShuf(true);
  };
  const unshuffle = () => { setDeck(flashcards); setIndex(0); setFlip(false); setShuf(false); };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-2xl mx-auto select-none">
      {/* Progress bar */}
      <div className="w-full flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
          {index + 1} / {total}
        </span>
      </div>

      {/* Flashcard flip container */}
      <div
        className="perspective-1000 w-full cursor-pointer"
        style={{ height: compact ? 180 : 260 }}
        onClick={() => setFlip(f => !f)}
        title="Click to flip"
      >
        <div
          className={`relative w-full h-full transform-3d transition-transform duration-500
            ${flipped ? 'rotate-y-180' : ''}`}
        >
          {/* Front — Question */}
          <div className="absolute inset-0 card flex flex-col items-center justify-center p-6 backface-hidden">
            <span className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-4">
              Question
            </span>
            <p className="text-center text-slate-800 font-medium leading-relaxed text-lg">
              {card.question}
            </p>
            {!compact && (
              <p className="text-xs text-slate-400 mt-4">Click to reveal answer →</p>
            )}
          </div>

          {/* Back — Answer */}
          <div
            className="absolute inset-0 card flex flex-col items-center justify-center p-6
              backface-hidden rotate-y-180"
            style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #ede9fe 100%)' }}
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-4">
              Answer
            </span>
            <p className="text-center text-slate-800 font-medium leading-relaxed text-lg">
              {card.answer}
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button className="btn-secondary btn-sm" onClick={prev} disabled={total <= 1}>← Prev</button>

        <button
          className={`btn-sm ${shuffled ? 'btn-primary' : 'btn-ghost'}`}
          onClick={shuffled ? unshuffle : shuffle}
          title={shuffled ? 'Restore order' : 'Shuffle deck'}
        >
          🔀 {shuffled ? 'Unshuffle' : 'Shuffle'}
        </button>

        <button className="btn-secondary btn-sm" onClick={next} disabled={total <= 1}>Next →</button>
      </div>

      {!compact && (
        <p className="text-xs text-slate-400">
          Space to flip · ← → to navigate
        </p>
      )}
    </div>
  );
}
