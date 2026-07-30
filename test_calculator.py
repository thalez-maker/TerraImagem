from calculator import calcular_adubacao, TABELA_CULTURAS, parse_formulado

def test_parse_formulado():
    assert parse_formulado("05-30-10") == (5.0, 30.0, 10.0)
    assert parse_formulado("00,40,00") == (0.0, 40.0, 0.0)
    assert parse_formulado("5, 30, 10") == (5.0, 30.0, 10.0)

def test_soja_calc_zero_potassio():
    # Soja, 60 sacas/ha -> 3.6 t/ha
    # P2O5 manut: 3.6 * 15 = 54 kg/ha
    # P2O5 repo: 3.6 * 14 = 50.4 kg/ha
    # K2O manut: 3.6 * 25 = 90 kg/ha
    # K2O repo: 3.6 * 20 = 72 kg/ha
    res = calcular_adubacao("Soja", 60, "00-40-00")
    assert res["p2o5_manutencao_kg"] == 54.0
    assert res["p2o5_reposicao_kg"] == 50.4
    assert res["k2o_manutencao_kg"] == 90.0
    assert res["k2o_reposicao_kg"] == 72.0
    
    # Produto Formulado 00-40-00 para P2O5:
    # manut: 54 / 0.40 = 135 kg/ha
    # repo: 50.4 / 0.40 = 126 kg/ha
    # KCl 60% para K2O:
    # manut: 90 / 0.60 = 150 kg/ha
    # repo: 72 / 0.60 = 120 kg/ha
    manut = res["detalhes"]["manutencao"]
    assert manut["produto_formulado_kg"] == 135.0
    assert manut["produto_kcl_kg"] == 150.0

def test_milho_calc_com_potassio():
    # Milho, 100 sacas/ha -> 6.0 t/ha
    # P2O5 manut: 6 * 15 = 90 kg/ha
    # K2O manut: 6 * 10 = 60 kg/ha
    # Formulado 05-30-10 (P=30%, K=10%)
    # Prod P cand = 90 / 0.30 = 300 kg/ha
    # Prod K cand = 60 / 0.10 = 600 kg/ha
    # 300 < 600 -> P supre primeiro!
    # Formulado NPK = 300 kg/ha
    # K suprido = 300 * 0.10 = 30 kg/ha
    # K restante = 60 - 30 = 30 kg/ha
    # KCl (60%) = 30 / 0.60 = 50 kg/ha
    res = calcular_adubacao("Milho", 100, "05-30-10")
    manut = res["detalhes"]["manutencao"]
    assert manut["suprido_primeiro"] == "P2O5"
    assert manut["produto_formulado_kg"] == 300.0
    assert manut["produto_kcl_kg"] == 50.0

if __name__ == "__main__":
    test_parse_formulado()
    test_soja_calc_zero_potassio()
    test_milho_calc_com_potassio()
    print("Todos os testes passaram com sucesso!")
