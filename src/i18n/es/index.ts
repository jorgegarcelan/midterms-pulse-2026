import { common } from "@/i18n/es/common";
import { home } from "@/i18n/es/home";
import { model } from "@/i18n/es/model";
import { races } from "@/i18n/es/races";
import { maps } from "@/i18n/es/maps";
import { polls } from "@/i18n/es/polls";
import { markets } from "@/i18n/es/markets";
import { history } from "@/i18n/es/history";
import { live } from "@/i18n/es/live";
import { explainer } from "@/i18n/es/explainer";
import { glossary } from "@/i18n/es/glossary";
import { state } from "@/i18n/es/state";
import { night } from "@/i18n/es/night";
import { stream } from "@/i18n/es/stream";
import { changes } from "@/i18n/es/changes";

// One flat dictionary; each area keeps its own file so translations can be edited independently.
export const es: Record<string, string> = { ...common, ...home, ...model, ...races, ...maps, ...polls, ...markets, ...history, ...live, ...explainer, ...glossary, ...state, ...night, ...stream, ...changes };
