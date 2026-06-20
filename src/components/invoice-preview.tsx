'use client';
import { forwardRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Invoice } from '@/lib/types';
import { EMITTER_DATA, INVOICE_PREVIEW_WIDTH } from '@/lib/constants';
import { formatCurrency, formatSignedAdjustment, getAdjustmentKind } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface InvoicePreviewProps {
  invoice: Invoice;
  logo: string | null;
}

export const InvoicePreview = forwardRef<HTMLDivElement, InvoicePreviewProps>(({ invoice, logo }, ref) => {
  const subtotal = invoice.items.reduce((sum, item) => sum + (item.total || 0), 0);
  const deliveryFee = invoice.deliveryFee || 0;
  const adjustment = invoice.adjustment || 0;
  const total = subtotal + deliveryFee + adjustment;

  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return 'Data Inválida';
      return format(new Date(`${dateString}T00:00:00`), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch {
      return 'Data Inválida';
    }
  };

  const emitter =
    invoice.showEmitter && invoice.emitterDocumentType
      ? EMITTER_DATA[invoice.emitterDocumentType]
      : null;

  return (
    <Card
      ref={ref}
      className="invoice-preview bg-white text-black font-sans shadow-lg shrink-0"
      style={{
        width: `${INVOICE_PREVIEW_WIDTH}px`,
        minWidth: `${INVOICE_PREVIEW_WIDTH}px`,
        maxWidth: `${INVOICE_PREVIEW_WIDTH}px`,
        padding: '24px',
        boxSizing: 'border-box',
      }}
    >
      <CardContent className="p-0">
        <header className="flex flex-row justify-between items-start gap-3 pb-6">
          <div className="shrink-0">
            {logo ? (
              <div className="w-28 h-28 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logo} alt="Logo" className="max-w-full max-h-full object-contain" />
              </div>
            ) : (
              <div className="w-28 h-28 bg-gray-100 rounded flex items-center justify-center">
                <span className="text-xs text-gray-500">Logo</span>
              </div>
            )}
          </div>

          <div className="text-right flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-blue-600">Nota de pagamento</h1>
            <p className="text-xs text-gray-500 mt-1 break-all">Ref: {invoice.invoiceNumber}</p>
            {emitter && (
              <>
                <p className="text-base font-cursive text-gray-700 mt-1 break-words">
                  {emitter.name}
                </p>
                <p className="text-sm text-gray-500">
                  {emitter.label}: {emitter.document}
                </p>
              </>
            )}
            <p className="text-sm text-gray-500">{formatDate(invoice.issueDate)}</p>
          </div>
        </header>

        <Separator className="my-6" />

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="min-w-0">
            <p className="text-xs text-gray-500 mb-1">POR CLIENTE</p>
            <p className="font-bold text-2xl break-words">{invoice.clientName || 'Nome do Cliente'}</p>
          </div>
          <div className="text-right min-w-0">
            <p className="text-xs text-gray-500 mb-1">TIPO DE SERVIÇO</p>
            <p className="font-bold break-words">{invoice.service || 'Serviço Prestado'}</p>
          </div>
        </div>

        <div className="mb-8">
          <table className="w-full table-fixed border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="w-[18%] py-2 px-1 text-left text-sm font-medium">REF.</th>
                <th className="w-[18%] py-2 px-1 text-left text-sm font-medium">TIPO</th>
                <th className="w-[40%] py-2 px-1 text-left text-sm font-medium">DESCRIÇÃO</th>
                <th className="w-[24%] py-2 px-1 text-right text-sm font-medium">VALOR FINAL</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.length > 0 ? (
                invoice.items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-200">
                    <td className="py-2 px-1 text-sm align-top break-words">{item.ref || '-'}</td>
                    <td className="py-2 px-1 text-sm align-top break-words">{item.type || '-'}</td>
                    <td className="py-2 px-1 text-sm align-top break-words leading-tight">
                      {item.description}
                    </td>
                    <td className="py-2 px-1 text-right font-semibold text-sm align-top whitespace-nowrap">
                      {formatCurrency(item.total || 0)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-gray-500">
                    Nenhum item adicionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Separator className="my-6" />

        <div className="flex justify-end">
          <div className="w-full max-w-[16rem] space-y-2">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {deliveryFee !== 0 && (
              <div className="flex justify-between text-sm">
                <span>Taxa de Entrega</span>
                <span>{formatCurrency(deliveryFee)}</span>
              </div>
            )}
            {adjustment !== 0 && (
              <div className="flex justify-between text-sm text-black">
                <span>
                  {getAdjustmentKind(adjustment) === 'increase' ? 'Acréscimo' : 'Desconto'}
                </span>
                <span>{formatSignedAdjustment(adjustment)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between text-lg font-bold text-blue-600">
              <span>Valor Final</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        <footer className="mt-10 text-center text-xs text-gray-500">
          Aguardando o pagamento e o envio do comprovante
        </footer>
      </CardContent>
    </Card>
  );
});

InvoicePreview.displayName = 'InvoicePreview';