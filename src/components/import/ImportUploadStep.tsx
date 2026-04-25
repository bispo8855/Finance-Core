import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UploadCloud, FileSpreadsheet, AlertCircle, ShoppingBag, Landmark, FileQuestion } from 'lucide-react';
import { ImportSource, ImportMode } from '@/types/import';
import { toast } from 'sonner';

interface ImportUploadStepProps {
  onUpload: (file: File, source: ImportSource, mode: ImportMode) => void;
}

export default function ImportUploadStep({ onUpload }: ImportUploadStepProps) {
  const [source, setSource] = useState<ImportSource>('Mercado Livre');
  const [mode, setMode] = useState<ImportMode | undefined>(undefined);
  const [file, setFile] = useState<File | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndSetFile = (selectedFile: File) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv' // .csv
    ];
    
    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.csv') && !selectedFile.name.endsWith('.xlsx')) {
      toast.error('Formato inválido', { description: 'Por favor, envie um arquivo .xlsx ou .csv' });
      return;
    }
    
    setFile(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsHovering(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsHovering(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovering(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) validateAndSetFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) validateAndSetFile(e.target.files[0]);
  };

  const handleContinue = () => {
    if (file && source && mode) {
      onUpload(file, source, mode);
    }
  };

  const modes = [
    { id: 'sales', title: 'Relatório de Vendas', desc: 'Vendas, taxas, fretes e recebíveis.', icon: ShoppingBag, color: 'blue' },
    { id: 'bank', title: 'Extrato / Liquidações', desc: 'Repasses, depósitos e conciliação.', icon: Landmark, color: 'emerald' },
    { id: 'generic', title: 'Outro (Genérico)', desc: 'Formatos customizados ou desconhecidos.', icon: FileQuestion, color: 'slate' }
  ];

  return (
    <Card className="max-w-3xl mx-auto shadow-xl border-slate-200 overflow-hidden">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100">
        <CardTitle className="text-2xl font-bold text-slate-900">Novo Lote de Importação</CardTitle>
        <CardDescription className="text-base">
          O Aurys utiliza inteligência artificial para ler seus arquivos, mas precisamos saber o que você está importando hoje.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-8 space-y-10">
        {/* 1. Escolha da Natureza (MODO) - DESIGN PREMIUM */}
        <div className="space-y-4">
          <Label className="text-sm font-bold uppercase tracking-wider text-slate-500">Natureza do Arquivo</Label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {modes.map((m) => {
              const Icon = m.icon;
              const isSelected = mode === m.id;
              return (
                <div 
                  key={m.id}
                  onClick={() => setMode(m.id as ImportMode)}
                  className={`
                    relative p-5 rounded-2xl border-2 transition-all cursor-pointer group flex flex-col gap-3
                    ${isSelected 
                      ? `border-primary bg-primary/5 shadow-md shadow-primary/5` 
                      : 'border-slate-100 bg-white hover:border-slate-300 hover:shadow-lg'
                    }
                  `}
                >
                   <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors
                    ${isSelected ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'}
                  `}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className={`font-bold ${isSelected ? 'text-primary' : 'text-slate-800'}`}>{m.title}</h4>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{m.desc}</p>
                  </div>
                  {isSelected && (
                    <div className="absolute top-4 right-4 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
          {/* 2. Origem do Arquivo */}
          <div className="space-y-4">
            <Label htmlFor="source" className="text-sm font-bold uppercase tracking-wider text-slate-500">Origem (Layout)</Label>
            <Select value={source} onValueChange={(val) => setSource(val as ImportSource)}>
              <SelectTrigger id="source" className="w-full h-12 rounded-xl text-base font-medium">
                <SelectValue placeholder="Selecione a origem..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Mercado Livre">Mercado Livre</SelectItem>
                <SelectItem value="Shopee">Shopee</SelectItem>
                <SelectItem value="Shopify">Shopify</SelectItem>
                <SelectItem value="Gateway">Gateway de Pagamento</SelectItem>
                <SelectItem value="Outro">Outro formato</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-400">Define como os dados serão mapeados.</p>
          </div>

          {/* 3. Upload do Arquivo */}
          <div className="space-y-4">
            <Label className="text-sm font-bold uppercase tracking-wider text-slate-500">Arquivo Planilha</Label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
              className={`
                h-[100px] border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all
                ${isHovering ? 'border-primary bg-primary/5' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}
                ${file ? 'bg-emerald-50/30 border-emerald-200' : ''}
              `}
            >
              <input type="file" className="hidden" ref={fileInputRef} accept=".csv, .xlsx" onChange={handleFileChange} />
              {file ? (
                <div className="flex items-center gap-3 px-4">
                  <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-800 truncate max-w-[150px]">{file.name}</span>
                    <span className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <UploadCloud className="w-6 h-6 text-slate-400 mb-1" />
                  <span className="text-sm font-medium text-slate-500">Upload CSV/XLSX</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="bg-slate-50 border-t border-slate-100 p-6 flex justify-between items-center">
        <div className="flex items-center text-sm text-slate-400 font-medium">
          <AlertCircle className="w-4 h-4 mr-2" />
          Preencha todos os campos obrigatórios
        </div>
        <Button 
          onClick={handleContinue} 
          disabled={!file || !mode} 
          className="h-12 bg-primary hover:bg-primary/90 text-white font-bold px-10 rounded-xl transition-all shadow-lg shadow-primary/20 disabled:shadow-none disabled:opacity-50"
        >
          {!mode ? 'Selecione a Natureza' : 'Analisar Planilha'}
        </Button>
      </CardFooter>
    </Card>
  );
}
