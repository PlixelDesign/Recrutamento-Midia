/**
 * Recebe as inscrições do formulário da equipe de mídia e grava na aba
 * "Inscricoes" da planilha onde este script foi criado.
 *
 * Como publicar: veja o README.md do repositório.
 */

var NOME_ABA = 'Inscricoes';

// ID de uma planilha que já existe, se você quiser usar uma específica.
// O ID é o trecho do link da planilha entre "/d/" e "/edit".
// Deixe '' para o script criar a planilha sozinho (função configurarPlanilha).
var PLANILHA_ID = '';
var FUSO = 'America/Sao_Paulo';
var STATUS_INICIAL = 'Aguardando conversa';
var STATUS_OPCOES = ['Aguardando conversa', 'Conversa feita', 'Teste', 'Observação', 'Aprovado', 'Não seguiu'];
var MAX_TEXTO = 3000;

var CABECALHO = [
  'Data/hora',
  'Nome',
  'WhatsApp',
  'Nascimento',
  'Idade',
  'Menor de idade',
  'Responsável',
  'WhatsApp responsável',
  'Bairro/cidade',
  'Tempo de igreja',
  'Batismo',
  'Serve em outro ministério/conjunto',
  'Qual/frequência',
  'Motivação',
  'Resposta situacional',
  'Áreas',
  'Apps',
  'Aprendizado recente',
  'Link',
  'Equipamento',
  'Cultos',
  'Frequência',
  'Compromissos aceitos',
  'Status'
];

function doPost(e) {
  var dados;
  try {
    dados = JSON.parse((e && e.postData && e.postData.contents) || '');
  } catch (err) {
    return responder_({ ok: false, error: 'Dados em formato inválido.' });
  }
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
    return responder_({ ok: false, error: 'Dados em formato inválido.' });
  }

  // Honeypot preenchido = robô. Responde "ok" para não dar pista, mas não grava.
  if (texto_(dados.website)) {
    return responder_({ ok: true });
  }

  var nascimento = lerData_(dados.nascimento);
  var erro = validar_(dados, nascimento);
  if (erro) {
    return responder_({ ok: false, error: erro });
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return responder_({ ok: false, error: 'Muitos envios ao mesmo tempo. Tente de novo em instantes.' });
  }

  try {
    var aba = obterAba_();
    aba.appendRow(montarLinha_(dados, nascimento));
  } catch (err) {
    console.error(err);
    return responder_({ ok: false, error: 'Não foi possível gravar na planilha. Tente de novo mais tarde.' });
  } finally {
    lock.releaseLock();
  }

  return responder_({ ok: true });
}

// Abrir a URL do App da Web no navegador mostra esta mensagem: serve para
// conferir se a implantação está no ar.
function doGet() {
  return ContentService.createTextOutput('Formulário da Mídia: script ativo. As inscrições chegam por POST.');
}

function validar_(d, nascimento) {
  var nome = texto_(d.nome);
  if (nome.length < 3) return 'Informe o nome completo.';
  if (soDigitos_(d.whatsapp).length !== 11) return 'WhatsApp inválido. Use DDD + número (11 dígitos).';
  if (!nascimento) return 'Data de nascimento inválida.';
  var idade = calcularIdade_(nascimento);
  if (idade < 5 || idade > 110) return 'Data de nascimento inválida.';
  if (idade < 18) {
    if (!texto_(d.responsavelNome)) return 'Informe o nome do responsável.';
    if (soDigitos_(d.responsavelWhatsapp).length !== 11) return 'WhatsApp do responsável inválido.';
  }
  return '';
}

function montarLinha_(d, nascimento) {
  var idade = calcularIdade_(nascimento);
  var menor = idade < 18;
  return [
    new Date(),
    seguro_(texto_(d.nome)),
    formatarTelefone_(d.whatsapp),
    // Meio-dia evita que a data "volte um dia" se o fuso do script e o da planilha forem diferentes.
    new Date(nascimento.ano, nascimento.mes - 1, nascimento.dia, 12),
    idade,
    menor ? 'Sim' : 'Não',
    menor ? seguro_(texto_(d.responsavelNome)) : '',
    menor ? formatarTelefone_(d.responsavelWhatsapp) : '',
    seguro_(texto_(d.bairroCidade)),
    seguro_(texto_(d.tempoIgreja)),
    seguro_(texto_(d.batismo)),
    seguro_(texto_(d.outroMinisterio)),
    seguro_(texto_(d.outroMinisterioQual)),
    seguro_(texto_(d.motivacao)),
    seguro_(texto_(d.situacional)),
    seguro_(lista_(d.areas)),
    seguro_(lista_(d.apps)),
    seguro_(texto_(d.aprendizado)),
    seguro_(texto_(d.link)),
    seguro_(lista_(d.equipamento)),
    seguro_(lista_(d.cultos)),
    seguro_(texto_(d.frequencia)),
    seguro_(lista_(d.compromissos)),
    STATUS_INICIAL
  ];
}

