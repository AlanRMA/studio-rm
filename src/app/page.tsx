
'use client';

import type { FC } from 'react';
import { useState, useRef, useCallback, useEffect } from 'react';
import type { InvoiceEditorHandle } from '@/components/invoice-editor';
import {
  BarChart3,
  CheckCircle2,
  Download,
  FilePlus,
  FileText,
  Search,
  Settings,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import type { Invoice, SavedExport, SaveFormat } from '@/lib/types';
import { submitReceiptToBackend } from '@/lib/receipt-ingest';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_SAVE_FORMAT, LEGACY_PLACEHOLDER_VALUES, STORAGE_KEYS } from '@/lib/constants';
import { generateId } from '@/lib/utils';
import {
  captureInvoiceImage,
  downloadDataUrl,
  downloadInvoiceJpeg,
  downloadInvoicePdf,
  generateInvoicePdfData,
} from '@/lib/export-utils';
import { Button } from '@/components/ui/button';
import { InvoiceEditor } from '@/components/invoice-editor';
import { InvoicePreview } from '@/components/invoice-preview';
import { SavedExportCard } from '@/components/saved-export-card';
import { SettingsPanel } from '@/components/settings-panel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const createDefaultInvoice = (): Invoice => ({
  id: generateId(),
  invoiceNumber: generateId(),
  clientName: '',
  service: '',
  issueDate: format(new Date(), 'yyyy-MM-dd'),
  items: [
    {
      id: `item-${Date.now()}`,
      ref: '',
      type: '',
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0,
      isRisk: false,
    },
  ],
  companyName: '',
  showEmitter: false,
  emitterDocumentType: null,
  pricePerMeter: 0,
  deliveryFee: 0,
  adjustment: 0,
});

function clearLegacyPlaceholder(value: string): string {
  return LEGACY_PLACEHOLDER_VALUES.includes(value as (typeof LEGACY_PLACEHOLDER_VALUES)[number])
    ? ''
    : value;
}

function migrateInvoice(invoice: Invoice): Invoice {
  return {
    ...invoice,
    companyName: clearLegacyPlaceholder(invoice.companyName ?? ''),
    service: clearLegacyPlaceholder(invoice.service ?? ''),
    showEmitter: invoice.showEmitter ?? false,
    emitterDocumentType: invoice.emitterDocumentType ?? null,
    items: invoice.items.map((item) => ({
      ...item,
      type: item.type ?? '',
      isRisk: item.isRisk ?? false,
    })),
  };
}

