document.addEventListener('DOMContentLoaded', async () => {
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

  // Carregar culturas do servidor
  try {
    const response = await fetch('/api/culturas');
    const data = await response.json();
    if (data.culturas) {
      selectCultura.innerHTML = data.culturas
        .map(c => `<option value="${c}">${c}</option>`)
        .join('');
    }
  } catch (err) {
    console.error("Erro ao carregar culturas:", err);
  }

  // Formatar número para padrão BR (1.234,56)
  function formatBR(val, decimalPlaces = 2) {
    if (val === undefined || val === null) return '0,00';
    return Number(val).toLocaleString('pt-BR', {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces
    });
  }

  // Ação de cálculo
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

      const res = await fetch('/api/calcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cultura: cultura,
          expectativa: parseFloat(expStr),
          formulado: formuladoStr
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Erro ao processar cálculo.');
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
        Calcular Fertilizantes
      `;
    }
  });

  // Ação de upload de KML e geração de Shapefile
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

      // Baixar o arquivo ZIP
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
      shapefileStatus.innerText = `❌ ${err.message}`;
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

    // Doses Nutricionais
    pManutDose.innerText = `${formatBR(d.p2o5_manutencao_kg)} kg/ha`;
    pRepoDose.innerText = `${formatBR(d.p2o5_reposicao_kg)} kg/ha`;
    kManutDose.innerText = `${formatBR(d.k2o_manutencao_kg)} kg/ha`;
    kRepoDose.innerText = `${formatBR(d.k2o_reposicao_kg)} kg/ha`;

    // Produtos - Manutenção
    const man = d.detalhes.manutencao;
    manutProd.innerText = `${formatBR(man.produto_formulado_kg)} kg/ha (${d.formulado})`;
    
    if (man.produto_kcl_kg > 0) {
      manutComp.innerText = `${formatBR(man.produto_kcl_kg)} kg/ha (KCl 60%)`;
      manutComp.style.color = "var(--accent-green)";
    } else if (man.produto_p_comp_kg > 0) {
      manutComp.innerText = `${formatBR(man.produto_p_comp_kg)} kg/ha (Super Triplo 46%)`;
      manutComp.style.color = "var(--accent-green)";
    } else {
      manutComp.innerText = `0 kg/ha`;
      manutComp.style.color = "var(--text-muted)";
    }
    obsManut.innerText = man.observacao;

    // Produtos - Reposição
    const rep = d.detalhes.reposicao;
    repoProd.innerText = `${formatBR(rep.produto_formulado_kg)} kg/ha (${d.formulado})`;
    
    if (rep.produto_kcl_kg > 0) {
      repoComp.innerText = `${formatBR(rep.produto_kcl_kg)} kg/ha (KCl 60%)`;
      repoComp.style.color = "var(--accent-green)";
    } else if (rep.produto_p_comp_kg > 0) {
      repoComp.innerText = `${formatBR(rep.produto_p_comp_kg)} kg/ha (Super Triplo 46%)`;
      repoComp.style.color = "var(--accent-green)";
    } else {
      repoComp.innerText = `0 kg/ha`;
      repoComp.style.color = "var(--text-muted)";
    }
    obsRepo.innerText = rep.observacao;
  }
});
