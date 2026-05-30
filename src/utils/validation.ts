/** Regex for valid skill/agent names: Unicode letters, digits, hyphens (not at start/end) */
export const ITEM_NAME_RE = /^[\p{L}\p{N}](?:[\p{L}\p{N}\p{Pd}]*[\p{L}\p{N}])?$/u;