const Page: FC = () => {
  const { toast } = useToast();
  const [logo, setLogo] = useLocalStorage<string | null>(STORAGE_KEYS.logo, null);
  const [invoices, setInvoices] = useLocalStorage<Invoice[]>(STORAGE_KEYS.invoices, []);
  const [saveFormat, setSaveFormat] = useLocalStorage<SaveFormat>(
    STORAGE_KEYS.saveFormat,
    DEFAULT_SAVE_FORMAT
  );
  const [settingsRevision, setSettingsRevision] = useState(0);
  const [savedExports, setSavedExports] = useLocalStorage<SavedExport[]>(
    STORAGE_KEYS.savedExports,
    []
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<{
    clientName: string;
    format: SaveFormat;
    syncStatus: 'synced' | 'queued' | 'failed';
  } | null>(null);

  const isSaveLocked = isSaving || saveSuccess !== null;

  const [currentInvoice, setCurrentInvoice] = useState<Invoice>(() => createDefaultInvoice());

  const [isClient, setIsClient] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('editor');
  const [exportToDelete, setExportToDelete] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      if (invoices.length > 0) {
        const migrated = invoices.map(migrateInvoice);
        const needsMigration = JSON.stringify(migrated) !== JSON.stringify(invoices);
        if (needsMigration) {
          setInvoices(migrated);
        }
        const currentExists = migrated.some((inv) => inv.id === currentInvoice.id);
        if (!currentExists) {
          setCurrentInvoice(migrated[0]);
        }
      } else {
        const initialInvoice = createDefaultInvoice();
        setCurrentInvoice(initialInvoice);
        setInvoices([initialInvoice]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient]);

  const previewRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<InvoiceEditorHandle>(null);

  const handleNewInvoice = () => {
    const newInvoice = createDefaultInvoice();
    const updatedInvoices = [newInvoice, ...invoices];
    setInvoices(updatedInvoices);
    setCurrentInvoice(newInvoice);
    toast({
      title: 'Nova Nota',
      description: 'Nova nota de pagamento criada.',
    });
    setActiveTab('editor');
  };

  const handleInvoiceChange = useCallback(
    (updatedInvoice: Invoice) => {
      const finalInvoice = {
        ...updatedInvoice,
        issueDate: format(new Date(), 'yyyy-MM-dd'),
      };

      setCurrentInvoice(finalInvoice);

      setInvoices((prevInvoices) => {
        const existingIndex = prevInvoices.findIndex((inv) => inv.id === finalInvoice.id);
        if (existingIndex > -1) {
          const updatedInvoices = [...prevInvoices];
          updatedInvoices[existingIndex] = finalInvoice;
          return updatedInvoices;
        }
        return [finalInvoice, ...prevInvoices];
      });
    },
    [setInvoices]
  );

  const getExportFilename = useCallback(
    (clientName: string, format: SaveFormat) => {
      const base = `nota-${clientName.replace(/\s/g, '_') || 'nota'}`;
      return format === 'pdf' ? `${base}.pdf` : `${base}.jpeg`;
    },
    []
  );

  const getReceiptLabel = useCallback((invoice: Invoice) => {
    return invoice.clientName || invoice.companyName || 'nota';
  }, []);

  const handleDismissSaveSuccess = useCallback(() => {
    setSaveSuccess(null);
    setActiveTab('notas');
  }, []);

  const handleSaveExport = useCallback(
    async (options: { downloadFormat: SaveFormat }) => {
      const node = previewRef.current;
      if (!node || isSaveLocked) return;

      const validation = await editorRef.current?.validateForSave();
      if (!validation?.ok) {
        toast({
          variant: 'destructive',
          title: 'Recibo incompleto',
          description: validation?.message ?? 'Preencha todos os campos obrigatórios.',
        });
        return;
      }

      const invoice = validation.invoice;
      const receiptLabel = getReceiptLabel(invoice);

      setIsSaving(true);
      try {
        const format = saveFormat;
        let data: string;

        if (format === 'pdf') {
          const result = await generateInvoicePdfData(node);
          data = result.dataUrl;
        } else {
          const result = await captureInvoiceImage(node);
          data = result.dataUrl;
        }

        const saved: SavedExport = {
          id: generateId(),
          invoiceId: invoice.id,
          clientName: receiptLabel,
          invoiceNumber: invoice.invoiceNumber,
          format,
          data,
          createdAt: new Date().toISOString(),
        };

        setSavedExports((prev) => [saved, ...prev]);

        const ingestResult = await submitReceiptToBackend(invoice, saved);
        const syncStatus: 'synced' | 'queued' | 'failed' = !ingestResult.ok
          ? 'failed'
          : ingestResult.status === 'queued'
            ? 'queued'
            : 'synced';

        const filename = getExportFilename(receiptLabel, options.downloadFormat);
        if (options.downloadFormat === format) {
          downloadDataUrl(data, filename);
        } else if (options.downloadFormat === 'pdf') {
          await downloadInvoicePdf(node, filename);
        } else {
          await downloadInvoiceJpeg(node, filename);
        }

        setSaveSuccess({
          clientName: receiptLabel,
          format,
          syncStatus,
        });
      } catch (error) {
        console.error(error);
        toast({
          variant: 'destructive',
          title: 'Falha ao salvar',
          description: 'Não foi possível gerar e salvar o arquivo.',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [getExportFilename, getReceiptLabel, isSaveLocked, saveFormat, setSavedExports, toast]
  );

  const handleSettingsSaved = useCallback(
    (snapshot: { logo: string | null; saveFormat: SaveFormat }) => {
      setLogo(snapshot.logo);
      setSaveFormat(snapshot.saveFormat);
      setSettingsRevision((value) => value + 1);
    },
    [setLogo, setSaveFormat]
  );

  const handleClearInvoices = () => {
    const newInvoice = createDefaultInvoice();
    setInvoices([newInvoice]);
    setCurrentInvoice(newInvoice);
    setActiveTab('editor');
    toast({
      title: 'Cache limpo',
      description: 'Todos os rascunhos foram removidos do navegador.',
    });
  };

  const handleClearSavedExports = () => {
    setSavedExports([]);
    toast({
      title: 'Notas apagadas',
      description: 'Todos os arquivos salvos foram removidos de Minhas Notas.',
    });
  };

  const handleDownloadSavedExport = (saved: SavedExport) => {
    const link = document.createElement('a');
    link.href = saved.data;
    link.download = getExportFilename(saved.clientName, saved.format);
    link.click();
  };

  const handleDeleteSavedExport = (id: string) => {
    setSavedExports((prev) => prev.filter((item) => item.id !== id));
    toast({
      title: 'Nota removida',
      description: 'Arquivo removido de Minhas Notas.',
    });
    setExportToDelete(null);
  };

  const filteredSavedExports = savedExports.filter(
    (saved) =>
      saved.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      saved.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isClient) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <header className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-xl sm:text-2xl font-bold font-headline text-primary text-center">
          Gerador de Nota de Pagamento
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard">
              <BarChart3 className="h-4 w-4 mr-2" />
              Dashboard
            </Link>
          </Button>
          <Button onClick={handleNewInvoice}>
            <FilePlus /> Nova Nota
          </Button>
        </div>
      </header>

      <main className="p-2 sm:p-4 max-w-[100vw] overflow-x-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 w-full grid grid-cols-3">
            <TabsTrigger value="editor">Editor</TabsTrigger>
            <TabsTrigger value="notas">Minhas Notas</TabsTrigger>
            <TabsTrigger value="config">
              <Settings className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Configurações</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="editor" className="overflow-x-hidden">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 xl:gap-8 min-w-0">
              <div className="min-w-0">
                <InvoiceEditor
                  ref={editorRef}
                  key={currentInvoice.id}
                  invoice={currentInvoice}
                  onInvoiceChange={handleInvoiceChange}
                  listsRevision={settingsRevision}
                />
              </div>
              <div id="invoice-preview-container" className="w-full min-w-0 flex flex-col items-center">
                <div className="w-full flex justify-center overflow-x-auto pb-2">
                  <InvoicePreview ref={previewRef} invoice={currentInvoice} logo={logo} />
                </div>
                <div className="flex flex-wrap justify-center gap-2 mt-4 no-print w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleSaveExport({ downloadFormat: 'jpeg' })}
                    disabled={isSaveLocked}
                    className="bg-green-600 text-white hover:bg-green-700 hover:text-white disabled:opacity-70"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {isSaving ? 'Salvando...' : 'Baixar JPEG'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleSaveExport({ downloadFormat: 'pdf' })}
                    disabled={isSaveLocked}
                    className="bg-green-600 text-white hover:bg-green-700 hover:text-white disabled:opacity-70"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {isSaving ? 'Salvando...' : 'Baixar PDF'}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notas">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente ou Ref..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <ScrollArea className="h-[70vh]">
              <div className="space-y-4 pr-2">
                {filteredSavedExports.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                      <p>Nenhuma nota salva ainda.</p>
                      <p className="text-sm mt-2">
                        Use <strong>Baixar JPEG</strong> ou <strong>Baixar PDF</strong> no editor para guardar aqui.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  filteredSavedExports.map((saved) => (
                    <SavedExportCard
                      key={saved.id}
                      saved={saved}
                      onDownload={handleDownloadSavedExport}
                      onDelete={(id) => setExportToDelete(id)}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="config">
            <SettingsPanel
              invoices={invoices}
              savedExports={savedExports}
              onClearInvoices={handleClearInvoices}
              onClearSavedExports={handleClearSavedExports}
              onSettingsSaved={handleSettingsSaved}
            />
          </TabsContent>
        </Tabs>
      </main>

      <AlertDialog
        open={saveSuccess !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) handleDismissSaveSuccess();
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-10 w-10 text-green-600 shrink-0" />
              <div>
                <AlertDialogTitle className="text-xl">Salvo com sucesso!</AlertDialogTitle>
                <AlertDialogDescription className="mt-1 text-base">
                  O recibo de <strong>{saveSuccess?.clientName}</strong> foi salvo como{' '}
                  <strong>{saveSuccess?.format.toUpperCase()}</strong> em Minhas Notas.
                  {saveSuccess?.syncStatus === 'synced'
                    ? ' Os dados também foram enviados ao sistema.'
                    : saveSuccess?.syncStatus === 'queued'
                      ? ' Os dados serão sincronizados com o sistema em breve.'
                      : ' O arquivo foi salvo, mas o envio ao servidor falhou. Tente salvar novamente mais tarde.'}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={handleDismissSaveSuccess}
              className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
            >
              Ver Minhas Notas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={exportToDelete !== null}
        onOpenChange={(isOpen) => !isOpen && setExportToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover nota salva?</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo JPEG/PDF será removido permanentemente de Minhas Notas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setExportToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => exportToDelete && handleDeleteSavedExport(exportToDelete)}
            >
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Page;