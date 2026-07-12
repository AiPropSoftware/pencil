import { attomProvider } from "./attom";
import type { CompsProvider } from "./types";

/** Swap the active provider here. We chose ATTOM as our primary. */
export const compsProvider: CompsProvider = attomProvider;
export type { CompRecord, CompsQuery } from "./types";
