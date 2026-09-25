import { Suspense } from 'react';
import { HistoryView } from './HistoryView';

export default function Page() {
  return (
    <Suspense>
      <HistoryView />
    </Suspense>
  );
}
