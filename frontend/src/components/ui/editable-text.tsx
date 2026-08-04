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
  const cursorPositionRef = useRef<number>(0);
  
  useEffect(() => {
    if (editingField === fieldName) {
      setIsEditing(true);
      const initialValue = editValues[fieldName] || text;
      setLocalValue(initialValue);
      cursorPositionRef.current = initialValue.length;
      
      // Focus and position cursor at end after DOM update
      const timeoutId = setTimeout(() => {
        const element = multiline ? textareaRef.current : inputRef.current;
        if (element) {
          element.focus();
          element.setSelectionRange(cursorPositionRef.current, cursorPositionRef.current);
        }
      }, 50);
      
      return () => clearTimeout(timeoutId);
    } else {
      setIsEditing(false);
    }
  }, [editingField, fieldName, text, multiline, editValues]);
  
  // Preserve cursor position on value change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const element = e.target;
    cursorPositionRef.current = element.selectionStart || 0;
    setLocalValue(element.value);
    
    // Restore cursor position after state update
    requestAnimationFrame(() => {
      if (element) {
        element.setSelectionRange(cursorPositionRef.current, cursorPositionRef.current);
      }
    });
  };
  
  if (!showEditButton) {
    // Use edited value if available, otherwise use original text
    const displayText = editValues[fieldName] || text;
    return <span className={className}>{displayText}</span>;
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
    // Use edited value if available, otherwise use original text
    const currentText = editValues[fieldName] || text;
    onEditStart?.(fieldName, currentText);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 w-full">
        {multiline ? (
          <textarea
            ref={textareaRef}
            value={localValue}
            onChange={handleInputChange}
            placeholder={placeholder}
            className={`flex-1 border border-primary rounded-md px-2 py-1 resize-none bg-gray-100 text-gray-900 ${className}`}
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
            onChange={handleInputChange}
            placeholder={placeholder}
            className={`flex-1 border border-primary rounded-md px-2 py-1 bg-gray-100 text-gray-900 ${className}`}
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

  // Use edited value if available, otherwise use original text
  const displayText = editValues[fieldName] || text;

  return (
    <span className="group relative inline-block w-full">
      <span className={className}>{displayText}</span>
      {showEditButton && (
        <Button
          size="sm"
          variant="ghost"
          className="absolute -right-12 top-0 opacity-0 group-hover:opacity-100 transition-all duration-200 bg-primary/10 hover:bg-primary/20 text-primary hover:text-primary border border-primary/30 hover:border-primary/50 shadow-md hover:shadow-lg"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleStartEdit();
          }}
        >
          <Edit className="w-4 h-4" />
        </Button>
      )}
    </span>
  );
}