import { Suspense } from 'react';
import RetornoPagamento from '@/components/pagamento/RetornoPagamento';

export default function PagamentoPendentePage() {
  return (
    <Suspense fallback={null}>
      <RetornoPagamento />
    </Suspense>
  );
}
