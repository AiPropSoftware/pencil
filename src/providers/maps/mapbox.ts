/**
 * Mapbox is loaded on demand to keep landing-page bundle slim and to allow the
 * page to render gracefully when no token is configured.
 */
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

export const mapStyle = "mapbox://styles/mapbox/light-v11";

export const DEFAULT_CENTER: [number, number] = [-97.7431, 30.2672]; // Austin
export const DEFAULT_ZOOM = 11.5;
