import { useCallback, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  useSiteContents,
  useUpsertSiteContent,
} from "@/hooks/useSiteContents";

/**
 * Shared CMS wiring for portal/landing pages: site_contents + EditableText handlers.
 */
export function useEditablePageContent(
  page: string,
  defaults: Record<string, string>,
) {
  const { user } = useAuth();
  const hasEditPermission = user?.role === "manager" || user?.role === "admin";
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const { data: remoteContents = {}, isLoading } = useSiteContents(page);
  const upsertContent = useUpsertSiteContent(page);

  const getContent = useCallback(
    (key: string) => remoteContents[key] ?? defaults[key] ?? "",
    [remoteContents, defaults],
  );

  const handleEditStart = (fieldName: string, currentValue: string) => {
    setEditingField(fieldName);
    setEditValues((prev) => ({ ...prev, [fieldName]: currentValue }));
  };

  const handleEditSave = (fieldName: string, value: string) => {
    upsertContent.mutate({ key: fieldName, value });
    setEditValues((prev) => {
      const next = { ...prev };
      delete next[fieldName];
      return next;
    });
    setEditingField(null);
  };

  const handleEditCancel = () => setEditingField(null);

  return {
    hasEditPermission,
    isLoading,
    getContent,
    editingField,
    editValues,
    handleEditStart,
    handleEditSave,
    handleEditCancel,
  };
}
