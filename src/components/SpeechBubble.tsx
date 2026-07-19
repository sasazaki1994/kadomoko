import { usePetStore } from '../store/usePetStore';

export default function SpeechBubble() {
  const bubble = usePetStore((s) => s.bubble);
  if (!bubble) return null;
  return (
    <div className="speech-bubble" key={bubble.id} role="status" aria-live="polite" aria-atomic="true">
      {bubble.text}
    </div>
  );
}
