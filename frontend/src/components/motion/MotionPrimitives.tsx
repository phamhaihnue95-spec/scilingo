import { useEffect, useState, type ReactNode } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "framer-motion";
import { Atom, Dna, FlaskConical, Sparkles, Volume2, Zap } from "lucide-react";

import { playFlipSound } from "../../utils/soundFx";
import { speakEnglishTerm } from "../../utils/speech";

const AMBIENT_SPECS = [
  { Icon: Atom, pos: "left-[6%] top-4", dur: 7.5, delay: 0, size: "h-7 w-7", rot: 14 },
  { Icon: FlaskConical, pos: "left-[28%] bottom-3", dur: 8.2, delay: 0.8, size: "h-6 w-6", rot: -12 },
  { Icon: Dna, pos: "right-[28%] top-3", dur: 9.0, delay: 0.4, size: "h-7 w-7", rot: 16 },
  { Icon: Zap, pos: "right-[8%] bottom-4", dur: 6.8, delay: 1.1, size: "h-6 w-6", rot: -10 },
  { Icon: Sparkles, pos: "left-[54%] top-5", dur: 7.2, delay: 0.6, size: "h-5 w-5", rot: 20 },
];

export function ScienceAmbientParticles() {
  const reduced = useReducedMotion();
  if (reduced) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden text-white/20"
    >
      {AMBIENT_SPECS.map((item, idx) => {
        const Icon = item.Icon;
        return (
          <motion.div
            key={idx}
            className={`absolute ${item.pos}`}
            animate={{
              y: [0, -10, 4, 0],
              x: [0, 6, -4, 0],
              rotate: [-item.rot, item.rot, -item.rot],
            }}
            transition={{
              duration: item.dur,
              delay: item.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <Icon className={item.size} />
          </motion.div>
        );
      })}
    </div>
  );
}

interface Tilt3DCardProps {
  children: ReactNode;
  className?: string;
  holographic?: boolean;
}

export function Tilt3DCard({ children, className = "", holographic = false }: Tilt3DCardProps) {
  const reduced = useReducedMotion();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const rotateX = useSpring(rawX, { stiffness: 280, damping: 24 });
  const rotateY = useSpring(rawY, { stiffness: 280, damping: 24 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduced) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    rawX.set(-py * 12);
    rawY.set(px * 12);
  };

  const handleMouseLeave = () => {
    rawX.set(0);
    rawY.set(0);
  };

  return (
    <div className="perspective-1200">
      <motion.div
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={reduced ? undefined : { rotateX, rotateY, transformStyle: "preserve-3d" }}
        className={`${holographic ? "holo-card" : ""} ${className}`}
      >
        {children}
      </motion.div>
    </div>
  );
}

interface FlipCard3DProps {
  flipped: boolean;
  onToggle: () => void;
  front: ReactNode;
  back: ReactNode;
  frontClassName?: string;
  backClassName?: string;
  minHeightClass?: string;
}

export function FlipCard3D({
  flipped,
  onToggle,
  front,
  back,
  frontClassName = "border-2 border-indigo-200 bg-gradient-to-br from-white via-sky-50/70 to-indigo-50/70 text-slate-900 shadow-md hover:border-indigo-400",
  backClassName = "bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 text-white shadow-lg",
  minHeightClass = "min-h-[260px]",
}: FlipCard3DProps) {
  const reduced = useReducedMotion();

  const handleClick = () => {
    playFlipSound();
    onToggle();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      className="perspective-1200 cursor-pointer select-none focus:outline-none"
    >
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={
          reduced ? { duration: 0.01 } : { type: "spring", stiffness: 260, damping: 22 }
        }
        className="preserve-3d grid"
      >
        <div
          className={`col-start-1 row-start-1 backface-hidden rounded-3xl p-6 sm:p-8 ${minHeightClass} ${frontClassName}`}
          style={{ transform: "rotateY(0deg)" }}
        >
          {front}
        </div>
        <div
          className={`col-start-1 row-start-1 backface-hidden holo-card rounded-3xl p-6 sm:p-8 ${minHeightClass} ${backClassName}`}
          style={{ transform: "rotateY(180deg)" }}
        >
          {back}
        </div>
      </motion.div>
    </div>
  );
}

interface FloatingXPBurstProps {
  burstKey: number;
  text: string;
  subtext?: string;
  className?: string;
}

export function FloatingXPBurst({
  burstKey,
  text,
  subtext,
  className = "right-4 top-2",
}: FloatingXPBurstProps) {
  const reduced = useReducedMotion();

  return (
    <div className={`pointer-events-none absolute z-30 ${className}`}>
      <AnimatePresence mode="popLayout">
        {burstKey > 0 && (
          <motion.div
            key={burstKey}
            initial={reduced ? { opacity: 1 } : { opacity: 0, y: 12, scale: 0.8 }}
            animate={
              reduced
                ? { opacity: 0 }
                : { opacity: [0, 1, 1, 0], y: [12, -16, -34, -48], scale: [0.85, 1.08, 1, 0.95] }
            }
            transition={{ duration: 1.15, ease: "easeOut" }}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-fuchsia-600 px-3.5 py-1.5 text-xs font-extrabold text-white shadow-lg ring-2 ring-white/80"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-100" />
            <span>{text}</span>
            {subtext && (
              <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[10px]">
                {subtext}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface SpeakButtonProps {
  termEn: string;
  audioUrl?: string | null;
  label?: string;
  className?: string;
  title?: string;
  stopPropagation?: boolean;
}

export function SpeakButton({
  termEn,
  audioUrl,
  label,
  className = "",
  title,
  stopPropagation = true,
}: SpeakButtonProps) {
  const [speaking, setSpeaking] = useState(false);

  const handleSpeak = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (stopPropagation) e.stopPropagation();
    speakEnglishTerm(termEn, audioUrl, {
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
    });
  };

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.93 }}
      onClick={handleSpeak}
      title={title ?? `Phát âm: ${termEn}`}
      className={`inline-flex items-center justify-center gap-1.5 transition ${
        label
          ? "btn-tactile rounded-full px-4 py-1.5 text-xs font-bold shadow-sm"
          : "h-9 w-9 rounded-full"
      } ${
        speaking
          ? "bg-gradient-to-r from-indigo-600 to-sky-500 text-white shadow-md ring-2 ring-sky-300"
          : "bg-sky-100 text-sky-700 hover:bg-indigo-600 hover:text-white"
      } ${className}`}
    >
      {speaking ? (
        <span aria-hidden="true" className="inline-flex h-4 items-end gap-[2.5px]">
          <span className="sound-wave-bar" />
          <span className="sound-wave-bar" />
          <span className="sound-wave-bar" />
        </span>
      ) : (
        <Volume2 className="h-4 w-4" />
      )}
      {label && <span>{speaking ? "Đang đọc..." : label}</span>}
    </motion.button>
  );
}

interface AnimatedScoreCounterProps {
  value: number;
  decimals?: number;
  className?: string;
}

export function AnimatedScoreCounter({
  value,
  decimals = 2,
  className = "",
}: AnimatedScoreCounterProps) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState<string>(() =>
    Number.isInteger(value) ? String(value) : value.toFixed(decimals)
  );

  useEffect(() => {
    const format = (num: number) =>
      Number.isInteger(value)
        ? String(Math.round(num))
        : Number(num.toFixed(decimals)).toString();

    if (reduced) {
      setDisplay(format(value));
      return;
    }

    const controls = animate(0, value, {
      duration: 0.7,
      ease: "easeOut",
      onUpdate: (latest) => setDisplay(format(latest)),
      onComplete: () => setDisplay(format(value)),
    });
    return () => controls.stop();
  }, [value, decimals, reduced]);

  return <span className={className}>{display}</span>;
}

export function PageTransitionWrapper({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? undefined : { opacity: 0, y: -8 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
