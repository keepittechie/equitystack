import {
  PROJECT_2025_AGENDA,
  PROJECT_2025_AGENDA_ITEMS,
  PROJECT_2025_AGENDA_ITEM_LINKS,
  PROJECT_2025_SOURCE_REFS,
} from "./project-2025";

export const AGENDA_SOURCE_REFS = [...PROJECT_2025_SOURCE_REFS];
export const AGENDAS = [PROJECT_2025_AGENDA];
export const AGENDA_ITEMS = [...PROJECT_2025_AGENDA_ITEMS];
export const AGENDA_ITEM_LINKS = [...PROJECT_2025_AGENDA_ITEM_LINKS];

export function getAgendaSourceRefByKey(key) {
  return AGENDA_SOURCE_REFS.find((item) => item.key === key) || null;
}

export function getAgendaSourceRefsByKeys(keys = []) {
  return keys
    .map((key) => getAgendaSourceRefByKey(key))
    .filter(Boolean);
}
