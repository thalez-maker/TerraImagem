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
    if (question) {
      question.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        faqItems.forEach(i => i.classList.remove('active'));
        if (!isActive) {
          item.classList.add('active');
        }
      });
    }
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

  // Client-Side Shapefile & ZIP Handler
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

    const cultura = selectCultura.value;
    const formuladoStr = inputFormulado.value.trim();
    const nomeTalhaoVal = (nomeTalhao.value.trim() || 'Talhao_1').replace(/[^a-zA-Z0-9_]/g, '_');

    try {
      btnGerarShapefile.disabled = true;
      btnGerarShapefile.innerText = 'Gerando Shapefile (.ZIP)...';
      shapefileStatus.innerText = '';

      // Tentar via backend primeiro se disponível
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('cultura', cultura);
        formData.append('expectativa', parseFloat(expStr));
        formData.append('formulado', formuladoStr);
        formData.append('nome_talhao', nomeTalhaoVal);

        const res = await fetch('/api/gerar-shapefile', {
          method: 'POST',
          body: formData
        });

        if (res.ok) {
          const blob = await res.blob();
          const areaHa = res.headers.get('X-Area-Hectares') || '';
          const epsgUtm = res.headers.get('X-EPSG-Utm') || '';

          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Recomendacao_${nomeTalhaoVal}.zip`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);

          shapefileStatus.style.color = '#10b981';
          shapefileStatus.innerHTML = `✔ Sucesso! Shapefile gerado (${areaHa} ha | EPSG:${epsgUtm} SIRGAS 2000 UTM). Download iniciado.`;
          return;
        }
      } catch (e) {
        // Processamento Client-side no navegador (GitHub Pages)
      }

      // Leitura do arquivo KML pelo navegador
      const reader = new FileReader();
      reader.onload = async function(e) {
        try {
          const kmlText = e.target.result;
          const dadosCalc = calcularAdubacaoJS(cultura, parseFloat(expStr), formuladoStr);
          const result = await gerarShapefileZipCliente(kmlText, dadosCalc, nomeTalhaoVal);
          
          const url = window.URL.createObjectURL(result.zipBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = result.fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          window.URL.revokeObjectURL(url);

          shapefileStatus.style.color = '#10b981';
          shapefileStatus.innerHTML = `✔ Sucesso! Pacote Shapefile gerado diretamente no navegador (${result.areaHa.toFixed(2)} ha | EPSG:${result.epsg} SIRGAS 2000 UTM). Download iniciado!`;
        } catch (errShape) {
          shapefileStatus.style.color = '#ef4444';
          shapefileStatus.innerText = `❌ Erro ao processar KML: ${errShape.message}`;
        } finally {
          btnGerarShapefile.disabled = false;
          btnGerarShapefile.innerHTML = `
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Gerar e Baixar Pacote Shapefile (.ZIP)
          `;
        }
      };
      reader.readAsText(file);

    } catch (err) {
      shapefileStatus.style.color = '#ef4444';
      shapefileStatus.innerText = `❌ Erro: ${err.message}`;
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

// ==========================================
// CLIENT-SIDE SHAPEFILE & ZIP GENERATOR ENGINE
// ==========================================

function latLonToUtm(lon, lat) {
  const zone = Math.floor((lon + 180) / 6) + 1;
  const epsg = 31960 + zone;
  const cm = zone * 6 - 183;
  const rad = Math.PI / 180;
  
  const a = 6378137.0;
  const f = 1 / 298.257222101;
  const b = a * (1 - f);
  const e2 = (a * a - b * b) / (a * a);
  const ep2 = (a * a - b * b) / (b * b);
  const k0 = 0.9996;
  
  const phi = lat * rad;
  const lambda = lon * rad;
  const lambda0 = cm * rad;
  
  const N = a / Math.sqrt(1 - e2 * Math.sin(phi) * Math.sin(phi));
  const T = Math.tan(phi) * Math.tan(phi);
  const C = ep2 * Math.cos(phi) * Math.cos(phi);
  const A = (lambda - lambda0) * Math.cos(phi);
  
  const M = a * (
    (1 - e2/4 - 3*e2*e2/64 - 5*e2*e2*e2/256) * phi -
    (3*e2/8 + 3*e2*e2/32 + 45*e2*e2*e2/1024) * Math.sin(2*phi) +
    (15*e2*e2/256 + 45*e2*e2*e2/1024) * Math.sin(4*phi) -
    (35*e2*e2*e2/3072) * Math.sin(6*phi)
  );
  
  const x = k0 * N * (A + (1-T+C)*A*A*A/6 + (5-18*T+T*T+72*C-58*ep2)*A*A*A*A*A/120) + 500000.0;
  let y = k0 * (M + N * Math.tan(phi) * (A*A/2 + (5-T+9*C+4*C*C)*A*A*A*A/24 + (61-58*T+T*T+600*C-330*ep2)*A*A*A*A*A*A/720));
  if (lat < 0) y += 10000000.0;
  
  return { x, y, zone, epsg };
}

function parseKMLCoordinates(kmlText) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(kmlText, "text/xml");
  const coordNodes = xmlDoc.getElementsByTagName("coordinates");
  
  let rawStr = "";
  for (let i = 0; i < coordNodes.length; i++) {
    rawStr += " " + coordNodes[i].textContent;
  }
  
  if (!rawStr.trim()) {
    const match = kmlText.match(/<coordinates>([\s\S]*?)<\/coordinates>/i);
    if (match) rawStr = match[1];
  }
  
  const tokens = rawStr.trim().split(/\s+/);
  const coords = [];
  
  tokens.forEach(tok => {
    const parts = tok.split(',');
    if (parts.length >= 2) {
      const lon = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      if (!isNaN(lon) && !isNaN(lat)) {
        coords.push([lon, lat]);
      }
    }
  });
  
  if (coords.length < 3) {
    throw new Error('Não foi possível extrair coordenadas válidas do arquivo KML.');
  }
  
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    coords.push([first[0], first[1]]);
  }
  
  return coords;
}

function calcularAreaHectaresUTM(utmCoords) {
  let area = 0;
  const n = utmCoords.length;
  for (let i = 0; i < n - 1; i++) {
    area += utmCoords[i].x * utmCoords[i+1].y - utmCoords[i+1].x * utmCoords[i].y;
  }
  return Math.abs(area) / 2.0 / 10000.0;
}

function createShpAndShxBuffers(utmCoords) {
  const numPoints = utmCoords.length;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  
  utmCoords.forEach(c => {
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.y > maxY) maxY = c.y;
  });
  
  const recContentLengthBytes = 4 + 32 + 4 + 4 + 4 + (numPoints * 16);
  const shpLengthBytes = 100 + 8 + recContentLengthBytes;
  const shxLengthBytes = 100 + 8;
  
  const shpBuffer = new ArrayBuffer(shpLengthBytes);
  const shpView = new DataView(shpBuffer);
  
  shpView.setInt32(0, 9994, false);
  shpView.setInt32(24, shpLengthBytes / 2, false);
  shpView.setInt32(28, 1000, true);
  shpView.setInt32(32, 5, true);
  
  shpView.setFloat64(36, minX, true);
  shpView.setFloat64(44, minY, true);
  shpView.setFloat64(52, maxX, true);
  shpView.setFloat64(60, maxY, true);
  
  shpView.setInt32(100, 1, false);
  shpView.setInt32(104, recContentLengthBytes / 2, false);
  
  let offset = 108;
  shpView.setInt32(offset, 5, true); offset += 4;
  shpView.setFloat64(offset, minX, true); offset += 8;
  shpView.setFloat64(offset, minY, true); offset += 8;
  shpView.setFloat64(offset, maxX, true); offset += 8;
  shpView.setFloat64(offset, maxY, true); offset += 8;
  
  shpView.setInt32(offset, 1, true); offset += 4;
  shpView.setInt32(offset, numPoints, true); offset += 4;
  shpView.setInt32(offset, 0, true); offset += 4;
  
  utmCoords.forEach(c => {
    shpView.setFloat64(offset, c.x, true); offset += 8;
    shpView.setFloat64(offset, c.y, true); offset += 8;
  });
  
  const shxBuffer = new ArrayBuffer(shxLengthBytes);
  const shxView = new DataView(shxBuffer);
  shxView.setInt32(0, 9994, false);
  shxView.setInt32(24, shxLengthBytes / 2, false);
  shxView.setInt32(28, 1000, true);
  shxView.setInt32(32, 5, true);
  shxView.setFloat64(36, minX, true);
  shxView.setFloat64(44, minY, true);
  shxView.setFloat64(52, maxX, true);
  shxView.setFloat64(60, maxY, true);
  
  shxView.setInt32(100, 100 / 2, false);
  shxView.setInt32(104, recContentLengthBytes / 2, false);
  
  return { shpBuffer, shxBuffer };
}

function createDbfBuffer(dadosCalc, areaHa, epsg) {
  const fields = [
    { name: "CULTURA", type: "C", len: 20, dec: 0, val: dadosCalc.cultura || "Soja" },
    { name: "EXPECTAT", type: "N", len: 10, dec: 2, val: (dadosCalc.expectativa_sacos || 60).toFixed(2) },
    { name: "FORMULAD", type: "C", len: 15, dec: 0, val: dadosCalc.formulado || "05-10-30" },
    { name: "P_MANUT", type: "N", len: 10, dec: 2, val: (dadosCalc.p2o5_manutencao_kg || 0).toFixed(2) },
    { name: "K_MANUT", type: "N", len: 10, dec: 2, val: (dadosCalc.k2o_manutencao_kg || 0).toFixed(2) },
    { name: "P_REPO", type: "N", len: 10, dec: 2, val: (dadosCalc.p2o5_reposicao_kg || 0).toFixed(2) },
    { name: "K_REPO", type: "N", len: 10, dec: 2, val: (dadosCalc.k2o_reposicao_kg || 0).toFixed(2) },
    { name: "FORM_KG", type: "N", len: 10, dec: 2, val: (dadosCalc.detalhes.manutencao.produto_formulado_kg || 0).toFixed(2) },
    { name: "KCL_KG", type: "N", len: 10, dec: 2, val: (dadosCalc.detalhes.manutencao.produto_kcl_kg || 0).toFixed(2) },
    { name: "AREA_HA", type: "N", len: 10, dec: 2, val: areaHa.toFixed(2) },
    { name: "EPSG_UTM", type: "N", len: 6, dec: 0, val: epsg.toString() }
  ];
  
  let recLen = 1;
  fields.forEach(f => recLen += f.len);
  
  const headerLen = 32 + (fields.length * 32) + 1;
  const totalLen = headerLen + recLen + 1;
  
  const buf = new Uint8Array(totalLen);
  buf[0] = 0x03;
  buf[1] = 126; buf[2] = 8; buf[3] = 3;
  
  buf[4] = 1; buf[5] = 0; buf[6] = 0; buf[7] = 0;
  
  buf[8] = headerLen & 0xFF; buf[9] = (headerLen >> 8) & 0xFF;
  buf[10] = recLen & 0xFF; buf[11] = (recLen >> 8) & 0xFF;
  
  let offset = 32;
  fields.forEach(f => {
    for (let i = 0; i < 11; i++) {
      buf[offset + i] = i < f.name.length ? f.name.charCodeAt(i) : 0;
    }
    buf[offset + 11] = f.type.charCodeAt(0);
    buf[offset + 16] = f.len;
    buf[offset + 17] = f.dec;
    offset += 32;
  });
  
  buf[offset] = 0x0D;
  offset += 1;
  
  buf[offset] = 0x20;
  offset += 1;
  
  fields.forEach(f => {
    const strVal = f.val.toString().padStart(f.len, ' ').substring(0, f.len);
    for (let i = 0; i < f.len; i++) {
      buf[offset + i] = strVal.charCodeAt(i);
    }
    offset += f.len;
  });
  
  buf[offset] = 0x1A;
  return buf.buffer;
}

function getPrjContent(epsg, zone) {
  const cm = zone * 6 - 183;
  return `PROJCS["SIRGAS 2000 / UTM zone ${zone}S",GEOGCS["SIRGAS 2000",DATUM["Sistema_de_Referencia_Geocentrico_para_las_Americas_2000",SPHEROID["GRS 1980",6378137,298.257222101]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",${cm}],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",10000000],UNIT["metre",1]]`;
}

function getTxtReportContent(dadosCalc, nomeTalhao, areaHa, epsg, zone) {
  const manut = dadosCalc.detalhes.manutencao;
  const repo = dadosCalc.detalhes.reposicao;
  
  return `================================================================================
TERRAIMAGEM - TECNOLOGIA AGRONÔMICA E AGRICULTURA DE PRECISÃO
RELATÓRIO TÉCNICO DE RECOMENDAÇÃO DE ADUBAÇÃO E APLICAÇÃO GEOESPACIAL
================================================================================

IDENTIFICAÇÃO DO TALHÃO: ${nomeTalhao}
ÁREA CALCULADA: ${areaHa.toFixed(2)} ha
SISTEMA DE PROJEÇÃO: SIRGAS 2000 / UTM Zone ${zone}S (EPSG:${epsg})

CULTURA AGRÍCOLA: ${dadosCalc.cultura}
EXPECTATIVA DE PRODUTIVIDADE: ${dadosCalc.expectativa_sacos} sc/ha (${(dadosCalc.expectativa_sacos*0.06).toFixed(2)} t/ha)
FORMULADO N-P-K UTILIZADO: ${dadosCalc.formulado}

--------------------------------------------------------------------------------
1. EXTRAÇÃO DE NUTRIENTES PELA CULTURA (kg/ha)
--------------------------------------------------------------------------------
- Fósforo (P₂O₅) Manutenção: ${dadosCalc.p2o5_manutencao_kg.toFixed(2)} kg/ha
- Potássio (K₂O) Manutenção: ${dadosCalc.k2o_manutencao_kg.toFixed(2)} kg/ha
- Fósforo (P₂O₅) Reposição:   ${dadosCalc.p2o5_reposicao_kg.toFixed(2)} kg/ha
- Potássio (K₂O) Reposição:   ${dadosCalc.k2o_reposicao_kg.toFixed(2)} kg/ha

--------------------------------------------------------------------------------
2. RECOMENDAÇÃO DE PRODUTOS COMERCIALIZÁVEIS (REGRA DO MENOR VALOR)
--------------------------------------------------------------------------------
--- CENÁRIO 1: MANUTENÇÃO ---
- Produto Formulado (${dadosCalc.formulado}): ${manut.produto_formulado_kg.toFixed(2)} kg/ha
- Complemento Potássio (KCl 60%): ${manut.produto_kcl_kg.toFixed(2)} kg/ha
- Complemento Fósforo (Super Triplo 46%): ${manut.produto_p_comp_kg.toFixed(2)} kg/ha
Nota: ${manut.observacao}

--- CENÁRIO 2: REPOSIÇÃO ---
- Produto Formulado (${dadosCalc.formulado}): ${repo.produto_formulado_kg.toFixed(2)} kg/ha
- Complemento Potássio (KCl 60%): ${repo.produto_kcl_kg.toFixed(2)} kg/ha
- Complemento Fósforo (Super Triplo 46%): ${repo.produto_p_comp_kg.toFixed(2)} kg/ha
Nota: ${repo.observacao}

================================================================================
GERADO AUTOMATICAMENTE VIA TERRAIMAGEM - PRECISION AGRI PLATFORM
================================================================================`;
}

async function gerarShapefileZipCliente(kmlText, dadosCalc, nomeTalhao) {
  const coordsLatLon = parseKMLCoordinates(kmlText);
  const utmCoords = coordsLatLon.map(c => latLonToUtm(c[0], c[1]));
  
  const zone = utmCoords[0].zone;
  const epsg = utmCoords[0].epsg;
  const areaHa = calcularAreaHectaresUTM(utmCoords);
  
  const { shpBuffer, shxBuffer } = createShpAndShxBuffers(utmCoords);
  const dbfBuffer = createDbfBuffer(dadosCalc, areaHa, epsg);
  const prjContent = getPrjContent(epsg, zone);
  const txtContent = getTxtReportContent(dadosCalc, nomeTalhao, areaHa, epsg, zone);
  
  if (typeof JSZip === 'undefined') {
    throw new Error('Bibliotecas de empacotamento ZIP ainda estão carregando. Aguarde um segundo e tente novamente.');
  }
  
  const zip = new JSZip();
  const baseName = `Recomendacao_${nomeTalhao}`;
  
  zip.file(`${baseName}.shp`, shpBuffer);
  zip.file(`${baseName}.shx`, shxBuffer);
  zip.file(`${baseName}.dbf`, dbfBuffer);
  zip.file(`${baseName}.prj`, prjContent);
  zip.file(`LEIA_ME_RECOMENDACAO.txt`, txtContent);
  
  const zipBlob = await zip.generateAsync({ type: "blob" });
  return { zipBlob, areaHa, epsg, fileName: `${baseName}.zip` };
}
