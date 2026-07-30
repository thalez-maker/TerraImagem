import os
import re
import zipfile
import tempfile
import xml.etree.ElementTree as ET
import geopandas as gpd
from shapely.geometry import Polygon, MultiPolygon
from pyproj import CRS

def get_utm_epsg(lon: float) -> int:
    """
    Determina o código EPSG de SIRGAS 2000 UTM Hemisfério Sul com base na longitude.
    Exemplo: Longitude -51° -> EPSG:31982 (Zone 22S), Longitude -55° -> EPSG:31981 (Zone 21S).
    """
    zone = int((lon + 180) / 6) + 1
    return 31960 + zone

def parse_kml_geometry(kml_path: str):
    """
    Lê a geometria (Polygon/MultiPolygon) de um arquivo KML.
    Tenta primeiramente via GeoPandas/Fiona e possui fallback via XML parser.
    """
    # 1. Tentar leitura nativa via GeoPandas
    try:
        import fiona
        fiona.drvsupport.supported_drivers['KML'] = 'rw'
        fiona.drvsupport.supported_drivers['LIBKML'] = 'rw'
        gdf = gpd.read_file(kml_path)
        if not gdf.empty:
            # Filtrar geometrias de polígono
            polys = [geom for geom in gdf.geometry if geom is not None and geom.geom_type in ['Polygon', 'MultiPolygon']]
            if polys:
                return gpd.GeoDataFrame(geometry=polys, crs="EPSG:4326")
    except Exception:
        pass

    # 2. Fallback via ElementTree para extrair <coordinates>
    tree = ET.parse(kml_path)
    root = tree.getroot()
    
    # Remover namespaces se existirem
    for elem in root.iter():
        if '}' in elem.tag:
            elem.tag = elem.tag.split('}', 1)[1]
            
    polygons = []
    for coord_elem in root.iter('coordinates'):
        text = coord_elem.text
        if not text:
            continue
        coords = []
        for token in text.strip().split():
            parts = token.split(',')
            if len(parts) >= 2:
                try:
                    lon = float(parts[0])
                    lat = float(parts[1])
                    coords.append((lon, lat))
                except ValueError:
                    continue
        if len(coords) >= 3:
            # Fechar o anel se necessário
            if coords[0] != coords[-1]:
                coords.append(coords[0])
            poly = Polygon(coords)
            if poly.is_valid and not poly.is_empty:
                polygons.append(poly)
                
    if not polygons:
        raise ValueError("Nenhum polígono válido de talhão foi encontrado no arquivo KML enviado.")
        
    return gpd.GeoDataFrame(geometry=polygons, crs="EPSG:4326")

