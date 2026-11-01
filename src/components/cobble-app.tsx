import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Box,
  Mountain,
  Pause,
  Pickaxe,
  Play,
  Volume2,
  VolumeX,
  Wind,
} from "lucide-react";
import { HOTBAR, BLOCKS } from "@/game/blocks";
import type { Analog, Engine, HudState } from "@/game/engine";
import { loadSave } from "@/game/save";

const ZERO: Analog = {
  x: 0,
  y: 0,
  jump: false,
  down: false,
  sprint: false,
  breaking: false,
  placing: false,
};

export function CobbleApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const analogRef = useRef<Analog>({ ...ZERO });
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<"menu" | "play" | "pause">("menu");
  const [hasSave, setHasSave] = useState(false);
  const [live, setLive] = useState(false);
  const [hud, setHud] = useState<HudState | null>(null);
  const [locked, setLocked] = useState(false);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const hudSink = useRef<(h: HudState) => void>(() => {});
  hudSink.current = setHud;

  useEffect(() => {
    setHasSave(!!loadSave());
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dead = false;
    let eng: Engine | null = null;
    void import("@/game/engine").then(({ Engine: E }) => {
      if (dead) return;
      eng = new E(canvas, () => analogRef.current, (h) => hudSink.current(h));
      engineRef.current = eng;
      setReady(true);
    });
    return () => {
      dead = true;
      eng?.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Escape" || e.repeat) return;
      const eng = engineRef.current;
      if (!eng) return;
      if (phaseRef.current === "play") {
        eng.pause();
        setPhase("pause");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onLock = () => setLocked(document.pointerLockElement === canvasRef.current);
    document.addEventListener("pointerlockchange", onLock);
    return () => document.removeEventListener("pointerlockchange", onLock);
  }, []);

  function patch(p: Partial<Analog>) {
    analogRef.current = { ...analogRef.current, ...p };
  }

  function startNew() {
    const eng = engineRef.current;
    if (!eng) return;
    eng.unlock();
    eng.beginNew();
    setLive(true);
    setHasSave(true);
    setPhase("play");
    eng.requestLock();
  }

  function continueSave() {
    const eng = engineRef.current;
    const save = loadSave();
    if (!eng || !save) return;
    eng.unlock();
    eng.beginContinue(save);
    setLive(true);
    setPhase("play");
    eng.requestLock();
  }

  function resume() {
    engineRef.current?.resume();
    setPhase("play");
  }

  function toMenu() {
    engineRef.current?.toMenu();
    setPhase("menu");
    setHasSave(!!loadSave());
  }

  const playing = phase === "play";

  return (
    <main className="game-root">
      <canvas ref={canvasRef} aria-label="Cobble world" />
      <div className="overlay">
        {playing && (
          <div className="pointer-events-none absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
            <div className="crosshair" style={{ opacity: 0.85 + (hud?.breakProgress ?? 0) * 0.15 }} />
            {hud?.aimed && (
              <p className="mt-6 rounded-full bg-ink/70 px-2.5 py-0.5 text-xs text-paper">{hud.aimed}</p>
            )}
            {(hud?.breakProgress ?? 0) > 0 && (
              <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-ink/70">
                <div className="h-full bg-gold" style={{ width: `${(hud?.breakProgress ?? 0) * 100}%` }} />
              </div>
            )}
          </div>
        )}

        {playing && !locked && (
          <button
            type="button"
            className="fine-only btn btn-ink absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-10"
            onClick={() => engineRef.current?.requestLock()}
          >
            Click to look
          </button>
        )}

        <div className="top-hud pointer-events-none absolute inset-x-0 flex items-start justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="pointer-events-auto flex items-center gap-2">
            {playing || phase === "pause" ? (
              <button
                type="button"
                className="btn btn-ink h-11 w-11 rounded-full p-0"
                aria-label="Pause"
                onClick={() => {
                  if (phase === "play") {
                    engineRef.current?.pause();
                    setPhase("pause");
                  } else resume();
                }}
              >
                {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
              </button>
            ) : null}
            {hud && playing && (
              <p className="rounded-full bg-ink/70 px-3 py-1.5 text-xs text-paper">
                {hud.x} {hud.y} {hud.z}
                {hud.flying ? " · flying" : ""}
              </p>
            )}
          </div>
          {playing && (
            <button
              type="button"
              className="btn btn-ink pointer-events-auto h-11 w-11 rounded-full p-0"
              aria-label={hud?.muted ? "Unmute" : "Mute"}
              onClick={() => engineRef.current?.toggleMute()}
            >
              {hud?.muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
            </button>
          )}
        </div>

        {playing && (
          <div className="hotbar-wrap absolute bottom-5 left-1/2 -translate-x-1/2 pb-[env(safe-area-inset-bottom)]">
            <div className="hotbar" role="toolbar" aria-label="Blocks">
              {HOTBAR.map((id, i) => (
                <button
                  key={id}
                  type="button"
                  className="slot"
                  data-on={hud?.slot === i}
                  aria-label={BLOCKS[id].name}
                  aria-pressed={hud?.slot === i}
                  onClick={() => engineRef.current?.setSlot(i)}
                >
                  <span>{i + 1}</span>
                  <i className="swatch" data-block={BLOCKS[id].swatch} />
                </button>
              ))}
            </div>
            <p className="hotbar-name mt-1 text-center text-xs text-paper drop-shadow">{hud?.held}</p>
          </div>
        )}

        <div className="touch-only touch-stick absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] flex-col gap-3">
          {playing && <Stick knob={knob} setKnob={setKnob} onChange={(x, y) => patch({ x, y })} />}
        </div>

        <div className="touch-only touch-actions absolute right-[max(0.75rem,env(safe-area-inset-right))] bottom-[max(0.75rem,env(safe-area-inset-bottom))] flex-col items-end gap-2">
          {playing && (
            <>
              <Hold
                label="Run"
                onHold={(v) => patch({ sprint: v })}
              >
                <Wind className="size-5" />
              </Hold>
              {hud?.flying && (
                <Hold label="Down" onHold={(v) => patch({ down: v })}>
                  <ArrowDown className="size-5" />
                </Hold>
              )}
              <Hold label="Jump" onHold={(v) => patch({ jump: v })}>
                <ArrowUp className="size-5" />
              </Hold>
              <Hold label="Place" onHold={(v) => patch({ placing: v })}>
                <Box className="size-5" />
              </Hold>
              <Hold label="Mine" onHold={(v) => patch({ breaking: v })}>
                <Pickaxe className="size-5" />
              </Hold>
            </>
          )}
        </div>

        {phase === "menu" && (
          <section className="menu-card card pointer-events-auto absolute inset-x-4 bottom-4 p-5 md:inset-auto md:top-1/2 md:bottom-auto md:left-10 md:w-[24rem] md:-translate-y-1/2 md:p-7">
            <p className="text-xs font-medium tracking-[0.22em] text-bark uppercase">Block world</p>
            <h1 className="font-display mt-1 text-5xl leading-none font-medium text-ink">Cobble</h1>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-soil">
              Mine the hills, stack a shelter, and wander until the light goes. Your changes stay on this device.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" className="btn btn-gold" onClick={startNew} disabled={!ready}>
                <Play className="size-4" />
                Start
              </button>
              {live ? (
                <button type="button" className="btn btn-ghost" onClick={resume}>
                  Resume
                </button>
              ) : hasSave ? (
                <button type="button" className="btn btn-ghost" onClick={continueSave} disabled={!ready}>
                  Continue
                </button>
              ) : null}
            </div>
            <ul className="fine-only mt-5 space-y-1 text-xs leading-relaxed text-soil">
              <li>WASD move · mouse look · click mine · right-click place</li>
              <li>Space jump · 1–9 or scroll blocks · F fly · Esc pause</li>
            </ul>
            <ul className="touch-only mt-5 list-none flex-col gap-1 text-xs leading-relaxed text-soil">
              <li>Drag the world to look. Stick moves you.</li>
              <li>Sideways works too: stick on the left, mine and place on the right.</li>
            </ul>
            {!ready && <p className="mt-3 text-xs text-muted">Raising the hills…</p>}
          </section>
        )}

        {phase === "pause" && (
          <section className="pause-card card pointer-events-auto absolute top-1/2 left-1/2 w-[min(22rem,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 p-6">
            <h2 className="font-display text-3xl text-ink">Paused</h2>
            <p className="mt-1 text-sm text-soil">Seed {hud?.seed ?? "—"}</p>
            <div className="mt-5 flex flex-col gap-2">
              <button type="button" className="btn btn-gold" onClick={resume}>
                <Play className="size-4" />
                Resume
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => engineRef.current?.toggleFly()}>
                <Mountain className="size-4" />
                {hud?.flying ? "Stop flying" : "Fly"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={toMenu}>
                Save & menu
              </button>
              <button type="button" className="btn btn-ghost" onClick={startNew}>
                New world
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Stick({
  knob,
  setKnob,
  onChange,
}: {
  knob: { x: number; y: number };
  setKnob: (k: { x: number; y: number }) => void;
  onChange: (x: number, y: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const origin = useRef({ x: 0, y: 0 });

  function down(e: PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function move(e: PointerEvent<HTMLDivElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const dx = e.clientX - origin.current.x;
    const dy = e.clientY - origin.current.y;
    const max = 46;
    const mag = Math.hypot(dx, dy) || 1;
    const cl = Math.min(mag, max);
    const x = (dx / mag) * cl;
    const y = (dy / mag) * cl;
    setKnob({ x, y });
    onChange(x / max, -y / max);
  }

  function up() {
    setKnob({ x: 0, y: 0 });
    onChange(0, 0);
  }

  return (
    <div
      ref={ref}
      className="stick"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      role="slider"
      aria-label="Move"
      aria-valuemin={-1}
      aria-valuemax={1}
      aria-valuenow={0}
    >
      <div className="knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}

function Hold({
  label,
  onHold,
  children,
}: {
  label: string;
  onHold: (down: boolean) => void;
  children: ReactNode;
}) {
  function down(e: PointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    onHold(true);
  }
  function up() {
    onHold(false);
  }
  return (
    <button
      type="button"
      className="btn btn-ink h-14 min-w-14 gap-1 px-3"
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={label}
    >
      {children}
              <span className="hold-label text-xs">{label}</span>
    </button>
  );
}
