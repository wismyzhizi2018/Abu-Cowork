import { useState } from 'react';
import { ITEM_NAME_RE } from '@/utils/validation';

/**
 * Shared name validation logic for AgentEditor and SkillEditor.
 * Handles the "new vs rename vs unchanged" validation rules:
 * - New item: strict ITEM_NAME_RE check once user has typed
 * - Renamed: strict ITEM_NAME_RE check
 * - Unchanged name on existing item: always valid
 */
export function useItemName(existingName: string | null) {
  const [name, setRawName] = useState(existingName ?? '');
  const [touched, setTouched] = useState(false);

  const setName = (value: string) => {
    setTouched(true);
    setRawName(value.replace(/\s+/g, '-'));
  };

  const trimmed = name.trim();
  const isNew = existingName === null;
  const nameChanged = !isNew && trimmed !== existingName;
  const nameValid = trimmed.length > 0 && (
    isNew
      ? (touched ? ITEM_NAME_RE.test(trimmed) : true)
      : nameChanged
        ? ITEM_NAME_RE.test(trimmed)
        : true
  );

  return { name, setName, nameValid, nameChanged } as const;
}
