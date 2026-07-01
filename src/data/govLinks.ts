/**
 * One-click government resources per city: where to apply for permits, read
 * the zoning code, and open the parcel/GIS viewer. Live-feed cities get their
 * official portals; everywhere else falls back to a targeted web search so
 * the buttons always work.
 */
export interface GovLinks {
  permits: string;
  zoning: string;
  gis?: string;
}

const CITY_GOV: Record<string, GovLinks> = {
  Austin: {
    permits: "https://abc.austintexas.gov/",
    zoning: "https://www.austintexas.gov/department/zoning",
    gis: "https://maps.austintexas.gov/GIS/PropertyProfile/",
  },
  Chicago: {
    permits: "https://www.chicago.gov/city/en/depts/bldgs/provdrs/permits.html",
    zoning: "https://gisapps.chicago.gov/ZoningMapWeb/",
    gis: "https://gisapps.chicago.gov/ChicagoCityscape/",
  },
  Seattle: {
    permits: "https://www.seattle.gov/sdci/permits",
    zoning: "https://www.seattle.gov/sdci/codes/zoning",
    gis: "https://seattlecitygis.maps.arcgis.com/",
  },
  "San Francisco": {
    permits: "https://www.sf.gov/departments/department-building-inspection",
    zoning: "https://sfplanning.org/zoning",
    gis: "https://sfplanninggis.org/pim/",
  },
  Nashville: {
    permits: "https://epermits.nashville.gov/",
    zoning: "https://www.nashville.gov/departments/planning/land-development/zoning",
    gis: "https://maps.nashville.gov/ParcelViewer/",
  },
  "New York": {
    permits: "https://a810-dobnow.nyc.gov/publish/Index.html",
    zoning: "https://zola.planning.nyc.gov/",
    gis: "https://zola.planning.nyc.gov/",
  },
};

export function govLinksFor(city: string, state: string): GovLinks & { official: boolean } {
  const g = CITY_GOV[city];
  if (g) return { ...g, official: true };
  const q = (s: string) => `https://www.google.com/search?q=${encodeURIComponent(`${city} ${state} ${s}`)}`;
  return {
    permits: q("building permit application portal"),
    zoning: q("zoning code map"),
    gis: q("county parcel GIS viewer"),
    official: false,
  };
}
