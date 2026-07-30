import os
import tempfile
import json
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from calculator import calcular_adubacao, TABELA_CULTURAS
from geospatial_engine import processar_kml_para_shapefile

app = FastAPI(title="TerraImagem - Recomendação Agronômica e Precisão", version="1.1.0")

class CalculoRequest(BaseModel):
    cultura: str
    expectativa: float
    formulado: str

@app.get("/api/culturas")
def get_culturas():
    return {"culturas": list(TABELA_CULTURAS.keys())}

@app.post("/api/calcular")
def api_calcular(req: CalculoRequest):
    try:
        resultado = calcular_adubacao(
            cultura=req.cultura,
            expectativa_sacos=req.expectativa,
            formulado_str=req.formulado
        )
        return resultado
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/gerar-shapefile")
async def api_gerar_shapefile(
    file: UploadFile = File(...),
    cultura: str = Form(...),
    expectativa: float = Form(...),
    formulado: str = Form(...),
    nome_talhao: str = Form("Talhao_1")
):
    if not file.filename.lower().endswith(".kml"):
        raise HTTPException(status_code=400, detail="Por favor, envie um arquivo com extensão .KML")
        
    try:
        # 1. Salvar o arquivo KML temporariamente
        temp_dir = tempfile.mkdtemp()
        kml_path = os.path.join(temp_dir, file.filename)
        with open(kml_path, "wb") as f:
            content = await file.read()
            f.write(content)
            
        # 2. Executar o cálculo agronômico
        dados_calculo = calcular_adubacao(
            cultura=cultura,
            expectativa_sacos=expectativa,
            formulado_str=formulado
        )
        
        # 3. Processar KML, projetar para SIRGAS 2000 UTM e gerar Shapefile ZIP
        zip_path, area_ha, epsg_utm = processar_kml_para_shapefile(
            kml_path=kml_path,
            dados_calculo=dados_calculo,
            nome_talhao=nome_talhao
        )
        
        filename = f"Recomendacao_{nome_talhao}.zip"
        return FileResponse(
            path=zip_path,
            filename=filename,
            media_type="application/zip",
            headers={
                "X-Area-Hectares": str(area_ha),
                "X-EPSG-Utm": str(epsg_utm)
            }
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

# Servir arquivos estáticos
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def read_root():
    index_path = os.path.join(static_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Bem-vindo à API do TerraImagem."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
