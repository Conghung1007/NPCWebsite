import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Edit, Check, X, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface EditableSectionItem {
  id: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
}

interface EditableSectionProps {
  title: string;
  items: EditableSectionItem[];
  onUpdateTitle: (newTitle: string) => void;
  onUpdateItem: (itemId: string, newItem: Omit<EditableSectionItem, 'id'>) => void;
  onAddItem: (newItem: Omit<EditableSectionItem, 'id'>) => void;
  onDeleteItem: (itemId: string) => void;
  className?: string;
}

export function EditableSection({
  title,
  items,
  onUpdateTitle,
  onUpdateItem,
  onAddItem,
  onDeleteItem,
  className = ""
}: EditableSectionProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<Omit<EditableSectionItem, 'id'>>({
    title: "",
    description: ""
  });
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState<Omit<EditableSectionItem, 'id'>>({
    title: "",
    description: ""
  });
  const { hasImageEditPermission } = useAuth();

  const handleSaveTitle = () => {
    onUpdateTitle(editTitle);
    setIsEditingTitle(false);
  };

  const handleCancelTitle = () => {
    setEditTitle(title);
    setIsEditingTitle(false);
  };

  const handleEditItem = (item: EditableSectionItem) => {
    setEditingItemId(item.id);
    setEditItem({
      title: item.title,
      description: item.description,
      icon: item.icon
    });
  };

  const handleSaveItem = () => {
    if (editingItemId) {
      onUpdateItem(editingItemId, editItem);
      setEditingItemId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditItem({ title: "", description: "" });
  };

  const handleAddItem = () => {
    if (newItem.title && newItem.description) {
      onAddItem(newItem);
      setNewItem({ title: "", description: "" });
      setIsAdding(false);
    }
  };

  const handleCancelAdd = () => {
    setNewItem({ title: "", description: "" });
    setIsAdding(false);
  };

  return (
    <div className={className}>
      {/* Editable Title */}
      <div className="mb-6">
        {isEditingTitle ? (
          <div className="flex items-center gap-2">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="text-2xl font-bold"
              autoFocus
            />
            <Button size="sm" onClick={handleSaveTitle}>
              <Check className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancelTitle}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="group relative">
            <h2 className="text-2xl font-bold text-foreground">{title}</h2>
            {hasImageEditPermission && (
              <Button
                size="sm"
                variant="ghost"
                className="absolute -right-8 top-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => setIsEditingTitle(true)}
              >
                <Edit className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Items Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item) => (
          <Card key={item.id} className="group relative">
            <CardHeader>
              {editingItemId === item.id ? (
                <div className="space-y-2">
                  <Input
                    value={editItem.title}
                    onChange={(e) => setEditItem({ ...editItem, title: e.target.value })}
                    placeholder="Tiêu đề"
                    autoFocus
                  />
                  <Textarea
                    value={editItem.description}
                    onChange={(e) => setEditItem({ ...editItem, description: e.target.value })}
                    placeholder="Mô tả"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveItem}>
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center mb-2">
                    {item.icon && <div className="mr-3">{item.icon}</div>}
                    <h3 className="font-semibold text-foreground">{item.title}</h3>
                  </div>
                  <p className="text-muted-foreground text-sm">{item.description}</p>
                  
                  {hasImageEditPermission && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditItem(item)}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDeleteItem(item.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardHeader>
          </Card>
        ))}

        {/* Add New Item */}
        {hasImageEditPermission && (
          <>
            {isAdding ? (
              <Card>
                <CardContent className="p-4 space-y-2">
                  <Input
                    value={newItem.title}
                    onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                    placeholder="Tiêu đề"
                    autoFocus
                  />
                  <Textarea
                    value={newItem.description}
                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                    placeholder="Mô tả"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddItem}>
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCancelAdd}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="p-6 flex items-center justify-center">
                  <Button
                    variant="ghost"
                    onClick={() => setIsAdding(true)}
                    className="w-full h-full"
                  >
                    <Plus className="w-6 h-6" />
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}