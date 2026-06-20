'use client';

import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Download, FileText, X } from 'lucide-react';
import type { SavedExport } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface SavedExportCardProps {
  saved: SavedExport;
  onDownload: (saved: SavedExport) => void;
  onDelete: (id: string) => void;
}

export function SavedExportCard({ saved, onDownload, onDelete }: SavedExportCardProps) {
  const savedDate = format(new Date(saved.createdAt), "d 'de' MMM 'de' yyyy, HH:mm", {
    locale: ptBR,
  });

  return (
    <Card className="relative group hover:border-primary overflow-hidden">
      <Button
        variant="destructive"
        size="icon"
        className="absolute top-2 right-2 z-10 hidden w-7 h-7 rounded-full group-hover:flex"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(saved.id);
        }}
      >
        <X className="w-4 h-4" />
      </Button>

      <CardContent
        className="p-3 sm:p-4 cursor-pointer"
        onClick={() => onDownload(saved)}
      >
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="w-full sm:w-48 shrink-0 bg-muted rounded-md overflow-hidden flex items-center justify-center min-h-[120px]">
            {saved.format === 'jpeg' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={saved.data}
                alt={`Recibo ${saved.clientName}`}
                className="w-full h-auto object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <FileText className="h-10 w-10" />
                <span className="text-xs font-medium">PDF</span>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-base truncate">{saved.clientName}</h3>
              <Badge variant="secondary">{saved.format.toUpperCase()}</Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate">Ref: {saved.invoiceNumber}</p>
            <p className="text-xs text-muted-foreground">Salvo em {savedDate}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-1"
              onClick={(e) => {
                e.stopPropagation();
                onDownload(saved);
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar {saved.format.toUpperCase()}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}