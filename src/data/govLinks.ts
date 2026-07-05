/**
 * One-click government resources per city: where to apply for permits, read
 * the zoning code, and open the parcel/GIS viewer. Major metros link straight
 * to their official city/county portals; everywhere else falls back to a
 * targeted web search so the buttons always work.
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
  Miami: {
    permits: "https://www.miami.gov/Permits-Construction/Apply-for-or-Manage-Building-Permits-iBuild",
    zoning: "https://www.miami21.org/",
    gis: "https://www.miamidade.gov/Apps/PA/propertysearch/",
  },
  "Los Angeles": {
    permits: "https://www.ladbs.org/",
    zoning: "https://zimas.lacity.org/",
    gis: "https://portal.assessor.lacounty.gov/",
  },
  "San Diego": {
    permits: "https://www.sandiego.gov/development-services",
    zoning: "https://www.sandiego.gov/development-services/zoning",
    gis: "https://www.sangis.org/",
  },
  "San Jose": {
    permits: "https://www.sanjoseca.gov/business/development-services-permit-center",
    zoning: "https://www.sanjoseca.gov/your-government/departments-offices/planning-building-code-enforcement/planning-division/zoning-ordinance",
    gis: "https://www.sccassessor.org/",
  },
  Sacramento: {
    permits: "https://www.cityofsacramento.gov/community-development/building",
    zoning: "https://www.cityofsacramento.gov/community-development/planning",
    gis: "https://assessor.saccounty.gov/",
  },
  Oakland: {
    permits: "https://www.oaklandca.gov/topics/permits",
    zoning: "https://www.oaklandca.gov/topics/zoning-map",
    gis: "https://www.acgov.org/assessor/",
  },
  Houston: {
    permits: "https://www.houstonpermittingcenter.org/",
    zoning: "https://www.houstontx.gov/planning/DevelopRegs/",
    gis: "https://hcad.org/",
  },
  Dallas: {
    permits: "https://dallascityhall.com/departments/sustainabledevelopment/buildinginspection/Pages/default.aspx",
    zoning: "https://dallascityhall.com/departments/sustainabledevelopment/planning/Pages/default.aspx",
    gis: "https://www.dallascad.org/",
  },
  "Fort Worth": {
    permits: "https://www.fortworthtexas.gov/departments/development-services",
    zoning: "https://www.fortworthtexas.gov/departments/development-services/zoning",
    gis: "https://www.tad.org/",
  },
  "San Antonio": {
    permits: "https://www.sanantonio.gov/DSD",
    zoning: "https://www.sanantonio.gov/DSD/Online/Zoning",
    gis: "https://www.bcad.org/",
  },
  Phoenix: {
    permits: "https://www.phoenix.gov/pdd",
    zoning: "https://www.phoenix.gov/pdd/pz",
    gis: "https://mcassessor.maricopa.gov/",
  },
  Denver: {
    permits: "https://www.denvergov.org/Government/Agencies-Departments-Offices/Agencies-Departments-Offices-Directory/Community-Planning-and-Development/Building-Permits",
    zoning: "https://www.denvergov.org/Government/Agencies-Departments-Offices/Agencies-Departments-Offices-Directory/Community-Planning-and-Development/Zoning",
    gis: "https://www.denvergov.org/property",
  },
  Portland: {
    permits: "https://www.portland.gov/ppd",
    zoning: "https://www.portland.gov/code/33",
    gis: "https://www.portlandmaps.com/",
  },
  Boston: {
    permits: "https://www.boston.gov/departments/inspectional-services",
    zoning: "https://www.bostonplans.org/zoning",
    gis: "https://www.cityofboston.gov/assessing/search/",
  },
  Washington: {
    permits: "https://dob.dc.gov/",
    zoning: "https://dcoz.dc.gov/",
    gis: "https://propertyquest.dc.gov/",
  },
  Atlanta: {
    permits: "https://www.atlantaga.gov/government/departments/city-planning/office-of-buildings",
    zoning: "https://www.atlantaga.gov/government/departments/city-planning/office-of-zoning-development",
    gis: "https://www.fultonassessor.org/",
  },
  Philadelphia: {
    permits: "https://www.phila.gov/departments/department-of-licenses-and-inspections/",
    zoning: "https://atlas.phila.gov/",
    gis: "https://property.phila.gov/",
  },
  Charlotte: {
    permits: "https://www.charlottenc.gov/Growth-and-Development",
    zoning: "https://charlotteudo.org/",
    gis: "https://polaris3g.mecklenburgcountync.gov/",
  },
  Raleigh: {
    permits: "https://raleighnc.gov/permits",
    zoning: "https://raleighnc.gov/zoning",
    gis: "https://maps.raleighnc.gov/iMAPS/",
  },
  Tampa: {
    permits: "https://www.tampa.gov/construction-services",
    zoning: "https://www.tampa.gov/planning",
    gis: "https://www.hcpafl.org/",
  },
  Orlando: {
    permits: "https://www.orlando.gov/Building-Development",
    zoning: "https://www.orlando.gov/Building-Development/Zoning",
    gis: "https://ocpaweb.ocpafl.org/",
  },
  Jacksonville: {
    permits: "https://www.jacksonville.gov/departments/building-inspection-division",
    zoning: "https://www.jacksonville.gov/departments/planning-and-development",
    gis: "https://paopropertysearch.coj.net/",
  },
  "Fort Lauderdale": {
    permits: "https://www.fortlauderdale.gov/departments/development-services",
    zoning: "https://www.fortlauderdale.gov/departments/development-services/urban-design-and-planning",
    gis: "https://web.bcpa.net/",
  },
  "Las Vegas": {
    permits: "https://www.lasvegasnevada.gov/Business/Permits",
    zoning: "https://www.lasvegasnevada.gov/Government/Planning-Zoning",
    gis: "https://www.clarkcountynv.gov/government/assessor/",
  },
  "Salt Lake City": {
    permits: "https://www.slc.gov/buildingservices/",
    zoning: "https://www.slc.gov/planning/",
    gis: "https://slco.org/assessor/",
  },
  Minneapolis: {
    permits: "https://www.minneapolismn.gov/business-services/licenses-permits-inspections/",
    zoning: "https://www.minneapolismn.gov/government/departments/community-planning-economic-development/",
    gis: "https://gis.hennepin.us/property/",
  },
  Detroit: {
    permits: "https://detroitmi.gov/departments/buildings-safety-engineering-and-environmental-department",
    zoning: "https://detroitmi.gov/departments/city-planning-commission",
    gis: "https://detroitmi.gov/webapp/parcel-viewer",
  },
  Columbus: {
    permits: "https://www.columbus.gov/bzs/",
    zoning: "https://www.columbus.gov/bzs/zoning/",
    gis: "https://www.franklincountyauditor.com/",
  },
  Indianapolis: {
    permits: "https://www.indy.gov/agency/department-of-business-and-neighborhood-services",
    zoning: "https://www.indy.gov/activity/zoning-cases-and-hearings",
    gis: "https://maps.indy.gov/MapIndy/",
  },
  "Kansas City": {
    permits: "https://www.kcmo.gov/city-hall/departments/city-planning-development",
    zoning: "https://www.kcmo.gov/city-hall/departments/city-planning-development/zoning",
    gis: "https://www.jacksongov.org/",
  },
  "St. Louis": {
    permits: "https://www.stlouis-mo.gov/government/departments/public-safety/building/permits/",
    zoning: "https://www.stlouis-mo.gov/government/departments/planning/zoning/",
    gis: "https://www.stlouis-mo.gov/data/address-search/",
  },
  "New Orleans": {
    permits: "https://onestopapp.nola.gov/",
    zoning: "https://czo.nola.gov/",
    gis: "https://property.nola.gov/",
  },
  "Oklahoma City": {
    permits: "https://www.okc.gov/departments/development-services",
    zoning: "https://www.okc.gov/departments/planning",
    gis: "https://www.oklahomacounty.org/193/Assessor",
  },
  Milwaukee: {
    permits: "https://city.milwaukee.gov/DNS/permits",
    zoning: "https://city.milwaukee.gov/DCD/Planning",
    gis: "https://maps.milwaukee.gov/",
  },
  Baltimore: {
    permits: "https://dhcd.baltimorecity.gov/permits",
    zoning: "https://codemap.baltimorecity.gov/",
    gis: "https://sdat.dat.maryland.gov/RealProperty/",
  },
  Pittsburgh: {
    permits: "https://pittsburghpa.gov/pli/",
    zoning: "https://pittsburghpa.gov/dcp/zoning",
    gis: "https://realestate.alleghenycounty.us/",
  },
  Cleveland: {
    permits: "https://www.clevelandohio.gov/city-hall/departments/building-housing",
    zoning: "https://planning.clevelandohio.gov/",
    gis: "https://myplace.cuyahogacounty.gov/",
  },
  Cincinnati: {
    permits: "https://www.cincinnati-oh.gov/buildings/",
    zoning: "https://www.cincinnati-oh.gov/planning/",
    gis: "https://www.hamiltoncountyauditor.org/",
  },
  Honolulu: {
    permits: "https://www.honolulu.gov/dpp",
    zoning: "https://www.honolulu.gov/dpp/planning",
    gis: "https://www.realpropertyhonolulu.com/",
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
