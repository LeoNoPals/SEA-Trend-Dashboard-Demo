import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/** AI illustration with a truthful loading state and optional fallback. */
export function DemoImage({
  src, fallbackSrc, alt, className, imageClassName, loading = 'lazy', style,
}: {
  src: string;
  fallbackSrc?: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  loading?: 'lazy' | 'eager';
  style?: React.CSSProperties;
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'pending' | 'error'>('loading');
  const [currentSrc, setCurrentSrc] = useState(src);
  useEffect(() => { setCurrentSrc(src); setStatus('loading'); }, [src]);
  return (
    <span className={cn('relative block overflow-hidden', className)}>
      <img
        src={currentSrc || undefined}
        alt={alt}
        loading={loading}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={event => {
          const image = event.currentTarget;
          setStatus(image.naturalWidth === 1832 && image.naturalHeight === 1832 ? 'pending' : 'ready');
        }}
        onError={() => {
          if (fallbackSrc && currentSrc !== fallbackSrc) setCurrentSrc(fallbackSrc);
          else setStatus('error');
        }}
        data-demo-image-state={status}
        aria-hidden={status !== 'ready'}
        className={cn('h-full w-full object-contain', status !== 'ready' && 'opacity-0', imageClassName)}
        style={style}
      />
      {status !== 'ready' && (
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-inset px-3 text-center text-fg-4">
          <span className="text-xs font-medium">
            {status === 'error' || !src
              ? 'AI image unavailable'
              : status === 'pending'
                ? 'AI image is being generated'
                : 'Loading AI image…'}
          </span>
          <span className="text-[10px] leading-relaxed">Preview and filters remain available</span>
        </span>
      )}
    </span>
  );
}
