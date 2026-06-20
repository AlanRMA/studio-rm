
'use client';

import type { FC } from 'react';
import { forwardRef, useCallback, useEffect, useImperativeHandle } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlusCircle, Trash2 } from 'lucide-react';
import type { Invoice } from '@/lib/types';
import { invoiceSchema } from '@/lib/types';
import { formatInvoiceValidationError, validateInvoiceForSave } from '@/lib/invoice-validation';
import { useDropdownLists } from '@/hooks/use-dropdown-lists';
import { CustomItemSelect } from '@/components/custom-item-select';
import { ClearOnFocusInput } from '@/components/clear-on-focus-input';
import { ItemRowErrors } from '@/components/item-row-errors';
import { LEGACY_PLACEHOLDER_VALUES } from '@/lib/constants';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  applyAdjustmentSign,
  cn,
  getAdjustmentKind,
  getAdjustmentMagnitude,
  roundToNearestTenCents,
  type AdjustmentKind,
} from '@/lib/utils';

export interface InvoiceEditorHandle {
  validateForSave: () => Promise<
    { ok: true; invoice: Invoice } | { ok: false; message: string }
  >;
}

interface InvoiceEditorProps {
  invoice: Invoice;
  onInvoiceChange: (invoice: Invoice) => void;
}

export const InvoiceEditor = forwardRef<InvoiceEditorHandle, InvoiceEditorProps>(
  function InvoiceEditor({ invoice, onInvoiceChange }, ref) {
  const { tipoItems, descricaoItems, empresaItems, addItem } = useDropdownLists();
  const legacyClearValues = [...LEGACY_PLACEHOLDER_VALUES];

  const form = useForm<Invoice>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      ...invoice,
      showEmitter: invoice.showEmitter ?? false,
      emitterDocumentType: invoice.emitterDocumentType ?? null,
      items: invoice.items.map((item) => ({
        ...item,
        type: item.type ?? '',
      })),
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const showEmitter = form.watch('showEmitter');
  const adjustmentValue = form.watch('adjustment');
  const adjustmentKind = getAdjustmentKind(adjustmentValue || 0);

  useImperativeHandle(ref, () => ({
    validateForSave: async () => {
      await form.trigger();
      const values = form.getValues() as Invoice;
      const result = validateInvoiceForSave(values);
      if (!result.success) {
        return { ok: false, message: formatInvoiceValidationError(result.error) };
      }
      return { ok: true, invoice: result.data };
    },
  }));

  const publishInvoiceChange = useCallback(() => {
    form.trigger().then((isValid) => {
      if (isValid) {
        const parsed = validateInvoiceForSave(form.getValues() as Invoice);
        if (parsed.success) {
          onInvoiceChange(parsed.data);
        }
      }
    });
  }, [form, onInvoiceChange]);

  const setAdjustmentKind = (kind: AdjustmentKind) => {
    const magnitude = getAdjustmentMagnitude(form.getValues('adjustment'));
    form.setValue('adjustment', applyAdjustmentSign(magnitude, kind), {
      shouldDirty: true,
      shouldValidate: true,
    });
    publishInvoiceChange();
  };

  const handleAdjustmentInput = (magnitude: number, kind: AdjustmentKind) => {
    const signedValue = applyAdjustmentSign(magnitude, kind);
    form.setValue('adjustment', signedValue, {
      shouldDirty: true,
      shouldValidate: true,
    });
    publishInvoiceChange();
  };

  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if (name && (name.includes('.quantity') || name.includes('.unitPrice') || name.includes('.isRisk'))) {
        const itemIndex = parseInt(name.split('.')[1], 10);
        if (!isNaN(itemIndex)) {
          const item = form.getValues(`items.${itemIndex}`);
          let newTotal = (item.quantity || 0) * (item.unitPrice || 0);
          if (item.isRisk) {
            newTotal = newTotal / 100;
          }
          const roundedTotal = roundToNearestTenCents(newTotal);
          form.setValue(`items.${itemIndex}.total`, roundedTotal, { shouldDirty: true, shouldValidate: true });
        }
      }

      if (type === 'change') {
        form.trigger().then((isValid) => {
          if (isValid) {
            const parsed = validateInvoiceForSave(value as Invoice);
            if (parsed.success) {
              onInvoiceChange(parsed.data);
            }
          }
        });
      }
    });
    return () => subscription.unsubscribe();
  }, [form, onInvoiceChange]);

  const handleNumericInput = (field: { onChange: (value: number) => void }, value: string) => {
    const parsedValue = parseFloat(value);
    field.onChange(isNaN(parsedValue) ? 0 : parsedValue);
  };

  return (
    <Form {...form}>
      <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Emissor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              name="showEmitter"
              control={form.control}
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Colocar CPF/CNPJ?</FormLabel>
                    <FormDescription>Exibe os dados do emissor no cabeçalho do recibo.</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {showEmitter && (
              <FormField
                name="emitterDocumentType"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Documento</FormLabel>
                    <Select
                      value={field.value ?? undefined}
                      onValueChange={(val) => field.onChange(val as 'cpf' | 'cnpj')}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione CPF ou CNPJ" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cpf">CPF — Rosania Moreira Aragao</SelectItem>
                        <SelectItem value="cnpj">CNPJ — Rosania Modelista</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Detalhes da Nota</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              name="companyName"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <CustomItemSelect
                    label="Empresa do Cliente"
                    value={field.value}
                    items={empresaItems}
                    onChange={field.onChange}
                    onAddItem={(val) => addItem('empresa', val)}
                    placeholder="Selecione a empresa"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="clientName"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Cliente</FormLabel>
                  <FormControl>
                    <ClearOnFocusInput
                      placeholder="Nome do cliente"
                      clearOnFocusValues={legacyClearValues}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="service"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Serviço</FormLabel>
                  <FormControl>
                    <ClearOnFocusInput
                      placeholder="Ex: Instalação de rodapés"
                      clearOnFocusValues={legacyClearValues}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                name="invoiceNumber"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ref. da Nota</FormLabel>
                    <FormControl>
                      <Input {...field} disabled />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="issueDate"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} disabled />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Itens</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-start p-3 border rounded-md"
              >
                <div className="lg:col-span-2">
                  <FormField
                    name={`items.${index}.ref`}
                    control={form.control}
                    render={({ field: refField }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className={index !== 0 ? 'sr-only' : ''}>Referência</FormLabel>
                        <FormControl>
                          <ClearOnFocusInput
                            placeholder="Referência"
                            clearOnFocusValues={legacyClearValues}
                            {...refField}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="lg:col-span-3">
                  <FormField
                    name={`items.${index}.type`}
                    control={form.control}
                    render={({ field: typeField }) => (
                      <FormItem className="space-y-1.5">
                        <CustomItemSelect
                          label="Tipo"
                          hideLabel={index !== 0}
                          value={typeField.value}
                          items={tipoItems}
                          onChange={typeField.onChange}
                          onAddItem={(val) => addItem('tipo', val)}
                          placeholder="Selecione o tipo"
                        />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="lg:col-span-3">
                  <FormField
                    name={`items.${index}.description`}
                    control={form.control}
                    render={({ field: descField }) => (
                      <FormItem className="space-y-1.5">
                        <CustomItemSelect
                          label="Descrição"
                          hideLabel={index !== 0}
                          value={descField.value}
                          items={descricaoItems}
                          onChange={descField.onChange}
                          onAddItem={(val) => addItem('descricao', val)}
                          placeholder="Selecione a descrição"
                        />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="lg:col-span-3">
                  <FormField
                    name={`items.${index}.total`}
                    control={form.control}
                    render={({ field: totalField }) => (
                      <FormItem className="space-y-1.5">
                        <FormLabel className={index !== 0 ? 'sr-only' : ''}>Valor Final (R$)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...totalField}
                            onChange={(e) => handleNumericInput(totalField, e.target.value)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="lg:col-span-1 flex justify-end pt-6 lg:pt-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <ItemRowErrors index={index} />

                <div className="hidden">
                  <FormField
                    control={form.control}
                    name={`items.${index}.isRisk`}
                    render={({ field: riskField }) => (
                      <FormItem>
                        <FormControl>
                          <Checkbox checked={riskField.value} onCheckedChange={riskField.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    name={`items.${index}.quantity`}
                    control={form.control}
                    render={({ field: qtyField }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="number"
                            {...qtyField}
                            onChange={(e) => handleNumericInput(qtyField, e.target.value)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    name={`items.${index}.unitPrice`}
                    control={form.control}
                    render={({ field: priceField }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            {...priceField}
                            onChange={(e) => handleNumericInput(priceField, e.target.value)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                append({
                  id: `item-${Date.now()}`,
                  ref: '',
                  type: '',
                  description: '',
                  isRisk: false,
                  quantity: 1,
                  unitPrice: 0,
                  total: 0,
                })
              }
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Item
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Ajuste Final</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              name="deliveryFee"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Taxa de Entrega</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      {...field}
                      onChange={(e) => handleNumericInput(field, e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="adjustment"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <div className="flex gap-2 mb-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={adjustmentKind === 'increase' ? 'default' : 'outline'}
                      className={cn(
                        'flex-1',
                        adjustmentKind === 'increase' &&
                          'bg-green-600 hover:bg-green-700 text-white border-green-600'
                      )}
                      onClick={() => setAdjustmentKind('increase')}
                    >
                      Acréscimo (+)
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={adjustmentKind === 'discount' ? 'default' : 'outline'}
                      className={cn(
                        'flex-1',
                        adjustmentKind === 'discount' &&
                          'bg-red-600 hover:bg-red-700 text-white border-red-600'
                      )}
                      onClick={() => setAdjustmentKind('discount')}
                    >
                      Desconto (-)
                    </Button>
                  </div>
                  <FormLabel
                    className={cn(
                      'font-semibold',
                      adjustmentKind === 'increase' ? 'text-green-600' : 'text-red-600'
                    )}
                  >
                    {adjustmentKind === 'increase' ? 'Acréscimo (+)' : 'Desconto (-)'}
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span
                        className={cn(
                          'absolute left-3 top-1/2 -translate-y-1/2 font-semibold text-sm',
                          adjustmentKind === 'increase' ? 'text-green-600' : 'text-red-600'
                        )}
                      >
                        {adjustmentKind === 'increase' ? '+' : '-'}
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0,00"
                        className="pl-8"
                        value={getAdjustmentMagnitude(field.value)}
                        onChange={(e) => {
                          const parsed = parseFloat(e.target.value);
                          const magnitude = isNaN(parsed) ? 0 : Math.max(0, parsed);
                          handleAdjustmentInput(magnitude, adjustmentKind);
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Digite apenas o valor numérico. O sinal {adjustmentKind === 'increase' ? '+' : '-'} é aplicado
                    automaticamente.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
      </form>
    </Form>
  );
});