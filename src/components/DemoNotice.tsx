import { Info } from 'lucide-react';
import { DEMO_NOTICE } from '@/data/demo/history';

export function DemoNotice() {
  return (
    <aside aria-label="Demo data notice" className="demo-notice">
      <Info className="h-7 w-7 shrink-0 sm:h-8 sm:w-8" aria-hidden="true" />
      <p lang="zh-CN">{DEMO_NOTICE}</p>
    </aside>
  );
}
