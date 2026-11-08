/** Funções puras para obtenção de bairros via OpenStreetMap. */
export type MunicipalityResult = {
  osm_type?: string;
  osm_id?: number | string;
  display_name?: string;
  name?: string;
  boundingbox?: (string | number)[];
  address?: { state_code?: string; state?: string; city?: string; town?: string; municipality?: string; village?: string };
};

const normalize = (value: unknown) => String(value || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR')
  .replace(/[^a-z0-9]+/g, ' ').trim();
const STATE_CODES: Record<string, string> = {
  acre:'AC', alagoas:'AL', amapa:'AP', amazonas:'AM', bahia:'BA', ceara:'CE',
  'distrito federal':'DF', 'espirito santo':'ES', goias:'GO', maranhao:'MA',
  'mato grosso':'MT', 'mato grosso do sul':'MS', 'minas gerais':'MG', para:'PA',
  paraiba:'PB', parana:'PR', pernambuco:'PE', piaui:'PI', 'rio de janeiro':'RJ',
  'rio grande do norte':'RN', 'rio grande do sul':'RS', rondonia:'RO', roraima:'RR',
  'santa catarina':'SC', 'sao paulo':'SP', sergipe:'SE', tocantins:'TO',
};
export function stateNameFromCode(code: string): string {
  const normalizedCode = String(code || '').trim().toUpperCase();
  return Object.keys(STATE_CODES).find(name => STATE_CODES[name] === normalizedCode) || code;
}
export function chooseMunicipality(input: unknown, city: string, state: string): MunicipalityResult | null {
  if (!Array.isArray(input)) return null;
  const targetCity = normalize(city), targetState = String(state || '').trim().toUpperCase();
  const matches = (input as MunicipalityResult[]).filter(r => {
    if (!r || typeof r !== 'object') return false;
    const candidateCity = r.address?.city || r.address?.town || r.address?.municipality || r.address?.village ||
      r.name || String(r.display_name || '').split(',')[0];
    if (normalize(candidateCity) !== targetCity) return false;
    const code = (r.address?.state_code || '').toUpperCase();
    const fromName = STATE_CODES[normalize(r.address?.state)] || '';
    return !targetState || (!code && !fromName) || code === targetState || fromName === targetState;
  });
  return matches.sort((a,b) => (b.osm_type === 'relation' ? 1 : 0) - (a.osm_type === 'relation' ? 1 : 0))[0] || null;
}

export function buildOsmQuery(region: MunicipalityResult, mode: 'area' | 'bbox'): string | null {
  let location: string;
  if (mode === 'area') {
    if (region.osm_type !== 'relation') return null;
    const id = Number(region.osm_id);
    if (!Number.isSafeInteger(id) || id < 1) return null;
    location = `(area:${id + 3_600_000_000})`;
  } else {
    const bounds = (region.boundingbox || []).map(Number);
    if (bounds.length !== 4 || bounds.some(x => !Number.isFinite(x))) return null;
    const [south,north,west,east] = bounds;
    if (south >= north || west >= east || south < -90 || north > 90 || west < -180 || east > 180 ||
      north-south > 5 || east-west > 5) return null;
    location = `(${south},${west},${north},${east})`;
  }
  const place = '^(neighbourhood|suburb|quarter)$';
  return `[out:json][timeout:25];(node["place"~"${place}"]${location};way["place"~"${place}"]${location};relation["place"~"${place}"]${location};relation["boundary"="administrative"]["admin_level"~"^(9|10)$"]${location};);out tags;`;
}

export function extractNeighborhoodNames(elements: unknown, city: string): string[] {
  if (!Array.isArray(elements)) return [];
  const known = new Set<string>();
  const names: string[] = [];
  const cityKey = normalize(city);
  for (const element of elements) {
    const tags = element?.tags;
    if (!tags || typeof tags !== 'object') continue;
    const name = String(tags['name:pt'] || tags.name || '').trim().replace(/\s+/g,' ');
    const key = normalize(name);
    if (!key || key === cityKey || name.length > 110 || known.has(key)) continue;
    known.add(key); names.push(name);
    if (names.length === 500) break;
  }
  return names.sort((a,b) => a.localeCompare(b,'pt-BR'));
}