def processar_kml_para_shapefile(kml_path: str, dados_calculo: dict, nome_talhao: str = "Talhao_1"):
    """
    Processa o arquivo KML, calcula a área em hectares, projeta para SIRGAS 2000 UTM,
    atribui os dados de recomendação de adubação e gera o pacote ZIP do Shapefile.
    """
    # 1. Obter GeoDataFrame no CRS WGS84 (EPSG:4326)
    gdf = parse_kml_geometry(kml_path)
    
    # 2. Determinar a longitude central e o CRS SIRGAS 2000 UTM correspondente
    centroid_lon = float(gdf.geometry.bounds[['minx', 'maxx']].mean(axis=1).mean())
    epsg_utm = get_utm_epsg(centroid_lon)
    
    # 3. Reprojetar para SIRGAS 2000 UTM
    gdf_utm = gdf.to_crs(epsg=epsg_utm)
    
    # 4. Calcular área total do talhão em hectares
    area_m2 = gdf_utm.geometry.area.sum()
    area_ha = round(area_m2 / 10000.0, 2)
    
    # Extrair valores do cálculo agronômico
    manut = dados_calculo["detalhes"]["manutencao"]
    repo = dados_calculo["detalhes"]["reposicao"]
    
    # 5. Preencher Tabela de Atributos do Shapefile (nomes de colunas limitados a 10 caracteres)
    gdf_utm['ID_TALHAO'] = str(nome_talhao)
    gdf_utm['AREA_HA'] = float(area_ha)
    gdf_utm['CULTURA'] = str(dados_calculo['cultura'])
    gdf_utm['EXP_SACOS'] = float(dados_calculo['expectativa_sacos'])
    gdf_utm['FORMULADO'] = str(dados_calculo['formulado'])
    
    # Manutenção
    gdf_utm['P_MAN_KG'] = float(dados_calculo['p2o5_manutencao_kg'])
    gdf_utm['K_MAN_KG'] = float(dados_calculo['k2o_manutencao_kg'])
    gdf_utm['PROD_MAN'] = float(manut['produto_formulado_kg'])
    gdf_utm['COMP_MAN'] = float(manut['produto_kcl_kg'] if manut['produto_kcl_kg'] > 0 else manut['produto_p_comp_kg'])
    
    # Reposição
    gdf_utm['P_REP_KG'] = float(dados_calculo['p2o5_reposicao_kg'])
    gdf_utm['K_REP_KG'] = float(dados_calculo['k2o_reposicao_kg'])
    gdf_utm['PROD_REP'] = float(repo['produto_formulado_kg'])
    gdf_utm['COMP_REP'] = float(repo['produto_kcl_kg'] if repo['produto_kcl_kg'] > 0 else repo['produto_p_comp_kg'])
    
    # 6. Salvar arquivos do Shapefile em pasta temporária e empacotar em ZIP
    temp_dir = tempfile.mkdtemp()
    base_name = f"Recomendacao_{nome_talhao}"
    shp_path = os.path.join(temp_dir, f"{base_name}.shp")
    
    # Salvar Shapefile via GeoPandas
    gdf_utm.to_file(shp_path, driver='ESRI Shapefile', encoding='utf-8')
    
    # Gerar relatório TXT explicativo dos produtos
    txt_path = os.path.join(temp_dir, "LEIA_ME_RECOMENDACAO.txt")
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(f"=== TERRAIMAGEM - RELATÓRIO DE RECOMENDAÇÃO AGRONÔMICA ===\n")
        f.write(f"Talhão: {nome_talhao}\n")
        f.write(f"Área Total: {area_ha} hectares\n")
        f.write(f"Projeção Cartográfica: SIRGAS 2000 / UTM (EPSG:{epsg_utm})\n")
        f.write(f"Cultura: {dados_calculo['cultura']} | Expectativa: {dados_calculo['expectativa_sacos']} sc/ha\n")
        f.write(f"Formulado N-P-K Utilizado: {dados_calculo['formulado']}\n\n")
        
        f.write(f"--- CENÁRIO 1: MANUTENÇÃO ---\n")
        f.write(f"- Produto Formulado ({dados_calculo['formulado']}): {manut['produto_formulado_kg']} kg/ha\n")
        if manut['produto_kcl_kg'] > 0:
            f.write(f"- Complemento Potássio (KCl 60%): {manut['produto_kcl_kg']} kg/ha\n")
        elif manut['produto_p_comp_kg'] > 0:
            f.write(f"- Complemento Fósforo (Super Triplo 46%): {manut['produto_p_comp_kg']} kg/ha\n")
        else:
            f.write(f"- Complemento: Não necessário (0 kg/ha)\n")
        f.write(f"Nota: {manut['observacao']}\n\n")
        
        f.write(f"--- CENÁRIO 2: REPOSIÇÃO ---\n")
        f.write(f"- Produto Formulado ({dados_calculo['formulado']}): {repo['produto_formulado_kg']} kg/ha\n")
        if repo['produto_kcl_kg'] > 0:
            f.write(f"- Complemento Potássio (KCl 60%): {repo['produto_kcl_kg']} kg/ha\n")
        elif repo['produto_p_comp_kg'] > 0:
            f.write(f"- Complemento Fósforo (Super Triplo 46%): {repo['produto_p_comp_kg']} kg/ha\n")
        else:
            f.write(f"- Complemento: Não necessário (0 kg/ha)\n")
        f.write(f"Nota: {repo['observacao']}\n")

    # Empacotar em ZIP
    zip_path = os.path.join(temp_dir, f"{base_name}.zip")
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for file in os.listdir(temp_dir):
            if file != f"{base_name}.zip":
                full_file_path = os.path.join(temp_dir, file)
                zipf.write(full_file_path, file)
                
    return zip_path, area_ha, epsg_utm
