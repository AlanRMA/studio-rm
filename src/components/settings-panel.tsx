'use client';

import { useEffect, useState } from 'react';
import { Download, Save, Trash2 } from 'lucide-react';
import type { Invoice, SavedExport, SaveFormat } from '@/lib/types';
import { NOVO_PLUS_VALUE } from '@/lib/constants';
import { loadSettingsSnapshot, saveSettingsSnapshot, type SettingsSnapshot } from '@/lib/settings-storage';
import { LogoUploader } from '@/components/logo-uploader';
import { SortableItemList } from '@/components/sortable-item-list';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface SettingsPanelProps {
  invoices: Invoice[];
  savedExports: SavedExport[];
  onClearInvoices: () => void;
  onClearSavedExports: () => void;
  onSettingsSaved: (snapshot: SettingsSnapshot) => void;
}

function withoutNovo(items: string[]): string[] {
  return items.filter((item) => item !== NOVO_PLUS_VALUE);
}

export function SettingsPanel({
  invoices,
  savedExports,
  onClearInvoices,
  onClearSavedExports,
  onSettingsSaved,
}: SettingsPanelProps) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<SettingsSnapshot>(() => loadSettingsSnapshot());
  const [savedDraft, setSavedDraft] = useState<SettingsSnapshot>(() => loadSettingsSnapshot());

  useEffect(() => {
    const snapshot = loadSettingsSnapshot();
    setDraft(snapshot);
    setSavedDraft(snapshot);
  }, []);

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(savedDraft);

  const updateList = (
    key: 'tipoItems' | 'descricaoItems' | 'empresaItems',
    updater: (items: string[]) => string[]
  ) => {
    setDraft((current) => ({
      ...current,
      [key]: updater(withoutNovo(current[key])),
    }));
  };

  const handleSaveSettings = () => {
    saveSettingsSnapshot(draft);
    setSavedDraft(draft);
    onSettingsSaved(draft);
    toast({
      title: 'Configurações salvas',
      description: 'Suas alterações foram aplicadas.',
    });
  };

  const handleDownloadDrafts = () => {
    const data = JSON.stringify(invoices, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rascunhos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSavedExports = () => {
    const data = JSON.stringify(savedExports, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `minhas-notas-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-8">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Logotipo</CardTitle>
          <CardDescription>Altere a imagem exibida nos recibos.</CardDescription>
        </CardHeader>
        <CardContent>
          <LogoUploader
            logo={draft.logo}
            onLogoChange={(logo) => setDraft((current) => ({ ...current, logo }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Formato ao Salvar</CardTitle>
          <CardDescription>
            Define se o botão amarelo &quot;Salvar&quot; guarda JPEG ou PDF em Minhas Notas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={draft.saveFormat}
            onValueChange={(val) =>
              setDraft((current) => ({ ...current, saveFormat: val as SaveFormat }))
            }
            className="flex flex-col sm:flex-row gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="jpeg" id="save-jpeg" />
              <Label htmlFor="save-jpeg">JPEG (imagem)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="pdf" id="save-pdf" />
              <Label htmlFor="save-pdf">PDF (documento)</Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Lista de Empresas</CardTitle>
          <CardDescription>
            Gerencie as empresas do dropdown Empresa do Cliente. Arraste para reordenar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SortableItemList
            items={withoutNovo(draft.empresaItems)}
            onDelete={(item) =>
              updateList('empresaItems', (items) => items.filter((entry) => entry !== item))
            }
            onReorder={(from, to) =>
              updateList('empresaItems', (items) => {
                const reordered = [...items];
                const [moved] = reordered.splice(from, 1);
                reordered.splice(to, 0, moved);
                return reordered;
              })
            }
            emptyMessage="Nenhuma empresa cadastrada. Use NOVO+ no editor para adicionar."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Lista de Tipos</CardTitle>
          <CardDescription>
            Gerencie os itens do dropdown Tipo. Arraste para reordenar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SortableItemList
            items={withoutNovo(draft.tipoItems)}
            onDelete={(item) =>
              updateList('tipoItems', (items) => items.filter((entry) => entry !== item))
            }
            onReorder={(from, to) =>
              updateList('tipoItems', (items) => {
                const reordered = [...items];
                const [moved] = reordered.splice(from, 1);
                reordered.splice(to, 0, moved);
                return reordered;
              })
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Lista de Descrições</CardTitle>
          <CardDescription>
            Gerencie os itens do dropdown Descrição. Arraste para reordenar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SortableItemList
            items={withoutNovo(draft.descricaoItems)}
            onDelete={(item) =>
              updateList('descricaoItems', (items) => items.filter((entry) => entry !== item))
            }
            onReorder={(from, to) =>
              updateList('descricaoItems', (items) => {
                const reordered = [...items];
                const [moved] = reordered.splice(from, 1);
                reordered.splice(to, 0, moved);
                return reordered;
              })
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Minhas Notas</CardTitle>
          <CardDescription>
            {savedExports.length} nota(s) salva(s) como JPEG ou PDF no navegador.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            onClick={handleDownloadSavedExports}
            disabled={savedExports.length === 0}
            className="flex-1"
          >
            <Download className="h-4 w-4 mr-2" />
            Baixar backup das notas
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={savedExports.length === 0}
                className="flex-1"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar Minhas Notas
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar Minhas Notas?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação apagará permanentemente todos os {savedExports.length} arquivos
                  JPEG/PDF salvos no navegador.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onClearSavedExports}>Limpar tudo</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Rascunhos do Editor</CardTitle>
          <CardDescription>
            {invoices.length} rascunho(s) em edição (dados do formulário, não o arquivo final).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            onClick={handleDownloadDrafts}
            disabled={invoices.length === 0}
            className="flex-1"
          >
            <Download className="h-4 w-4 mr-2" />
            Baixar rascunhos
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={invoices.length === 0}
                className="flex-1"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar rascunhos
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar rascunhos?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação apagará permanentemente todos os {invoices.length} rascunhos do editor.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onClearInvoices}>Limpar tudo</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      <div className="sticky bottom-0 bg-background/95 backdrop-blur border rounded-lg p-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {hasChanges ? 'Alterações pendentes — clique em Salvar para aplicar.' : 'Tudo salvo.'}
        </p>
        <Button onClick={handleSaveSettings} disabled={!hasChanges} className="min-w-[140px]">
          <Save className="h-4 w-4 mr-2" />
          Salvar
        </Button>
      </div>
    </div>
  );
}