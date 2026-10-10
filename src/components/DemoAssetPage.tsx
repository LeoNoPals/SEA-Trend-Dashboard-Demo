import { useEffect, useRef, useState } from 'react';
import { Maximize, Pause, Play, RotateCcw } from 'lucide-react';
import { demoMaterials, demoProducts } from '@/data/demo/assets';
import { DEMO_NOTICE } from '@/data/demo/history';
import type { TopMaterial } from '@/data/topMaterial';
import { formatPrice } from '@/data/topProduct';
import { MaterialMetrics } from './TopMaterialModule';
import { DemoImage } from './DemoImage';
import { DemoNotice } from './DemoNotice';

function DemoPlayer({ material }: { material: TopMaterial }) {
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [fullscreenError, setFullscreenError] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const duration = material.duration;

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && window.parent !== window) {
        window.parent.postMessage('demo-player-close', window.location.origin);
      }
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const delta = Math.min(0.2, (now - previous) / 1000);
      previous = now;
      setTime(value => Math.min(duration, value + delta));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, duration]);

  useEffect(() => {
    if (time >= duration) setPlaying(false);
  }, [time, duration]);

  const toggle = () => {
    if (time >= duration) setTime(0);
    setPlaying(value => !value);
  };
  const caption = time < 4
    ? 'Product overview'
    : time < 8
      ? 'Material and detail'
      : 'Lifestyle concept';

  return (
    <div ref={root} className="demo-player flex h-full min-h-[320px] w-full flex-col bg-card text-fg-1">
      <div className="relative min-h-0 flex-1 overflow-hidden bg-inset">
        <DemoImage
          src={material.image}
          alt={`${material.name} AI illustration`}
          loading="eager"
          className="h-full w-full"
          imageClassName="object-cover"
          style={{
            transform: `scale(${1 + Math.sin(time / duration * Math.PI) * 0.17}) translateY(${Math.sin(time * 0.6) * 5}px)`,
          }}
        />
        <span className="absolute left-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs text-white">
          AI illustration · Local demo animation
        </span>
        <div className="absolute inset-x-0 bottom-0 bg-black/70 px-4 py-3 text-center text-white">
          <p className="text-sm font-semibold">{caption}</p>
          <p className="mt-1 text-xs">Fictional item and simulated playback</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-2 p-3">
        <input
          type="range"
          min={0}
          max={duration}
          step={0.1}
          value={time}
          onChange={event => setTime(Number(event.target.value))}
          aria-label="Demo playback progress"
          className="range-accent w-full"
        />
        <div className="flex items-center gap-3">
          <button type="button" className="demo-icon-button" aria-label={playing ? 'Pause demo' : 'Play demo'} onClick={toggle}>
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button type="button" className="demo-icon-button" aria-label="Replay demo" onClick={() => { setTime(0); setPlaying(true); }}>
            <RotateCcw size={16} />
          </button>
          <output aria-label="Playback time" className="flex-1 text-xs tabular-nums">
            {time.toFixed(1)} / {duration}s
          </output>
          <button
            type="button"
            className="demo-icon-button"
            aria-label="Fullscreen preview"
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen();
              else if (root.current?.requestFullscreen) void root.current.requestFullscreen().catch(() => setFullscreenError(true));
              else setFullscreenError(true);
            }}
          >
            <Maximize size={16} />
          </button>
        </div>
        <p lang="zh-CN" className="text-[13px] font-semibold text-info-fg">{DEMO_NOTICE}</p>
        {fullscreenError && <p role="status" className="text-xs text-fg-4">Fullscreen is unavailable in this browser.</p>}
      </div>
    </div>
  );
}

export function DemoAssetPage({ query }: { query: URLSearchParams }) {
  const product = demoProducts.find(item => item.productId === query.get('demoProduct'));
  const material = demoMaterials.find(item => item.vid === (query.get('demoPlayer') ?? query.get('demoMaterial')));
  if (query.has('demoPlayer') && material) {
    return <div className="h-dvh"><DemoPlayer material={material} /></div>;
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-[980px] flex-col gap-5 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-fg">{product ? 'Demo product details' : 'Demo creative details'}</h1>
        <a className="rounded-full border border-line-5 px-4 py-2 text-sm text-fg-2" href={import.meta.env.BASE_URL}>Back to dashboard</a>
      </div>
      <DemoNotice />
      {product ? (
        <article className="grid gap-6 rounded-xl border border-line-3 bg-card p-5 md:grid-cols-2">
          <DemoImage src={product.image} alt={product.name} loading="eager" className="aspect-square w-full rounded-xl" />
          <div className="flex flex-col justify-center gap-4">
            <p className="text-sm text-fg-4">{product.country} · {product.l1} › {product.l2} › {product.l3}</p>
            <h2 className="text-xl font-semibold text-fg">{product.name}</h2>
            <p className="text-2xl font-bold text-accent-text">{formatPrice(product.price)} <span className="text-xs font-normal">Demo price</span></p>
            <p className="text-sm leading-relaxed text-fg-4">AI-generated illustrative image. All item names, categories, prices and market assignments are fictional.</p>
            <div className="flex gap-2 text-xs text-fg-2">{product.fresh && <span>New</span>}{product.bundle && <span>Bundle</span>}</div>
          </div>
        </article>
      ) : material ? (
        <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_300px]">
          <div className="h-[min(75dvh,680px)] overflow-hidden rounded-xl border border-line-3">
            <DemoPlayer material={material} />
          </div>
          <article className="rounded-xl border border-line-3 bg-card p-5">
            <h2 className="mb-3 font-semibold text-fg">{material.name}</h2>
            <p className="mb-4 text-xs text-fg-4">{material.country} · {material.l1} › {material.l2} › {material.l3}</p>
            <MaterialMetrics material={material} />
            <p className="mt-4 text-xs text-fg-4">AI-generated illustration, local animation and fictional performance metrics.</p>
          </article>
        </div>
      ) : <p className="text-fg-3">This demo item was not found. Return to the dashboard to choose another.</p>}
    </main>
  );
}
