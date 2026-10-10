import { useEffect, useRef } from 'react';

/** Keep keyboard focus in the open overlay and restore it on close. */
export function useModalDialog(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || !ref.current) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusables = () => [...(ref.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]),a[href],input,select,[tabindex="0"],iframe',
    ) ?? [])].filter(el => el.getClientRects().length > 0);
    const controls = focusables();
    // Overlay backdrops precede the content; prefer the content's close control.
    (controls.find(el => el.title.includes('Esc')) ?? controls[1] ?? controls[0])?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = focusables();
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', trap);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open]);
  return ref;
}
