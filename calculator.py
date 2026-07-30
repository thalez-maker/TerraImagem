import re

TABELA_CULTURAS = {
    "Soja": {"p_manut": 15, "p_repo": 14, "k_manut": 25, "k_repo": 20},
    "Milho": {"p_manut": 15, "p_repo": 8, "k_manut": 10, "k_repo": 6},
    "Arroz": {"p_manut": 10, "p_repo": 5, "k_manut": 10, "k_repo": 3},
    "Trigo / Sorgo": {"p_manut": 15, "p_repo": 10, "k_manut": 10, "k_repo": 6},
    "Aveia (Preta / Branca)": {"p_manut": 15, "p_repo": 8, "k_manut": 10, "k_repo": 6},
    "Canola": {"p_manut": 20, "p_repo": 15, "k_manut": 15, "k_repo": 12},
    "Centeio": {"p_manut": 15, "p_repo": 9, "k_manut": 10, "k_repo": 5},
    "Cevada": {"p_manut": 15, "p_repo": 10, "k_manut": 10, "k_repo": 6},
    "Feijão": {"p_manut": 15, "p_repo": 10, "k_manut": 20, "k_repo": 15},
    "Girassol": {"p_manut": 15, "p_repo": 14, "k_manut": 15, "k_repo": 6},
}

def parse_formulado(formulado_str: str):
    """
    Parses a NPK string like '05,30,10', '5-30-10', '00-40-00' into (N, P, K) floats.
    """
    cleaned = formulado_str.strip().replace(' ', '')
    tokens = re.split(r'[-–,;:_]', cleaned)
    if len(tokens) != 3:
        raise ValueError("O formulado deve estar no formato XX-YY-ZZ ou XX,YY,ZZ (ex: 05-30-10)")
    
    n = float(tokens[0].replace(',', '.'))
    p = float(tokens[1].replace(',', '.'))
    k = float(tokens[2].replace(',', '.'))
    return n, p, k

def calcular_adubacao(cultura: str, expectativa_sacos: float, formulado_str: str):
    """
    Realiza o cálculo de adubação de manutenção e reposição para P2O5 e K2O.
    """
    if cultura not in TABELA_CULTURAS:
        raise ValueError(f"Cultura '{cultura}' inválida. Opções disponíveis: {list(TABELA_CULTURAS.keys())}")
    
    n, p, k = parse_formulado(formulado_str)
    
    if p <= 0:
        raise ValueError("A concentração de Fósforo (P2O5) no formulado deve ser maior que zero.")
    
    # 1. Transformar expectativa em toneladas (sc * 60kg / 1000)
    expectativa_ton = (expectativa_sacos * 60.0) / 1000.0
    
    # 2. Obter índices da cultura
    indices = TABELA_CULTURAS[cultura]
    
    # 3. Doses nutricionais necessárias (kg/ha)
    p_manut_dose = expectativa_ton * indices["p_manut"]
    p_repo_dose = expectativa_ton * indices["p_repo"]
    k_manut_dose = expectativa_ton * indices["k_manut"]
    k_repo_dose = expectativa_ton * indices["k_repo"]
    
    p_conc = p / 100.0
    k_conc = k / 100.0
    
    # 4. Cálculo dos produtos (kg/ha)
    resultado = {
        "cultura": cultura,
        "expectativa_sacos": expectativa_sacos,
        "expectativa_ton": expectativa_ton,
        "formulado": f"{int(n):02d}-{int(p):02d}-{int(k):02d}",
        "p2o5_manutencao_kg": round(p_manut_dose, 2),
        "p2o5_reposicao_kg": round(p_repo_dose, 2),
        "k2o_manutencao_kg": round(k_manut_dose, 2),
        "k2o_reposicao_kg": round(k_repo_dose, 2),
        "detalhes": {}
    }
    
    def calc_cenario(p_req, k_req):
        if k == 0:
            prod_p = p_req / p_conc
            prod_k_kcl = k_req / 0.60
            return {
                "suprido_primeiro": "P2O5",
                "produto_formulado_kg": round(prod_p, 2),
                "produto_kcl_kg": round(prod_k_kcl, 2),
                "produto_p_comp_kg": 0.0,
                "observacao": "Fósforo suprido primeiro pelo formulado. Saldo de Potássio suprido integralmente via KCl (60%)."
            }
        else:
            prod_p_cand = p_req / p_conc
            prod_k_cand = k_req / k_conc
            
            if prod_p_cand <= prod_k_cand:
                prod_formulado = prod_p_cand
                k_suprido = prod_formulado * k_conc
                k_restante = max(0.0, k_req - k_suprido)
                prod_kcl = k_restante / 0.60
                return {
                    "suprido_primeiro": "P2O5",
                    "produto_formulado_kg": round(prod_formulado, 2),
                    "produto_kcl_kg": round(prod_kcl, 2),
                    "produto_p_comp_kg": 0.0,
                    "observacao": "Fósforo suprido primeiro pelo formulado. Saldo de Potássio suprido via KCl (60%)."
                }
            else:
                prod_formulado = prod_k_cand
                p_suprido = prod_formulado * p_conc
                p_restante = max(0.0, p_req - p_suprido)
                prod_p_comp = p_restante / 0.46
                return {
                    "suprido_primeiro": "K2O",
                    "produto_formulado_kg": round(prod_formulado, 2),
                    "produto_kcl_kg": 0.0,
                    "produto_p_comp_kg": round(prod_p_comp, 2),
                    "observacao": "Potássio suprido primeiro pelo formulado. Saldo de Fósforo suprido via Super Triplo (46%)."
                }

    resultado["detalhes"]["manutencao"] = calc_cenario(p_manut_dose, k_manut_dose)
    resultado["detalhes"]["reposicao"] = calc_cenario(p_repo_dose, k_repo_dose)
    
    return resultado
