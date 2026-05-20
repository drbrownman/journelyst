// ============================================================
//  GLOBAL STATE & SETTINGS
// ============================================================

const SETTINGS = {
  tripGapHours: 48,
  minTripHours: 5,
  homeRadiusM: 500,
  minFrequentVisits: 3,
  maxLocalTripRadiusKm: 30,
  pathColor: '#4fffb0',
  pathWidth: 5,
  flightColor: '#a0a0a0',
  flightWidth: 5,
  clusterMode: false,
  clusterCriterion: 'year', // 'year', 'region', 'season'
  filterByMapBounds: false,
  maxTripDays: 60,
  maxDistanceBetweenStopsKm: 1000,
  minVisitProbability: 0.25,
  minActivityProbability: 0.25,
  markerColor: '#4fffb0',
  markerIcon: 'fa-location-dot',
  markerSize: 'medium',
  tripsViewMode: 'regular'
};

let rawData = []; // all uploaded records
let allVisits = [];
let allActivities = [];
let allPaths = [];
let allTrips = [];
let filteredTrips = [];
let homeLocations = []; // detected frequent locations [Home, Work]
let currentTrip = null;
let currentTripIdx = -1;
let currentTripId = null;
let renamingTripIdx = -1;
let customTripRanges = [];
let shareTarget = null; // 'all' or trip index
let mergeSelected = [];
let timelinePlaying = false;
let timelineTimer = null;
let timelinePos = 0;
let tripLayers = []; // leaflet layers for current trip
let tileLayer = null;
let currentSpTab = 'overview';
let currentAdvTab = 'trips-data';

// Leaflet map instance layers
let map;
let mapMarkers;
let mapPaths;
let mapFlights;

// ============================================================
//  BOUNDING BOXES (simplified world regions)
// ============================================================
const REGIONS = [];

