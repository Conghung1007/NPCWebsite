import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-neutral-600">{label}</Label>
      {children}
    </div>
  );
}

type CardsEditorProps = {
  items: Array<{ title: string; body: string; meta?: string }>;
  onChange: (items: Array<{ title: string; body: string; meta?: string }>) => void;
};

export function CardsEditor({ items, onChange }: CardsEditorProps) {
  const update = (index: number, patch: Partial<(typeof items)[0]>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };
  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));
  const add = () => onChange([...items, { title: "", body: "", meta: "" }]);

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-lg border p-3 space-y-2 bg-neutral-50/50">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-neutral-500">Thẻ {i + 1}</span>
            <Button type="button" size="icon" variant="ghost" onClick={() => remove(i)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <FieldRow label="Tiêu đề">
            <Input value={item.title} onChange={(e) => update(i, { title: e.target.value })} />
          </FieldRow>
          <FieldRow label="Meta (tuỳ chọn)">
            <Input value={item.meta || ""} onChange={(e) => update(i, { meta: e.target.value })} />
          </FieldRow>
          <FieldRow label="Nội dung">
            <Textarea
              rows={3}
              value={item.body}
              onChange={(e) => update(i, { body: e.target.value })}
            />
          </FieldRow>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="h-4 w-4 mr-1" /> Thêm thẻ
      </Button>
    </div>
  );
}

type RowsEditorProps = {
  items: Array<{ label: string; value: string }>;
  onChange: (items: Array<{ label: string; value: string }>) => void;
};

export function RowsEditor({ items, onChange }: RowsEditorProps) {
  const update = (index: number, patch: Partial<(typeof items)[0]>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };
  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));
  const add = () => onChange([...items, { label: "", value: "" }]);

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="grid sm:grid-cols-2 gap-2 rounded-lg border p-3 bg-neutral-50/50">
          <Input
            placeholder="Nhãn"
            value={item.label}
            onChange={(e) => update(i, { label: e.target.value })}
          />
          <div className="flex gap-2">
            <Input
              placeholder="Giá trị"
              value={item.value}
              onChange={(e) => update(i, { value: e.target.value })}
            />
            <Button type="button" size="icon" variant="ghost" onClick={() => remove(i)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="h-4 w-4 mr-1" /> Thêm dòng
      </Button>
    </div>
  );
}

type StepsEditorProps = {
  items: Array<{ title: string; body: string }>;
  onChange: (items: Array<{ title: string; body: string }>) => void;
};

export function StepsEditor({ items, onChange }: StepsEditorProps) {
  const update = (index: number, patch: Partial<(typeof items)[0]>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };
  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));
  const add = () => onChange([...items, { title: "", body: "" }]);

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-lg border p-3 space-y-2 bg-neutral-50/50">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-neutral-500">Bước {i + 1}</span>
            <Button type="button" size="icon" variant="ghost" onClick={() => remove(i)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <Input
            placeholder="Tiêu đề bước"
            value={item.title}
            onChange={(e) => update(i, { title: e.target.value })}
          />
          <Textarea
            rows={2}
            placeholder="Mô tả"
            value={item.body}
            onChange={(e) => update(i, { body: e.target.value })}
          />
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="h-4 w-4 mr-1" /> Thêm bước
      </Button>
    </div>
  );
}

type BulletsEditorProps = {
  items: string[];
  onChange: (items: string[]) => void;
};

export function BulletsEditor({ items, onChange }: BulletsEditorProps) {
  const update = (index: number, value: string) => {
    onChange(items.map((item, i) => (i === index ? value : item)));
  };
  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));
  const add = () => onChange([...items, ""]);

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <Input value={item} onChange={(e) => update(i, e.target.value)} />
          <Button type="button" size="icon" variant="ghost" onClick={() => remove(i)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="h-4 w-4 mr-1" /> Thêm ý
      </Button>
    </div>
  );
}

type FaqEditorProps = {
  items: Array<{ question: string; answer: string }>;
  onChange: (items: Array<{ question: string; answer: string }>) => void;
};

export function FaqEditor({ items, onChange }: FaqEditorProps) {
  const update = (index: number, patch: Partial<(typeof items)[0]>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };
  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));
  const add = () => onChange([...items, { question: "", answer: "" }]);

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="rounded-lg border p-3 space-y-2 bg-neutral-50/50">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-neutral-500">Câu hỏi {i + 1}</span>
            <Button type="button" size="icon" variant="ghost" onClick={() => remove(i)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <Input
            placeholder="Câu hỏi"
            value={item.question}
            onChange={(e) => update(i, { question: e.target.value })}
          />
          <Textarea
            rows={3}
            placeholder="Trả lời"
            value={item.answer}
            onChange={(e) => update(i, { answer: e.target.value })}
          />
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="h-4 w-4 mr-1" /> Thêm FAQ
      </Button>
    </div>
  );
}

export function parseJsonField<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
