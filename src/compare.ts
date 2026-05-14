import maplibregl, { Map, Marker } from 'maplibre-gl';
import yaml from 'js-yaml';
import 'maplibre-gl/dist/maplibre-gl.css';
import factionsYaml from '../data/factions.yaml?raw';

interface BaseDef {
  id: string;
  name: string;
  tiles: string[];
  attribution: string;
  maxzoom: number;
}

const BASES: BaseDef[] = [
  {
    id: 'opentopomap',
    name: 'OpenTopoMap',
    tiles: [
      'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
      'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
      'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
    ],
    attribution: '© OSM, SRTM | © OpenTopoMap (CC-BY-SA)',
    maxzoom: 17,
  },
  {
    id: 'esri-shaded',
    name: 'Esri World Shaded Relief',
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
    ],
    attribution: '© Esri',
    maxzoom: 13,
  },
  {
    id: 'esri-physical',
    name: 'Esri World Physical Map',
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}',
    ],
    attribution: '© Esri',
    maxzoom: 8,
  },
  {
    id: 'esri-terrain',
    name: 'Esri World Terrain Base',
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}',
    ],
    attribution: '© Esri',
    maxzoom: 13,
  },
  {
    id: 'osm',
    name: 'OpenStreetMap',
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    attribution: '© OpenStreetMap contributors',
    maxzoom: 19,
  },
  {
    id: 'carto-voyager',
    name: 'CartoDB Voyager NoLabels',
    tiles: [
      'https://a.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png',
      'https://b.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png',
      'https://c.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png',
      'https://d.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png',
    ],
    attribution: '© OSM © CARTO',
    maxzoom: 19,
  },
];

interface Faction {
  id: string;
  name_ko: string;
  category: string;
  base: { coords: [number, number] };
}
const data = yaml.load(factionsYaml) as { factions: Faction[] };
const factions = data.factions;

const grid = document.getElementById('compare-grid')!;
const maps: Map[] = [];
const markersByMap = new globalThis.Map<Map, Marker[]>();

for (const base of BASES) {
  const cell = document.createElement('div');
  cell.className = 'compare-cell';

  const mapDiv = document.createElement('div');
  mapDiv.className = 'compare-map sepia';
  mapDiv.id = `map-${base.id}`;
  cell.appendChild(mapDiv);

  const label = document.createElement('div');
  label.className = 'compare-label';
  label.textContent = base.name;
  cell.appendChild(label);

  grid.appendChild(cell);

  const map = new Map({
    container: mapDiv,
    style: buildStyle(base, false),
    center: [108, 34],
    zoom: 3.0,
    minZoom: 1,
    maxZoom: 8,
    attributionControl: false,
  });

  map.addControl(
    new maplibregl.AttributionControl({ compact: true, customAttribution: base.attribution }),
  );

  maps.push(map);
  markersByMap.set(map, []);
}

function buildStyle(base: BaseDef, hillshade: boolean): any {
  const sources: any = {
    base: {
      type: 'raster',
      tiles: base.tiles,
      tileSize: 256,
      maxzoom: base.maxzoom,
      attribution: base.attribution,
    },
  };
  const layers: any[] = [
    {
      id: 'base',
      type: 'raster',
      source: 'base',
      paint: { 'raster-opacity': 1.0 },
    },
  ];
  if (hillshade) {
    sources.terrain = {
      type: 'raster-dem',
      tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
      encoding: 'terrarium',
      tileSize: 256,
      maxzoom: 15,
    };
    layers.push({
      id: 'hillshade',
      type: 'hillshade',
      source: 'terrain',
      paint: {
        'hillshade-shadow-color': '#2a1a0c',
        'hillshade-highlight-color': '#fff5d8',
        'hillshade-exaggeration': 0.7,
      },
    });
  }
  return { version: 8, sources, layers };
}

// ─── Mouse sync ───
let syncing = false;
for (const m of maps) {
  m.on('move', () => {
    if (syncing) return;
    syncing = true;
    const center = m.getCenter();
    const zoom = m.getZoom();
    const bearing = m.getBearing();
    const pitch = m.getPitch();
    for (const other of maps) {
      if (other !== m) {
        other.jumpTo({ center, zoom, bearing, pitch });
      }
    }
    syncing = false;
  });
}

// ─── Toggles ───
const sepiaToggle = document.getElementById('sepia-toggle') as HTMLInputElement;
const hillshadeToggle = document.getElementById('hillshade-toggle') as HTMLInputElement;
const markersToggle = document.getElementById('markers-toggle') as HTMLInputElement;

sepiaToggle.addEventListener('change', () => {
  document.querySelectorAll<HTMLElement>('.compare-map').forEach((el) => {
    el.classList.toggle('sepia', sepiaToggle.checked);
  });
});

hillshadeToggle.addEventListener('change', () => {
  for (let i = 0; i < BASES.length; i++) {
    maps[i].setStyle(buildStyle(BASES[i], hillshadeToggle.checked));
  }
  // 마커는 setStyle하면 사라지므로 다시 그림
  setTimeout(() => {
    if (markersToggle.checked) renderAllMarkers();
  }, 300);
});

markersToggle.addEventListener('change', () => {
  if (markersToggle.checked) {
    renderAllMarkers();
  } else {
    for (const [, markers] of markersByMap) {
      for (const m of markers) m.remove();
    }
    for (const key of markersByMap.keys()) markersByMap.set(key, []);
  }
});

function renderAllMarkers() {
  for (const map of maps) {
    const existing = markersByMap.get(map) ?? [];
    for (const m of existing) m.remove();
    const fresh: Marker[] = [];
    for (const f of factions) {
      const el = document.createElement('div');
      el.className = 'compare-marker';
      const [lat, lon] = f.base.coords;
      const marker = new Marker({ element: el }).setLngLat([lon, lat]).addTo(map);
      fresh.push(marker);
    }
    markersByMap.set(map, fresh);
  }
}