// ============================================================
//  BASEMAP CONFIGURATIONS
// ============================================================
const BASEMAPS = [
  {
    "name": "Dark",
    "url": "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    "attr": "&copy; <a href=\"https://www.openstreetmap.org/copyright\" target=\"_blank\">OpenStreetMap</a> contributors &copy; <a href=\"https://carto.com/attributions\" target=\"_blank\">CARTO</a>",
    "color": "#1a1a2e"
  },
  {
    "name": "Light",
    "url": "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    "attr": "&copy; <a href=\"https://www.openstreetmap.org/copyright\" target=\"_blank\">OpenStreetMap</a> contributors &copy; <a href=\"https://carto.com/attributions\" target=\"_blank\">CARTO</a>",
    "color": "#f0ece3"
  },
  {
    "name": "Satellite",
    "url": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    "attr": "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
    "color": "#2c4c38"
  },
  {
    "name": "Voyager",
    "url": "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    "attr": "&copy; <a href=\"https://www.openstreetmap.org/copyright\" target=\"_blank\">OpenStreetMap</a> contributors &copy; <a href=\"https://carto.com/attributions\" target=\"_blank\">CARTO</a>",
    "color": "#ebe3d5"
  },
  {
    "name": "OpenStreetMap",
    "url": "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    "attr": "&copy; <a href=\"https://www.openstreetmap.org/copyright\" target=\"_blank\">OpenStreetMap</a> contributors",
    "color": "#aad3df"
  },
  {
    "name": "Topo",
    "url": "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    "attr": "Map data: &copy; <a href=\"https://www.openstreetmap.org/copyright\" target=\"_blank\">OpenStreetMap</a> contributors, <a href=\"http://viewfinderpanoramas.org\" target=\"_blank\">SRTM</a> | Map style: &copy; <a href=\"https://opentopomap.org\" target=\"_blank\">OpenTopoMap</a> (<a href=\"https://creativecommons.org/licenses/by-sa/3.0/\" target=\"_blank\">CC-BY-SA</a>)",
    "color": "#a7b896"
  },
  {
    "name": "Alidade Smooth",
    "url": "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png",
    "attr": '&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>', 
    "color": "#e3e3e3"
  },
  {
    "name": "Alidade Dark",
    "url": "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
    "attr": '&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>', 
    "color": "#212529"
  },
  {
    "name": "Alidade Satellite",
    "url": "https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}.jpg",
    "attr": '&copy; CNES, Distribution Airbus DS, &copy; Airbus DS, &copy; PlanetObserver (Contains Copernicus Data) | &copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>', 
    "color": "#2b3e2b"
  },
  {
    "name": "Stadia",
    "url": "https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}{r}.png",
    "attr": '&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>', 
    "color": "#f4eedb"
  },
  {
    "name": "Toner",
    "url": "https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}{r}.png",
    "attr": '&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>', 
    "color": "#ffffff"
  },
  {
    "name": "Terrain",
    "url": "https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png",
    "attr": '&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>', 
    "color": "#cfd2be"
  },
  {
    "name": "Watercolor",
    "url": "https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg",
    "attr": '&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>', 
    "color": "#d3a297"
  },
  {
    "name": "Bright",
    "url": "https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png",
    "attr": '&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>', 
    "color": "#f7f4eb"
  },
  {
    "name": "Pioneer",
    "url": "https://api.thunderforest.com/pioneer/{z}/{x}/{y}.png?apikey=BYOK",
    "attr": "Maps &copy; <a href=\"http://www.thunderforest.com/\">Thunderforest</a>, Data &copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap contributors</a>",
    "color": "#e1ddcc"
  },
  {
    "name": "OpenCycleMap",
    "url": "https://api.thunderforest.com/cycle/{z}/{x}/{y}.png?apikey=BYOK",
    "attr": "Maps &copy; <a href=\"http://www.thunderforest.com/\">Thunderforest</a>, Data &copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap contributors</a>",
    "color": "#d3ecd3"
  },
  {
    "name": "Transport",
    "url": "https://api.thunderforest.com/transport/{z}/{x}/{y}.png?apikey=BYOK",
    "attr": "Maps &copy; <a href=\"http://www.thunderforest.com/\">Thunderforest</a>, Data &copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap contributors</a>",
    "color": "#e7edf3"
  },
  {
    "name": "Landscape",
    "url": "https://api.thunderforest.com/landscape/{z}/{x}/{y}.png?apikey=BYOK",
    "attr": "Maps &copy; <a href=\"http://www.thunderforest.com/\">Thunderforest</a>, Data &copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap contributors</a>",
    "color": "#cbe1c7"
  },
  {
    "name": "Outdoors",
    "url": "https://api.thunderforest.com/outdoors/{z}/{x}/{y}.png?apikey=BYOK",
    "attr": "Maps &copy; <a href=\"http://www.thunderforest.com/\">Thunderforest</a>, Data &copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap contributors</a>",
    "color": "#dceada"
  },
  {
    "name": "Transport Dark",
    "url": "https://api.thunderforest.com/transport-dark/{z}/{x}/{y}.png?apikey=BYOK",
    "attr": "Maps &copy; <a href=\"http://www.thunderforest.com/\">Thunderforest</a>, Data &copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap contributors</a>",
    "color": "#1c2833"
  },
  {
    "name": "Spinal Map",
    "url": "https://api.thunderforest.com/spinal-map/{z}/{x}/{y}.png?apikey=BYOK",
    "attr": "Maps &copy; <a href=\"http://www.thunderforest.com/\">Thunderforest</a>, Data &copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap contributors</a>",
    "color": "#3c1212"
  },
  {
    "name": "Mobile Atlas",
    "url": "https://api.thunderforest.com/mobile-atlas/{z}/{x}/{y}.png?apikey=BYOK",
    "attr": "Maps &copy; <a href=\"http://www.thunderforest.com/\">Thunderforest</a>, Data &copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap contributors</a>",
    "color": "#faf4ea"
  },
  {
    "name": "Neighbourhood",
    "url": "https://api.thunderforest.com/neighbourhood/{z}/{x}/{y}.png?apikey=BYOK",
    "attr": "Maps &copy; <a href=\"http://www.thunderforest.com/\">Thunderforest</a>, Data &copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap contributors</a>",
    "color": "#e9f5e9"
  },
  {
    "name": "Atlas",
    "url": "https://api.thunderforest.com/atlas/{z}/{x}/{y}.png?apikey=BYOK",
    "attr": "Maps &copy; <a href=\"http://www.thunderforest.com/\">Thunderforest</a>, Data &copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap contributors</a>",
    "color": "#f5efdf"
  },
  {
    "name": "IceAge",
    "url": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}",
    "attr": "Tiles &copy; Esri &mdash; Source: USGS, Esri, TANA, DeLorme, and NPS",
    "color": "#a5c1d6"
  },
  {
    "name": "MillennialPink",
    "url": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}",
    "attr": "Tiles &copy; Esri &mdash; Source: Esri",
    "color": "#ffd1dc"
  },
  {
    "name": "Wikimedia",
    "url": "https://maps.wikimedia.org/osm-intl/{z}/{x}/{y}{r}.png",
    "attr": "<a href=\"https://wikimediafoundation.org/wiki/Maps_Terms_of_Use\">Wikimedia</a>",
    "color": "#f3f3f3"
  }
];

let currentBasemap = 0;
let overviewBasemap = 0;
let showStarredOnly = false;
