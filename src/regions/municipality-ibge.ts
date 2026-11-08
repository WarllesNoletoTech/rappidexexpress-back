/**
 * Municípios: API pública do IBGE. Os bairros continuam vindo do OpenStreetMap,
 * mas o limite municipal do IBGE evita importar nomes de municípios vizinhos.
 */
export type IbgeMunicipality = {
  id: number; nome: string;
  microrregiao?: {mesorregiao?: {UF?: {sigla?: string}}};
  'regiao-imediata'?: {'regiao-intermediaria'?: {UF?: {sigla?: string}}};
};
export type MunicipalBoundary = {
  boundingbox: [number,number,number,number]; // sul, norte, oeste, leste
  polygons: number[][][][]; // MultiPolygon [polygon [ring [lon,lat]]]
};

const normalize = (s: unknown): string => String(s||'').normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();

export function ibgeState(m: IbgeMunicipality): string {
  return m?.['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla || m?.microrregiao?.mesorregiao?.UF?.sigla || '';
}

export function findIbgeMunicipalities(input: unknown, query: string, uf: string) {
  if (!Array.isArray(input)) return [];
  const search = normalize(query.split(',')[0]);
  const state = String(uf || '').trim().toUpperCase();
  if (!search || !state) return [];
  return (input as IbgeMunicipality[])
    .filter(m => Number.isSafeInteger(Number(m?.id)) && /^\d{7}$/.test(String(m.id)) &&
      (ibgeState(m) === state || !ibgeState(m)) && normalize(m.nome).includes(search))
    .slice(0,20)
    .map(m=>({id: `I${m.id}`, name: m.nome, state, label:`${m.nome} — ${state} (IBGE)`}));
}

function geometryPolygons(input: any): number[][][][] {
  if (!input || typeof input !== 'object') return [];
  if (input.type === 'FeatureCollection') return (input.features || []).flatMap(geometryPolygons);
  if (input.type === 'Feature') return geometryPolygons(input.geometry);
  if (input.type === 'Polygon') return [input.coordinates];
  if (input.type === 'MultiPolygon') return input.coordinates;
  return [];
}

export function municipalBoundaryFromGeoJson(input: unknown): MunicipalBoundary | null {
  const polygons = geometryPolygons(input);
  if (!polygons.length) return null;
  let south=Infinity,north=-Infinity,west=Infinity,east=-Infinity, count=0;
  for (const polygon of polygons) for (const ring of polygon) for (const coordinate of ring) {
    if (!Array.isArray(coordinate) || coordinate.length < 2) return null;
    const [lon,lat] = coordinate;
    if (!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lat)>90||Math.abs(lon)>180) return null;
    south=Math.min(south,lat);north=Math.max(north,lat);
    west=Math.min(west,lon);east=Math.max(east,lon);count++;
  }
  if (count<4 || south>=north || west>=east) return null;
  return {boundingbox:[south,north,west,east],polygons};
}

function inRing(lon:number,lat:number,ring:number[][]): boolean {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const [xi,yi]=ring[i], [xj,yj]=ring[j];
    if ((yi>lat)!==(yj>lat) && lon<(xj-xi)*(lat-yi)/(yj-yi)+xi) inside=!inside;
  }
  return inside;
}
export function isWithinMunicipalBoundary(lon:number,lat:number,boundary:MunicipalBoundary): boolean {
  if(!Number.isFinite(lon)||!Number.isFinite(lat))return false;
  const [s,n,w,e]=boundary.boundingbox;
  if(lat<s||lat>n||lon<w||lon>e)return false;
  return boundary.polygons.some(polygon=>polygon.length>0 && inRing(lon,lat,polygon[0]) &&
    !polygon.slice(1).some(hole=>inRing(lon,lat,hole)));
}

export function filterElementsToMunicipality(elements: unknown, boundary:MunicipalBoundary): any[] {
  if (!Array.isArray(elements)) return [];
  return elements.filter(element=>{
    const lat=Number(element?.lat ?? element?.center?.lat);
    const lon=Number(element?.lon ?? element?.center?.lon);
    return isWithinMunicipalBoundary(lon,lat,boundary);
  });
}