// Procura a planilha nesta ordem: PLANILHA_ID no código, a planilha que o
// próprio script criou (guardada nas propriedades do script) e, por último,
// a planilha onde o script foi criado (Extensões > Apps Script).
function obterPlanilha_() {
  var id = PLANILHA_ID || PropertiesService.getScriptProperties().getProperty('PLANILHA_ID');
  if (id) {
    return SpreadsheetApp.openById(id);
  }
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  if (!planilha) {
    throw new Error('Nenhuma planilha configurada. No editor, execute a função configurarPlanilha uma vez.');
  }
  return planilha;
}

function obterAba_() {
  var planilha = obterPlanilha_();
  var aba = planilha.getSheetByName(NOME_ABA) || planilha.insertSheet(NOME_ABA);
  if (aba.getLastRow() === 0) {
    prepararAba_(aba);
  }
  return aba;
}

/**
 * Formata a planilha de uma vez: aba "Inscricoes" com cabeçalho, larguras,
 * cores de status e filtro, e uma aba "Resumo" com contagens automáticas.
 * Rode uma vez pelo editor (escolha "configurarPlanilha" e clique em Executar).
 * Se ainda não existir planilha, ela é criada no seu Google Drive com o nome
 * "Inscrições Mídia" e o link aparece no Registro de execução.
 * Pode rodar de novo sem perder inscrições: só refaz a formatação.
 */
function configurarPlanilha() {
  var planilha;
  var criada = false;
  var temId = PLANILHA_ID || PropertiesService.getScriptProperties().getProperty('PLANILHA_ID');
  if (temId || SpreadsheetApp.getActiveSpreadsheet()) {
    planilha = obterPlanilha_();
  } else {
    planilha = SpreadsheetApp.create('Inscrições Mídia');
    PropertiesService.getScriptProperties().setProperty('PLANILHA_ID', planilha.getId());
    criada = true;
  }
  planilha.setSpreadsheetTimeZone(FUSO);
  planilha.setSpreadsheetLocale('pt_BR');

  var aba = planilha.getSheetByName(NOME_ABA) || planilha.insertSheet(NOME_ABA, 0);
  prepararAba_(aba);
  prepararResumo_(planilha);

  // Remove a aba padrão vazia ("Página1"/"Sheet1"), se existir.
  planilha.getSheets().forEach(function (outra) {
    var nome = outra.getName();
    if (nome === NOME_ABA || nome === 'Resumo') return;
    var padrao = criada || ['Página1', 'Sheet1', 'Planilha1'].indexOf(nome) !== -1;
    if (padrao && outra.getLastRow() === 0) {
      planilha.deleteSheet(outra);
    }
  });
  planilha.setActiveSheet(aba);

  Logger.log((criada ? 'Planilha criada: ' : 'Planilha formatada: ') + planilha.getUrl());
}

var COR_CABECALHO = '#24406b';
var COR_STATUS = {
  'Aguardando conversa': ['#fff4ce', '#7a5a00'],
  'Conversa feita': ['#dbeafe', '#1e40af'],
  'Teste': ['#ede9fe', '#5b21b6'],
  'Observação': ['#e0f2fe', '#075985'],
  'Aprovado': ['#dcfce7', '#166534'],
  'Não seguiu': ['#f1f3f5', '#6b7280']
};

