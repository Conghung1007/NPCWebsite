import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Edit, Check, X } from "lucide-react";

interface EditableTextProps {
  fieldName: string;
  text: string;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
  showEditButton?: boolean;
  editingField?: string | null;
  editValues?: Record<string, string>;
  onEditStart?: (fieldName: string, value: string) => void;
  onEditSave?: (fieldName: string, value: string) => void;
  onEditCancel?: () => void;
}

export function EditableText({ 
  fieldName, 
  text, 
  className = "", 
  multiline = false, 
  placeholder = "",
  showEditButton = true,
  editingField,
  editValues = {},
  onEditStart,
  onEditSave,
  onEditCancel
}: EditableTextProps) {
  const [localValue, setLocalValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  useEffect(() => {
    if (editingField === fieldName) {
      setIsEditing(true);
      setLocalValue(editValues[fieldName] || text);
      
      // Focus and position cursor at end
      setTimeout(() => {
        const element = multiline ? textareaRef.current : inputRef.current;
        if (element) {
          element.focus();
          const length = element.value.length;
          element.setSelectionRange(length, length);
        }
      }, 10);
    } else {
      setIsEditing(false);
    }
  }, [editingField, fieldName, text, multiline, editValues]);
  
  if (!showEditButton) {
    return <span className={className}>{text}</span>;
  }

  const handleSave = () => {
    onEditSave?.(fieldName, localValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    onEditCancel?.();
    setIsEditing(false);
    setLocalValue('');
  };

  const handleStartEdit = () => {
    onEditStart?.(fieldName, text);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 w-full">
        {multiline ? (
          <textarea
            ref={textareaRef}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            placeholder={placeholder}
            className={`flex-1 border border-primary rounded-md px-2 py-1 resize-none ${className}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !multiline) {
                e.preventDefault();
                handleSave();
              } else if (e.key === 'Escape') {
                handleCancel();
              }
            }}
            onBlur={handleSave}
          />
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            placeholder={placeholder}
            className={`flex-1 border border-primary rounded-md px-2 py-1 ${className}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSave();
              } else if (e.key === 'Escape') {
                handleCancel();
              }
            }}
            onBlur={handleSave}
          />
        )}
        <Button size="sm" onClick={handleSave}>
          <Check className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={handleCancel}>
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="group relative inline-block w-full">
      <span className={className}>{text}</span>
      <Button
        size="sm"
        variant="ghost"
        className="absolute -right-12 top-0 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white shadow-sm border"
        onClick={handleStartEdit}
      >
        <Edit className="w-4 h-4" />
      </Button>
    </div>
  );
}