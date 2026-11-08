import {findIbgeMunicipalities, ibgeState, municipalBoundaryFromGeoJson,
  isWithinMunicipalBoundary,filterElementsToMunicipality} from './municipality-ibge';
import {buildOsmQuery,extractNeighborhoodNames} from './neighborhood-import';

describe('Importação de bairros via IBGE e OpenStreetMap',()=>{
  const ibgeMunicipio={id:1721000,nome:'Palmas',
    'regiao-imediata':{'regiao-intermediaria':{UF:{sigla:'TO'}}}};
  const geojson={type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Polygon',
    coordinates:[[[-48.5,-10.4],[-48.1,-10.4],[-48.1,-10.0],[-48.5,-10.0],[-48.5,-10.4]]]}}]};
  it('seleciona o município pelo código oficial e UF correta',()=>{
    expect(ibgeState(ibgeMunicipio)).toBe('TO');
    expect(findIbgeMunicipalities([ibgeMunicipio],'Palmas, Tocantins, Brasil','TO')[0].id).toBe('I1721000');
    expect(findIbgeMunicipalities([ibgeMunicipio],'Palmas','PA')).toHaveLength(0);
  });
  it('usa a malha municipal para descartar bairros de cidades vizinhas',()=>{
    const boundary=municipalBoundaryFromGeoJson(geojson);
    expect(boundary).not.toBeNull();
    expect(isWithinMunicipalBoundary(-48.3,-10.2,boundary!)).toBe(true);
    expect(isWithinMunicipalBoundary(-48.3,-9.8,boundary!)).toBe(false);
    const results=filterElementsToMunicipality([
      {type:'node',lon:-48.3,lat:-10.2,tags:{name:'Taquaralto'}},
      {type:'node',lon:-48.3,lat:-9.8,tags:{name:'Cidade vizinha'}},
    ],boundary!);
    expect(extractNeighborhoodNames(results,'Palmas')).toEqual(['Taquaralto']);
  });
  it('solicita centro geométrico dos bairros no Overpass',()=>{
    const query=buildOsmQuery({boundingbox:[-10.4,-10,-48.5,-48.1]},'bbox');
    expect(query).toContain('out center;');
    expect(query).toContain('neighbourhood');
  });
});