function prepararAba_(aba) {
  var total = CABECALHO.length;
  var linhas = aba.getMaxRows();

  // Mantém só as colunas usadas.
  if (aba.getMaxColumns() > total) {
    aba.deleteColumns(total + 1, aba.getMaxColumns() - total);
  } else if (aba.getMaxColumns() < total) {
    aba.insertColumnsAfter(aba.getMaxColumns(), total - aba.getMaxColumns());
  }

  // Cabeçalho
  aba.getRange(1, 1, 1, total)
    .setValues([CABECALHO])
    .setFontWeight('bold')
    .setFontColor('#ffffff')
    .setBackground(COR_CABECALHO)
    .setVerticalAlignment('middle')
    .setWrap(true);
  aba.setRowHeight(1, 40);
  aba.setFrozenRows(1);
  aba.setFrozenColumns(2);

  // Formatos
  aba.getRange('A2:A').setNumberFormat('dd/MM/yyyy HH:mm');
  aba.getRange('D2:D').setNumberFormat('dd/MM/yyyy');
  aba.getRange('C2:C').setNumberFormat('@');
  aba.getRange('H2:H').setNumberFormat('@');
  aba.getRange('E2:E').setNumberFormat('0').setHorizontalAlignment('center');
  aba.getRange('F2:F').setHorizontalAlignment('center');
  aba.getRange(2, 1, linhas - 1, total).setVerticalAlignment('top');

  // Larguras (na ordem do CABECALHO)
  var larguras = [125, 200, 125, 95, 55, 75, 170, 125, 170, 110, 140, 110, 200,
                  320, 320, 200, 160, 260, 200, 160, 180, 130, 220, 165];
  larguras.forEach(function (w, i) { aba.setColumnWidth(i + 1, w); });

  // Textos longos quebram linha; os demais ficam numa linha só.
  aba.getRange(2, 1, linhas - 1, total).setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  [13, 14, 15, 16, 17, 18, 20, 21, 23].forEach(function (col) {
    aba.getRange(2, col, linhas - 1, 1).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  });

  // Lista suspensa na coluna Status para você atualizar à mão.
  var regra = SpreadsheetApp.newDataValidation()
    .requireValueInList(STATUS_OPCOES, true)
    .setAllowInvalid(true)
    .build();
  var colStatus = aba.getRange(2, total, linhas - 1, 1);
  colStatus.setDataValidation(regra).setFontWeight('bold').setHorizontalAlignment('center');

  // Cores: cada status com sua cor; "Menor de idade = Sim" em amarelo.
  var regras = Object.keys(COR_STATUS).map(function (status) {
    return SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(status)
      .setBackground(COR_STATUS[status][0])
      .setFontColor(COR_STATUS[status][1])
      .setRanges([colStatus])
      .build();
  });
  regras.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('Sim')
    .setBackground('#fff4ce')
    .setFontColor('#7a5a00')
    .setBold(true)
    .setRanges([aba.getRange(2, 6, linhas - 1, 1)])
    .build());
  aba.setConditionalFormatRules(regras);

  // Linhas zebradas e filtro no cabeçalho.
  aba.getBandings().forEach(function (b) { b.remove(); });
  aba.getRange(2, 1, linhas - 1, total)
    .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false)
    .setFirstRowColor('#ffffff')
    .setSecondRowColor('#f7f9fc');
  if (aba.getFilter()) aba.getFilter().remove();
  aba.getRange(1, 1, linhas, total).createFilter();
}

