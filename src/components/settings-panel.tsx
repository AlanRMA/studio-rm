'use client';

import { Download, Trash2 } from 'lucide-react';
import type { Invoice, SavedExport, SaveFormat } from '@/lib/types';
import { DEFAULT_SAVE_FORMAT, NOVO_PLUS_VALUE, STORAGE_KEYS } from '@/lib/constants';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useDropdownLists } from '@/hooks/use-dropdown-lists';
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

interface SettingsPanelProps {
  logo: string | null;
  onLogoChange: (logo: string | null) => void;
  invoices: Invoice[];
  savedExports: SavedExport[];
  onClearInvoices: () => void;
  onClearSavedExports: () => void;
}

export function SettingsPanel({
  logo,
  onLogoChange,
  invoices,
  savedExports,
  onClearInvoices,
  onClearSavedExports,
}: SettingsPanelProps) {
  const { tipoItems, descricaoItems, empresaItems, deleteItem, reorderItems } = useDropdownLists();
  const [saveFormat, setSaveFormat] = useLocalStorage<SaveFormat>(
    STORAGE_KEYS.saveFormat,
    DEFAULT_SAVE_FORMAT
  );

  const tipoManageable = tipoItems.filter((item) => item !== NOVO_PLUS_VALUE);
  const descricaoManageable = descricaoItems.filter((item) => item !== NOVO_PLUS_VALUE);
  const empresaManageable = empresaItems.filter((item) => item !== NOVO_PLUS_VALUE);

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
    <div className="space-y-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Logotipo</CardTitle>
          <CardDescription>Altere a imagem exibida nos recibos. Salva automaticamente no navegador.</CardDescription>
        </CardHeader>
        <CardContent>
          <LogoUploader logo={logo} onLogoChange={onLogoChange} />
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
            value={saveFormat}
            onValueChange={(val) => setSaveFormat(val as SaveFormat)}
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
            items={empresaManageable}
            onDelete={(item) => deleteItem('empresa', item)}
            onReorder={(from, to) => reorderItems('empresa', from, to)}
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
            items={tipoManageable}
            onDelete={(item) => deleteItem('tipo', item)}
            onReorder={(from, to) => reorderItems('tipo', from, to)}
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
            items={descricaoManageable}
            onDelete={(item) => deleteItem('descricao', item)}
            onReorder={(from, to) => reorderItems('descricao', from, to)}
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
    </div>
  );
}