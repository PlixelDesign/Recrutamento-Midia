/**
 * Recebe as inscrições do formulário da equipe de mídia e grava na aba
 * "Inscricoes" da planilha onde este script foi criado.
 *
 * Como publicar: veja o README.md do repositório.
 */

var NOME_ABA = 'Inscricoes';
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
  'Serve em outro ministério',
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

function obterAba_() {
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  if (!planilha) {
    throw new Error('Script não está vinculado a uma planilha. Crie-o em Extensões > Apps Script dentro da planilha.');
  }
  var aba = planilha.getSheetByName(NOME_ABA) || planilha.insertSheet(NOME_ABA);
  if (aba.getLastRow() === 0) {
    prepararAba_(aba);
  }
  return aba;
}

function prepararAba_(aba) {
  var total = CABECALHO.length;
  aba.getRange(1, 1, 1, total).setValues([CABECALHO]).setFontWeight('bold').setBackground('#f1f3f5');
  aba.setFrozenRows(1);
  aba.setFrozenColumns(2);
  aba.getRange('A2:A').setNumberFormat('dd/MM/yyyy HH:mm');
  aba.getRange('D2:D').setNumberFormat('dd/MM/yyyy');
  aba.getRange('C2:C').setNumberFormat('@');
  aba.getRange('H2:H').setNumberFormat('@');

  // Lista suspensa na coluna Status para você atualizar à mão.
  var regra = SpreadsheetApp.newDataValidation()
    .requireValueInList(STATUS_OPCOES, true)
    .setAllowInvalid(true)
    .build();
  aba.getRange(2, total, aba.getMaxRows() - 1, 1).setDataValidation(regra);

  aba.setColumnWidth(1, 130);
  aba.setColumnWidth(2, 200);
  [14, 15, 18].forEach(function (col) { aba.setColumnWidth(col, 320); });
}

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
    cultos: ['Domingo noite'],
    frequencia: '1 vez por mês',
    compromissos: ['Chegar 1h antes']
  };
  var saida = doPost({ postData: { contents: JSON.stringify(exemplo) } });
  Logger.log(saida.getContent());
}
