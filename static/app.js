document.addEventListener('DOMContentLoaded', () => {
  const selectCultura = document.getElementById('cultura');
  const inputExpectativa = document.getElementById('expectativa');
  const inputFormulado = document.getElementById('formulado');
  const btnCalcular = document.getElementById('btnCalcular');
  const alertError = document.getElementById('alertError');
  
  const resultsEmpty = document.getElementById('resultsEmpty');
  const resultsContent = document.getElementById('resultsContent');

  // Elements for results
  const resCultura = document.getElementById('resCultura');
  const resExpectativa = document.getElementById('resExpectativa');
  const resFormulado = document.getElementById('resFormulado');

  const pManutDose = document.getElementById('pManutDose');
  const pRepoDose = document.getElementById('pRepoDose');
  const kManutDose = document.getElementById('kManutDose');
  const kRepoDose = document.getElementById('kRepoDose');

  const manutProd = document.getElementById('manutProd');
  const manutComp = document.getElementById('manutComp');
  const repoProd = document.getElementById('repoProd');
  const repoComp = document.getElementById('repoComp');

  const obsManut = document.getElementById('obsManut');
  const obsRepo = document.getElementById('obsRepo');

  // Elements for Shapefile / KML
  const btnGerarShapefile = document.getElementById('btnGerarShapefile');
  const kmlFile = document.getElementById('kmlFile');
  const nomeTalhao = document.getElementById('nomeTalhao');
  const shapefileStatus = document.getElementById('shapefileStatus');

  // FAQ Accordion Toggle
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    question.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      faqItems.forEach(i => i.classList.remove('active'));
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });

  const TABELA_CULTURAS = {
    "Soja": { p_manut: 15, p_repo: 14, k_manut: 25, k_repo: 20 },
    "Milho": { p_manut: 15, p_repo: 8, k_manut: 10, k_repo: 6 },
    "Arroz": { p_manut: 10, p_repo: 5, k_manut: 10, k_repo: 3 },
    "Trigo / Sorgo": { p_manut: 15, p_repo: 10, k_manut: 10, k_repo: 6 },
    "Aveia (Preta / Branca)": { p_manut: 15, p_repo: 8, k_manut: 10, k_repo: 6 },
    "Canola": { p_manut: 20, p_repo: 15, k_manut: 15, k_repo: 12 },
    "Centeio": { p_manut: 15, p_repo: 9, k_manut: 10, k_repo: 5 },
    "Cevada": { p_manut: 15, p_repo: 10, k_manut: 10, k_repo: 6 },
    "Feijão": { p_manut: 15, p_repo: 10, k_manut: 20, k_repo: 15 },
    "Girassol": { p_manut: 15, p_repo: 14, k_manut: 15, k_repo: 6 }
  };

  function calcularAdubacaoJS(cultura, expectativa_sacos, formulado_str) {
    const cleaned = formulado_str.trim().replace(/\s+/g, '');
    const tokens = cleaned.split(/[-–,;:_]/);
    if (tokens.length !== 3) throw new Error("O formulado deve estar no formato XX-YY-ZZ (ex: 05-10-30)");
    
    const n = parseFloat(tokens[0].replace(',', '.'));
    const p = parseFloat(tokens[1].replace(',', '.'));
    const k = parseFloat(tokens[2].replace(',', '.'));
    
    if (isNaN(p) || p <= 0) throw new Error("A concentração de Fósforo (P) deve ser maior que zero.");
    
    const exp_ton = (expectativa_sacos * 60.0) / 1000.0;
    const idx = TABELA_CULTURAS[cultura];
    if (!idx) throw new Error("Cultura inválida selecionada.");
    
    const p_man_dose = exp_ton * idx.p_manut;
    const p_rep_dose = exp_ton * idx.p_repo;
    const k_man_dose = exp_ton * idx.k_manut;
    const k_rep_dose = exp_ton * idx.k_repo;
    
    const p_conc = p / 100.0;
    const k_conc = k / 100.0;
    
    function calcCenario(p_req, k_req) {
      if (k === 0) {
        return {
          suprido_primeiro: "P2O5",
          produto_formulado_kg: Math.round((p_req / p_conc) * 100) / 100,
          produto_kcl_kg: Math.round((k_req / 0.60) * 100) / 100,
          produto_p_comp_kg: 0,
          observacao: "Fósforo suprido primeiro pelo formulado. Saldo de Potássio suprido integralmente via KCl (60%)."
        };
      } else {
        const p_cand = p_req / p_conc;
        const k_cand = k_req / k_conc;
        if (p_cand <= k_cand) {
          const prod = p_cand;
          const k_sup = prod * k_conc;
          const k_rest = Math.max(0, k_req - k_sup);
          return {
            suprido_primeiro: "P2O5",
            produto_formulado_kg: Math.round(prod * 100) / 100,
            produto_kcl_kg: Math.round((k_rest / 0.60) * 100) / 100,
            produto_p_comp_kg: 0,
            observacao: "Fósforo suprido primeiro pelo formulado. Saldo de Potássio suprido via KCl (60%)."
          };
        } else {
          const prod = k_cand;
          const p_sup = prod * p_conc;
          const p_rest = Math.max(0, p_req - p_sup);
          return {
            suprido_primeiro: "K2O",
            produto_formulado_kg: Math.round(prod * 100) / 100,
            produto_kcl_kg: 0,
            produto_p_comp_kg: Math.round((p_rest / 0.46) * 100) / 100,
            observacao: "Potássio suprido primeiro pelo formulado. Saldo de Fósforo suprido via Super Triplo (46%)."
          };
        }
      }
    }
    
    return {
      cultura: cultura,
      expectativa_sacos: expectativa_sacos,
      expectativa_ton: exp_ton,
      formulado: `${String(Math.round(n)).padStart(2,'0')}-${String(Math.round(p)).padStart(2,'0')}-${String(Math.round(k)).padStart(2,'0')}`,
      p2o5_manutencao_kg: Math.round(p_man_dose * 100) / 100,
      p2o5_reposicao_kg: Math.round(p_rep_dose * 100) / 100,
      k2o_manutencao_kg: Math.round(k_man_dose * 100) / 100,
      k2o_reposicao_kg: Math.round(k_rep_dose * 100) / 100,
      detalhes: {
        manutencao: calcCenario(p_man_dose, k_man_dose),
        reposicao: calcCenario(p_rep_dose, k_rep_dose)
      }
    };
  }

  function formatBR(val, decimalPlaces = 2) {
    if (val === undefined || val === null) return '0,00';
    return Number(val).toLocaleString('pt-BR', {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces
    });
  }

  btnCalcular.addEventListener('click', async () => {
    alertError.style.display = 'none';

    const cultura = selectCultura.value;
    const expStr = inputExpectativa.value.trim().replace(',', '.');
    const formuladoStr = inputFormulado.value.trim();

    if (!expStr || isNaN(parseFloat(expStr)) || parseFloat(expStr) <= 0) {
      showError('Por favor, informe uma expectativa de produção válida (maior que zero).');
      return;
    }

    if (!formuladoStr) {
      showError('Por favor, informe a formulação NPK do produto (ex: 05-10-30 ou 05-30-10).');
      return;
    }

    try {
      btnCalcular.disabled = true;
      btnCalcular.innerText = 'Calculando...';

      let data;
      try {
        const res = await fetch('/api/calcular', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cultura: cultura,
            expectativa: parseFloat(expStr),
            formulado: formuladoStr
          })
        });

        if (res.ok) {
          data = await res.json();
        } else {
          throw new Error();
        }
      } catch (e) {
        data = calcularAdubacaoJS(cultura, parseFloat(expStr), formuladoStr);
      }

      exibirResultados(data);
    } catch (err) {
      showError(err.message);
    } finally {
      btnCalcular.disabled = false;
      btnCalcular.innerHTML = `
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
        </svg>
        Calcular Doses Recomendadas
      `;
    }
  });

  btnGerarShapefile.addEventListener('click', async () => {
    shapefileStatus.innerText = '';
    
    if (!kmlFile.files || kmlFile.files.length === 0) {
      shapefileStatus.style.color = '#ef4444';
      shapefileStatus.innerText = 'Por favor, selecione um arquivo .KML do talhão antes de gerar o Shapefile.';
      return;
    }
    
    const file = kmlFile.files[0];
    if (!file.name.toLowerCase().endsWith('.kml')) {
      shapefileStatus.style.color = '#ef4444';
      shapefileStatus.innerText = 'O arquivo selecionado deve ser no formato .KML';
      return;
    }

    const expStr = inputExpectativa.value.trim().replace(',', '.');
    if (!expStr || isNaN(parseFloat(expStr)) || parseFloat(expStr) <= 0) {
      shapefileStatus.style.color = '#ef4444';
      shapefileStatus.innerText = 'Por favor, informe a expectativa de produção acima antes de gerar o Shapefile.';
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('cultura', selectCultura.value);
    formData.append('expectativa', parseFloat(expStr));
    formData.append('formulado', inputFormulado.value.trim());
    formData.append('nome_talhao', nomeTalhao.value.trim() || 'Talhao_1');

    try {
      btnGerarShapefile.disabled = true;
      btnGerarShapefile.innerText = 'Processando mapa e gerando Shapefile...';

      const res = await fetch('/api/gerar-shapefile', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Erro ao gerar o arquivo Shapefile.');
      }

      const areaHa = res.headers.get('X-Area-Hectares');
      const epsg = res.headers.get('X-EPSG-Utm');

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `Recomendacao_${nomeTalhao.value.trim() || 'Talhao_1'}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      shapefileStatus.style.color = 'var(--accent-lime)';
      shapefileStatus.innerText = `✅ Sucesso! Pacote Shapefile gerado em SIRGAS 2000 UTM (EPSG:${epsg || '31982'}). Área do talhão: ${areaHa} ha.`;
    } catch (err) {
      shapefileStatus.style.color = '#ef4444';
      shapefileStatus.innerText = `❌ Nota: Para processamento geoespacial em SIRGAS 2000 UTM no GitHub Pages, conecte o backend FastAPI ou execute localmente.`;
    } finally {
      btnGerarShapefile.disabled = false;
      btnGerarShapefile.innerHTML = `
        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
        </svg>
        Gerar e Baixar Pacote Shapefile (.ZIP)
      `;
    }
  });

  function showError(msg) {
    alertError.innerText = msg;
    alertError.style.display = 'block';
  }

  function exibirResultados(d) {
    resultsEmpty.style.display = 'none';
    resultsContent.style.display = 'block';

    resCultura.innerText = d.cultura;
    resExpectativa.innerText = `${formatBR(d.expectativa_sacos, 1)} sc/ha (${formatBR(d.expectativa_ton, 2)} t/ha)`;
    resFormulado.innerText = d.formulado;

    pManutDose.innerText = `${formatBR(d.p2o5_manutencao_kg)} kg/ha`;
    pRepoDose.innerText = `${formatBR(d.p2o5_reposicao_kg)} kg/ha`;
    kManutDose.innerText = `${formatBR(d.k2o_manutencao_kg)} kg/ha`;
    kRepoDose.innerText = `${formatBR(d.k2o_reposicao_kg)} kg/ha`;

    const man = d.detalhes.manutencao;
    manutProd.innerText = `${formatBR(man.produto_formulado_kg)} kg/ha (${d.formulado})`;
    
    if (man.produto_kcl_kg > 0) {
      manutComp.innerText = `${formatBR(man.produto_kcl_kg)} kg/ha (KCl 60%)`;
      manutComp.style.color = "var(--accent-lime)";
    } else if (man.produto_p_comp_kg > 0) {
      manutComp.innerText = `${formatBR(man.produto_p_comp_kg)} kg/ha (Super Triplo 46%)`;
      manutComp.style.color = "var(--accent-lime)";
    } else {
      manutComp.innerText = `0 kg/ha`;
      manutComp.style.color = "var(--text-muted)";
    }
    obsManut.innerText = man.observacao;

    const rep = d.detalhes.reposicao;
    repoProd.innerText = `${formatBR(rep.produto_formulado_kg)} kg/ha (${d.formulado})`;
    
    if (rep.produto_kcl_kg > 0) {
      repoComp.innerText = `${formatBR(rep.produto_kcl_kg)} kg/ha (KCl 60%)`;
      repoComp.style.color = "var(--accent-lime)";
    } else if (rep.produto_p_comp_kg > 0) {
      repoComp.innerText = `${formatBR(rep.produto_p_comp_kg)} kg/ha (Super Triplo 46%)`;
      repoComp.style.color = "var(--accent-lime)";
    } else {
      repoComp.innerText = `0 kg/ha`;
      repoComp.style.color = "var(--text-muted)";
    }
    obsRepo.innerText = rep.observacao;
  }
});
