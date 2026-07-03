import { useState } from 'react';
import { useVariationStore, VariationItem } from '@/stores/useVariationStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import ImportExportButtons from '@/components/admin/ImportExportButtons';

const Variations = () => {
  const { items, addItem, deleteItem } = useVariationStore();
  const [name, setName] = useState('');
  const [type, setType] = useState<'color' | 'size' | 'weight'>('color');

  const handleAdd = () => {
    if (!name.trim()) { toast.error('নাম লিখুন'); return; }
    addItem({ id: Date.now().toString(), name: name.trim(), type });
    setName('');
    toast.success('ভেরিয়েশন যোগ করা হয়েছে');
  };

  const colors = items.filter(i => i.type === 'color');
  const sizes = items.filter(i => i.type === 'size');
  const weights = items.filter(i => i.type === 'weight');

  const renderList = (list: VariationItem[], label: string) => (
    <div className="space-y-2">
      <h3 className="font-semibold text-foreground">{label}</h3>
      {list.length === 0 ? (
        <p className="text-sm text-muted-foreground">কোনো {label} যোগ করা হয়নি</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {list.map(item => (
            <span key={item.id} className="inline-flex items-center gap-1 px-3 py-1 bg-muted rounded-full text-sm">
              {item.name}
              <button onClick={() => { deleteItem(item.id); toast.success('ডিলিট করা হয়েছে'); }} className="text-destructive hover:text-destructive/80">
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-foreground">ভেরিয়েশন</h1>
        <ImportExportButtons
          data={items}
          filename="variations"
          label="ভেরিয়েশন"
          onImport={(imported: VariationItem[]) => {
            imported.forEach(v => {
              if (!items.find(ev => ev.id === v.id)) addItem(v);
            });
          }}
        />
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div className="space-y-2">
              <Label>ধরন</Label>
              <Select value={type} onValueChange={(v) => setType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="color">কালার</SelectItem>
                  <SelectItem value="size">সাইজ</SelectItem>
                  <SelectItem value="weight">কেজি/ওজন</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>নাম</Label>
              <Input placeholder="যেমন: লাল, XL, ১ কেজি" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
            </div>
            <Button onClick={handleAdd} className="gap-2"><Plus className="w-4 h-4" /> যোগ করুন</Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="color">
        <TabsList>
          <TabsTrigger value="color">কালার ({colors.length})</TabsTrigger>
          <TabsTrigger value="size">সাইজ ({sizes.length})</TabsTrigger>
          <TabsTrigger value="weight">কেজি/ওজন ({weights.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="color"><Card className="border-0 shadow-sm"><CardContent className="p-6">{renderList(colors, 'কালার')}</CardContent></Card></TabsContent>
        <TabsContent value="size"><Card className="border-0 shadow-sm"><CardContent className="p-6">{renderList(sizes, 'সাইজ')}</CardContent></Card></TabsContent>
        <TabsContent value="weight"><Card className="border-0 shadow-sm"><CardContent className="p-6">{renderList(weights, 'কেজি/ওজন')}</CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
};

export default Variations;
