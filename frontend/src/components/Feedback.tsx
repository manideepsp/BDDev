'use client';
import { useState } from 'react';
import { submitFeedback, FeedbackRequest } from '@/lib/api';

interface FeedbackProps {
  outputType: string;
  pipelineId?: string;
  prospectId?: string;
  outputId?: string;
  label?: string;
}

export default function Feedback({ outputType, pipelineId, prospectId, outputId, label }: FeedbackProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);

  async function send(value: number, withNote?: string) {
    const payload: FeedbackRequest = {
      output_type: outputType,
      pipeline_id: pipelineId,
      prospect_id: prospectId,
      output_id: outputId,
      rating: value,
      note: withNote,
    };
    try {
      await submitFeedback(payload);
      // Only reflect the rating once the backend has actually stored it,
      // so the UI never shows feedback that wasn't saved.
      setRating(value);
      setShowNote(false);
      setSaved(true);
    } catch {
      /* non-blocking — feedback is best-effort */
    }
  }

  return (
    <div className="flex items-center gap-2 text-xs text-slate-400">
      {label && <span className="mr-1">{label}</span>}
      <button
        onClick={() => send(5)}
        className={`px-2 py-1 rounded-md border transition-colors ${
          rating === 5 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'border-slate-200 hover:border-emerald-300'
        }`}
        aria-label="Thumbs up"
      >
        👍
      </button>
      <button
        onClick={() => setShowNote(true)}
        className={`px-2 py-1 rounded-md border transition-colors ${
          rating === 1 ? 'bg-red-100 text-red-700 border-red-200' : 'border-slate-200 hover:border-red-300'
        }`}
        aria-label="Thumbs down"
      >
        👎
      </button>
      {saved && !showNote && <span className="text-emerald-600">✓ Thanks</span>}
      {showNote && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="What was off? (optional)"
            className="border border-slate-200 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 w-48"
          />
          <button
            onClick={() => { send(1, note); setShowNote(false); }}
            className="text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
