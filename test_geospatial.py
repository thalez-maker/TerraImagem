import os
import zipfile
from calculator import calcular_adubacao
from geospatial_engine import processar_kml_para_shapefile

# KML de teste simples em Passo Fundo - RS (Longitude approx -52.4, Latitude approx -28.2)
KML_TEST_CONTENT = """<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Talhao Teste RS</name>
    <Placemark>
      <name>Talhao 01</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              -52.4000,-28.2500,0
              -52.4000,-28.2400,0
              -52.3900,-28.2400,0
              -52.3900,-28.2500,0
              -52.4000,-28.2500,0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>
"""

def test_kml_processing():
    kml_path = "test_talhao.kml"
    with open(kml_path, "w", encoding="utf-8") as f:
        f.write(KML_TEST_CONTENT)
        
    dados_calc = calcular_adubacao("Soja", 60, "05-10-30")
    
    zip_path, area_ha, epsg = processar_kml_para_shapefile(kml_path, dados_calc, nome_talhao="Talhao_Soja_01")
    
    assert os.path.exists(zip_path), "O arquivo ZIP do Shapefile não foi gerado."
    assert area_ha > 0, "A área calculada deve ser maior que zero."
    assert epsg == 31982, f"Esperado EPSG:31982 para longitude -52.4, obtido {epsg}"
    
    with zipfile.ZipFile(zip_path, 'r') as z:
        files = z.namelist()
        assert any(f.endswith('.shp') for f in files), "Shapefile (.shp) faltando no ZIP."
        assert any(f.endswith('.prj') for f in files), "Arquivo de projeção (.prj) faltando no ZIP."
        assert any(f.endswith('.dbf') for f in files), "Tabela de atributos (.dbf) faltando no ZIP."
        assert "LEIA_ME_RECOMENDACAO.txt" in files, "Relatório TXT faltando no ZIP."
        
    print(f"Teste KML e Shapefile concluído com sucesso! Área: {area_ha} ha, Projeção EPSG:{epsg}")
    
    # Limpeza
    if os.path.exists(kml_path):
        os.remove(kml_path)

if __name__ == "__main__":
    test_kml_processing()
