import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface ImportExportButtonsProps<T> {
  data: T[];
  filename: string;
  onImport: (items: T[]) => void;
  label?: string;
}

function ImportExportButtons<T>({ data, filename, onImport, label = 'ডাটা' }: ImportExportButtonsProps<T>) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    if (data.length === 0) {
      toast.error(`এক্সপোর্ট করার মতো কোনো ${label} নেই`);
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${data.length}টি ${label} এক্সপোর্ট হয়েছে`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(parsed)) {
          toast.error('ফাইলে সঠিক ডাটা ফরম্যাট নেই');
          return;
        }
        onImport(parsed);
        toast.success(`${parsed.length}টি ${label} ইমপোর্ট হয়েছে`);
      } catch {
        toast.error('JSON ফাইল পড়তে সমস্যা হয়েছে');
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={handleExport}>
        <Download className="w-3.5 h-3.5" /> এক্সপোর্ট
      </Button>
      <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => fileRef.current?.click()}>
        <Upload className="w-3.5 h-3.5" /> ইমপোর্ট
      </Button>
    </div>
  );
}

export default ImportExportButtons;
