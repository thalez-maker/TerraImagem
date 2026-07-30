# TerraImagem - Tecnologia para Agricultura de Precisão

Plataforma Web Inteligente para cálculo de recomendação agronômica (Fósforo e Potássio) e geração automática de arquivos de aplicação geoespacial (**Shapefile**) projetados em **SIRGAS 2000 UTM**.

## 🚀 Funcionalidades
- **Calculadora Agronômica**: Recomendações de adubação de Manutenção e Reposição para Soja, Milho, Arroz, Trigo, Aveia, Canola, Centeio, Cevada, Feijão e Girassol.
- **Formulados N-P-K**: Cálculo com regra de menor valor para suprimento de nutrientes sem extrapolação e complementação exata via KCl (60%) ou Super Triplo (46%).
- **Agricultura de Precisão (Módulo Geoespacial)**: Leitura de arquivos `.KML`, cálculo automático de área em hectares, reprojeção para **SIRGAS 2000 / UTM** (Fusos 21S e 22S) e exportação de pacotes Shapefile (`.zip`) prontos para monitores de máquinas agrícolas.

## 🛠️ Como Executar Localmente
```bash
# 1. Instalar dependências
pip install -r requirements.txt

# 2. Iniciar o servidor
python main.py
```
Acesse no navegador: `http://127.0.0.1:8000`