// Aba "Resumo": contagens que se atualizam sozinhas a cada inscrição.
function prepararResumo_(planilha) {
  var aba = planilha.getSheetByName('Resumo') || planilha.insertSheet('Resumo');
  aba.clear();
  aba.clearConditionalFormatRules();
  var ref = "'" + NOME_ABA + "'!";
  var cultos = CULTOS_RESUMO;

  var blocos = [
    ['Geral', [
      ['Total de inscrições', '=COUNTA(' + ref + 'B2:B)'],
      ['Menores de idade', '=COUNTIF(' + ref + 'F2:F,"Sim")'],
      ['Já servem em outro ministério/conjunto', '=COUNTIF(' + ref + 'L2:L,"Sim")'],
      ['Últimos 7 dias', '=COUNTIF(' + ref + 'A2:A,">="&(NOW()-7))']
    ]],
    ['Status', STATUS_OPCOES.map(function (s) {
      return [s, '=COUNTIF(' + ref + 'X2:X,"' + s + '")'];
    })],
    ['Cultos (pode servir)', cultos.map(function (c) {
      return [c, '=COUNTIF(' + ref + 'U2:U,"*' + c + '*")'];
    })],
    ['Frequência', FREQUENCIAS_RESUMO.map(function (f) {
      return [f, '=COUNTIF(' + ref + 'V2:V,"' + f + '")'];
    })]
  ];

  var linha = 1;
  aba.getRange(linha, 1, 1, 2).merge().setValue('Resumo das inscrições — Equipe de Mídia')
    .setFontSize(14).setFontWeight('bold').setFontColor(COR_CABECALHO);
  linha += 2;
  blocos.forEach(function (bloco) {
    if (!bloco[1].length) return;
    aba.getRange(linha, 1, 1, 2).setValues([[bloco[0], 'Qtd.']])
      .setFontWeight('bold').setFontColor('#ffffff').setBackground(COR_CABECALHO);
    linha++;
    var corpo = aba.getRange(linha, 1, bloco[1].length, 2);
    corpo.setValues(bloco[1].map(function (l) { return [l[0], '']; }));
    aba.getRange(linha, 2, bloco[1].length, 1)
      .setFormulas(bloco[1].map(function (l) { return [l[1]]; }))
      .setHorizontalAlignment('center').setFontWeight('bold');
    corpo.setBorder(true, true, true, true, true, true, '#d0d7e2', SpreadsheetApp.BorderStyle.SOLID);
    linha += bloco[1].length + 1;
  });
  aba.setColumnWidth(1, 300);
  aba.setColumnWidth(2, 80);
  aba.setHiddenGridlines(true);
}

// Opções usadas na aba Resumo. Mantenha iguais às do formulário
// (config.js para os cultos, index.html para a frequência).
var CULTOS_RESUMO = ['Domingo de manhã (EBD)', 'Domingo à noite', 'Terça', 'Quinta', 'Outros dias'];
var FREQUENCIAS_RESUMO = ['2 vezes por mês', '3 vezes ou mais por mês'];

// ---------- Utilidades ----------

function responder_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function texto_(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim().slice(0, MAX_TEXTO);
}

function lista_(v) {
  if (!Array.isArray(v)) return texto_(v);
  return v.map(function (item) { return texto_(item).slice(0, 300); })
    .filter(function (item) { return item; })
    .join('; ');
}

// Impede que um texto começando com =, +, - ou @ vire fórmula na planilha.
function seguro_(s) {
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function soDigitos_(v) {
  return texto_(v).replace(/\D/g, '');
}

function formatarTelefone_(v) {
  var d = soDigitos_(v);
  if (d.length !== 11) return seguro_(texto_(v));
  return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
}

function lerData_(v) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto_(v));
  if (!m) return null;
  var ano = +m[1], mes = +m[2], dia = +m[3];
  var dt = new Date(ano, mes - 1, dia);
  if (dt.getFullYear() !== ano || dt.getMonth() !== mes - 1 || dt.getDate() !== dia) return null;
  return { ano: ano, mes: mes, dia: dia };
}

function calcularIdade_(n) {
  var hoje = Utilities.formatDate(new Date(), FUSO, 'yyyy-MM-dd').split('-');
  var ano = +hoje[0], mes = +hoje[1], dia = +hoje[2];
  var idade = ano - n.ano;
  if (mes < n.mes || (mes === n.mes && dia < n.dia)) idade--;
  return idade;
}

/**
 * Teste manual: no editor do Apps Script, escolha "testarGravacao" no menu
 * de funções e clique em Executar. Na primeira vez o Google pede autorização.
 * Uma linha de teste aparece na aba Inscricoes; apague depois.
 */
function testarGravacao() {
  var exemplo = {
    website: '',
    nome: 'Teste da Silva',
    whatsapp: '(31) 99999-9999',
    nascimento: '2000-01-15',
    bairroCidade: 'Industrial São Luiz, Contagem',
    tempoIgreja: '1 a 3 anos',
    batismo: 'Sim, sou batizado',
    outroMinisterio: 'Não',
    motivacao: 'Linha de teste criada pela função testarGravacao.',
    situacional: 'Refaço e peço retorno.',
    areas: ['Fotografia', 'Som'],
    apps: ['Canva'],
    aprendizado: 'Teste',
    link: '',
    equipamento: ['Notebook'],
    cultos: ['Domingo à noite'],
    frequencia: '2 vezes por mês',
    compromissos: ['Chegar 1h antes']
  };
  var saida = doPost({ postData: { contents: JSON.stringify(exemplo) } });
  Logger.log(saida.getContent());
}
