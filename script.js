(function () {
  'use strict';

  var MIN_SEGUNDOS = 10;
  var TIMEOUT_ENVIO_MS = 25000;
  var DRAFT_KEY = 'midia-inscricao-rascunho-v1';
  var DRAFT_VALIDADE_MS = 30 * 24 * 60 * 60 * 1000;
  var NOMES_ETAPAS = ['Abertura', 'Quem é você', 'Coração', 'Competência', 'Compromisso'];

  var config = {
    url: typeof SCRIPT_URL === 'string' ? SCRIPT_URL.trim() : '',
    cultos: typeof CULTOS !== 'undefined' && Array.isArray(CULTOS) ? CULTOS : [],
    lider: typeof NOME_LIDER === 'string' ? NOME_LIDER.trim() : ''
  };

  var form = document.getElementById('form');
  var steps = Array.prototype.slice.call(form.querySelectorAll('.step'));
  var ultimaEtapa = steps.length - 1;
  var abertoEm = Date.now();
  var atual = 0;
  var enviando = false;
  var concluido = false;

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  // ---------- Utilidades ----------

  function soDigitos(s) { return String(s || '').replace(/\D/g, ''); }

  function formatarTelefone(d) {
    if (!d) return '';
    if (d.length <= 2) return '(' + d;
    var ddd = d.slice(0, 2);
    var resto = d.slice(2);
    if (resto.length <= 5) return '(' + ddd + ') ' + resto;
    return '(' + ddd + ') ' + resto.slice(0, 5) + '-' + resto.slice(5);
  }

  function aplicarMascaraTelefone(input, evento) {
    var valor = input.value;
    var pos = input.selectionStart == null ? valor.length : input.selectionStart;
    var digitosAntes = soDigitos(valor.slice(0, pos)).length;
    var d = soDigitos(valor);
    var normalizado = false;

    // Número colado ou preenchido automaticamente com +55 ou 0 na frente.
    var digitando = evento && evento.inputType === 'insertText';
    if (!digitando && d.length > 11 && d.indexOf('55') === 0) { d = d.slice(2); normalizado = true; }
    if (/^0/.test(d)) { d = d.replace(/^0+/, ''); normalizado = true; }
    if (d.length > 11) { d = d.slice(0, 11); }

    var formatado = formatarTelefone(d);
    if (formatado === valor) return;
    input.value = formatado;

    if (document.activeElement !== input) return;
    var idx = formatado.length;
    if (!normalizado) {
      var vistos = 0;
      idx = 0;
      while (idx < formatado.length && vistos < digitosAntes) {
        if (/\d/.test(formatado[idx])) vistos++;
        idx++;
      }
    }
    try { input.setSelectionRange(idx, idx); } catch (e) { /* alguns navegadores não aceitam em type=tel */ }
  }

  function lerData(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
    if (!m) return null;
    var a = +m[1], me = +m[2], di = +m[3];
    var dt = new Date(a, me - 1, di);
    if (dt.getFullYear() !== a || dt.getMonth() !== me - 1 || dt.getDate() !== di) return null;
    return { ano: a, mes: me, dia: di };
  }

  function calcularIdade(d, hoje) {
    hoje = hoje || new Date();
    var idade = hoje.getFullYear() - d.ano;
    var m = hoje.getMonth() + 1;
    if (m < d.mes || (m === d.mes && hoje.getDate() < d.dia)) idade--;
    return idade;
  }

  function idadeAtual() {
    var d = lerData(form.elements.nascimento.value);
    return d ? calcularIdade(d) : null;
  }

  function hojeISO() {
    var h = new Date();
    var mm = String(h.getMonth() + 1).padStart(2, '0');
    var dd = String(h.getDate()).padStart(2, '0');
    return h.getFullYear() + '-' + mm + '-' + dd;
  }

  function normalizarLink(v) {
    v = v.trim();
    if (!v || v.charAt(0) === '@') return v;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) v = 'https://' + v;
    return v;
  }

  function linkValido(v) {
    v = v.trim();
    if (!v) return true;
    if (/^@[\w.]{1,30}$/.test(v)) return true;
    try {
      var u = new URL(normalizarLink(v));
      return (u.protocol === 'https:' || u.protocol === 'http:') && /\.[a-z]{2,}$/i.test(u.hostname);
    } catch (e) {
      return false;
    }
  }

  function valoresMarcados(nome) {
    return $$('input[name="' + nome + '"]:checked', form).map(function (i) { return i.value; });
  }

  function valorRadio(nome) {
    var el = $('input[name="' + nome + '"]:checked', form);
    return el ? el.value : '';
  }

  function texto(nome) {
    var el = form.elements[nome];
    return el && typeof el.value === 'string' ? el.value.trim() : '';
  }

  // ---------- Cultos (vêm do config.js) ----------

  function montarCultos() {
    var lista = $('#lista-cultos');
    var cultos = config.cultos.length ? config.cultos : ['Domingo', 'Quarta'];
    cultos.forEach(function (nome) {
      var label = document.createElement('label');
      label.className = 'choice';
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.name = 'cultos';
      input.value = String(nome);
      var span = document.createElement('span');
      span.textContent = String(nome);
      label.appendChild(input);
      label.appendChild(span);
      lista.appendChild(label);
    });
  }

  // ---------- Acessibilidade: liga cada campo à sua dica e ao seu erro ----------

  function ligarDescricoes() {
    $$('.field', form).forEach(function (field) {
      var ids = $$('.hint[id]', field).map(function (h) { return h.id; });
      var erro = $('.field-error', field);
      if (erro) ids.push(erro.id);
      if (!ids.length) return;
      $$('input, textarea', field).forEach(function (el) {
        el.setAttribute('aria-describedby', ids.join(' '));
      });
    });
  }

  // ---------- Validação ----------

  var MENSAGENS = {
    vazio: 'Preencha este campo.',
    nome: 'Escreva o nome completo (nome e sobrenome).',
    telefoneVazio: 'Informe o WhatsApp com DDD.',
    telefone: 'O número precisa ter 11 dígitos, com DDD. Ex.: (31) 99999-9999',
    dataVazia: 'Informe a data de nascimento.',
    data: 'Confira a data de nascimento.',
    radio: 'Escolha uma opção.',
    min1: 'Marque pelo menos uma opção.',
    check: 'Marque esta opção para continuar.',
    todos: 'Marque todos os compromissos para enviar.',
    link: 'Confira o link. Ex.: instagram.com/seuperfil'
  };

  function campoAtivo(field) {
    return !field.closest('.conditional[hidden]');
  }

  function validarCampo(field) {
    var tipo = field.getAttribute('data-validate');
    var input = $('input, textarea', field);
    var v = input && typeof input.value === 'string' ? input.value.trim() : '';
    var nome = field.getAttribute('data-name');

    switch (tipo) {
      case 'required':
        return v ? '' : MENSAGENS.vazio;
      case 'name':
        if (!v) return MENSAGENS.vazio;
        return v.split(/\s+/).length >= 2 ? '' : MENSAGENS.nome;
      case 'phone':
        if (!v) return MENSAGENS.telefoneVazio;
        return soDigitos(v).length === 11 ? '' : MENSAGENS.telefone;
      case 'birthdate': {
        if (!v) return MENSAGENS.dataVazia;
        var d = lerData(v);
        if (!d || v > hojeISO()) return MENSAGENS.data;
        var idade = calcularIdade(d);
        return idade >= 5 && idade <= 110 ? '' : MENSAGENS.data;
      }
      case 'minlen': {
        if (!v) return MENSAGENS.vazio;
        var min = +field.getAttribute('data-min');
        return v.length >= min ? '' : 'Escreva um pouco mais: mínimo de ' + min + ' caracteres (faltam ' + (min - v.length) + ').';
      }
      case 'radio':
        return valorRadio(nome) ? '' : MENSAGENS.radio;
      case 'min1':
        return valoresMarcados(nome).length ? '' : MENSAGENS.min1;
      case 'check':
        return input.checked ? '' : MENSAGENS.check;
      case 'all':
        return $$('input[type="checkbox"]', field).every(function (c) { return c.checked; }) ? '' : MENSAGENS.todos;
      case 'url':
        return linkValido(v) ? '' : MENSAGENS.link;
      default:
        return '';
    }
  }

  function mostrarErro(field, msg) {
    var erro = $('.field-error', field);
    var tipo = field.getAttribute('data-validate');
    var grupo = tipo === 'radio' || tipo === 'min1' || tipo === 'all';
    if (erro) {
      erro.textContent = msg;
      erro.hidden = !msg;
    }
    if (grupo) {
      if (msg) field.setAttribute('data-invalid', 'true'); else field.removeAttribute('data-invalid');
      if (tipo === 'all') {
        $$('input[type="checkbox"]', field).forEach(function (c) {
          if (msg && !c.checked) c.setAttribute('aria-invalid', 'true'); else c.removeAttribute('aria-invalid');
        });
      }
    } else {
      var input = $('input, textarea', field);
      if (input) {
        if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
      }
    }
  }

  function limparErros(root) {
    $$('.field[data-validate]', root).forEach(function (f) { mostrarErro(f, ''); });
  }

  // Valida a etapa e devolve o primeiro campo com erro (ou null).
  function validarEtapa(i) {
    var primeiro = null;
    $$('.field[data-validate]', steps[i]).forEach(function (field) {
      if (!campoAtivo(field)) return;
      var msg = validarCampo(field);
      mostrarErro(field, msg);
      if (msg && !primeiro) primeiro = field;
    });
    return primeiro;
  }

  function focarCampo(field) {
    var alvo = $('input:not([type="checkbox"]):not([type="radio"]), textarea', field);
    if (!alvo) {
      alvo = $('input[aria-invalid="true"]', field) || $('input', field);
    }
    field.scrollIntoView({ block: 'center' });
    if (alvo) alvo.focus({ preventScroll: true });
  }

  // Revalida em tempo real só os campos que já mostraram erro.
  function revalidarSeComErro(el) {
    var field = el.closest('.field[data-validate]');
    if (!field) return;
    var temErro = !$('.field-error', field).hidden;
    if (temErro) mostrarErro(field, validarCampo(field));
  }

  // ---------- Campos condicionais ----------

  function alternar(bloco, mostrar) {
    bloco.hidden = !mostrar;
    if (!mostrar) limparErros(bloco);
  }

  function atualizarIdade() {
    var info = $('#idade-info');
    var idade = idadeAtual();
    var valido = idade !== null && idade >= 5 && idade <= 110 && form.elements.nascimento.value <= hojeISO();
    info.textContent = valido ? 'Idade: ' + idade + (idade === 1 ? ' ano' : ' anos') : '';
    alternar($('#bloco-responsavel'), valido && idade < 18);
  }

  function atualizarMinisterio() {
    alternar($('#bloco-ministerio'), valorRadio('outroMinisterio') === 'Sim');
  }

  function atualizarAppsOutro() {
    alternar($('#bloco-apps-outro'), $('#apps-outro-check').checked);
  }

  function atualizarCondicionais() {
    atualizarIdade();
    atualizarMinisterio();
    atualizarAppsOutro();
    atualizarContadores();
  }

  // "Nenhum por enquanto" não combina com os outros equipamentos.
  function tratarEquipamento(el) {
    if (el.name !== 'equipamento' || !el.checked) return;
    var nenhum = $('#equip-nenhum');
    if (el === nenhum) {
      $$('input[name="equipamento"]', form).forEach(function (c) { if (c !== nenhum) c.checked = false; });
    } else {
      nenhum.checked = false;
    }
  }

  function atualizarContadores() {
    $$('.contador', form).forEach(function (c) {
      var campo = form.elements[c.getAttribute('data-for')];
      var min = +campo.closest('.field').getAttribute('data-min');
      var n = campo.value.trim().length;
      c.textContent = n >= min ? n + ' caracteres' : n + ' de ' + min + ' caracteres mínimos';
      c.classList.toggle('ok', n >= min);
    });
  }

  // ---------- Navegação entre etapas ----------

  function atualizarProgresso(i) {
    var rotulo = i === 0 ? 'Abertura' : 'Bloco ' + i + ' de ' + ultimaEtapa + ' · ' + NOMES_ETAPAS[i];
    $('#progresso-texto').textContent = rotulo;
    $('#progresso-preenchido').style.width = ((i + 1) / steps.length * 100) + '%';
    var barra = $('#progresso-barra');
    barra.setAttribute('aria-valuenow', String(i + 1));
    barra.setAttribute('aria-valuetext', rotulo);
  }

  function mostrarEtapa(i, empilhar) {
    steps.forEach(function (s, idx) { s.hidden = idx !== i; });
    atual = i;
    atualizarProgresso(i);
    if (empilhar) {
      try { history.pushState({ etapa: i }, ''); } catch (e) { /* sem histórico, segue sem ele */ }
    }
    window.scrollTo(0, 0);
    var titulo = $('h1, h2', steps[i]);
    if (titulo) titulo.focus({ preventScroll: true });
  }

  function avancar() {
    var invalido = validarEtapa(atual);
    if (invalido) { focarCampo(invalido); return; }
    if (atual < ultimaEtapa) mostrarEtapa(atual + 1, true);
  }

  // history.back() é assíncrono: até o popstate chegar, ignora novos toques
  // em Voltar/Continuar para não pular etapas.
  var aguardandoHistorico = false;
  var timerHistorico = null;

  function liberarNavegacao() {
    aguardandoHistorico = false;
    clearTimeout(timerHistorico);
  }

  function voltar() {
    if (atual === 0) return;
    if (history.state && history.state.etapa === atual) {
      aguardandoHistorico = true;
      timerHistorico = setTimeout(liberarNavegacao, 1000);
      history.back(); // o popstate mostra a etapa anterior
    } else {
      mostrarEtapa(atual - 1, false);
    }
  }

  // Botão "voltar" do celular volta uma etapa em vez de sair da página.
  window.addEventListener('popstate', function (e) {
    liberarNavegacao();
    if (concluido) return;
    var alvo = e.state && typeof e.state.etapa === 'number' ? e.state.etapa : 0;
    if (alvo > atual) {
      for (var i = atual; i < alvo; i++) {
        var invalido = validarEtapa(i);
        if (invalido) {
          mostrarEtapa(i, false);
          try { history.replaceState({ etapa: i }, ''); } catch (err) { /* ignora */ }
          focarCampo(invalido);
          return;
        }
      }
    }
    mostrarEtapa(Math.max(0, Math.min(alvo, ultimaEtapa)), false);
  });

  // ---------- Rascunho (só neste aparelho) ----------

  var timerRascunho = null;

  function salvarRascunho() {
    clearTimeout(timerRascunho);
    timerRascunho = setTimeout(function () {
      if (concluido) return;
      try {
        var dados = {};
        Array.prototype.forEach.call(form.elements, function (el) {
          if (!el.name || el.name === 'website') return;
          if (el.type === 'checkbox') {
            dados[el.name] = dados[el.name] || [];
            if (el.checked) dados[el.name].push(el.value);
          } else if (el.type === 'radio') {
            if (el.checked) dados[el.name] = el.value;
          } else {
            dados[el.name] = el.value;
          }
        });
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ salvoEm: Date.now(), dados: dados }));
      } catch (e) { /* armazenamento indisponível: o formulário funciona sem rascunho */ }
    }, 400);
  }

  function apagarRascunho() {
    clearTimeout(timerRascunho);
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignora */ }
  }

  function restaurarRascunho() {
    var salvo;
    try { salvo = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { return false; }
    if (!salvo || !salvo.dados || typeof salvo.dados !== 'object') return false;
    if (!salvo.salvoEm || Date.now() - salvo.salvoEm > DRAFT_VALIDADE_MS) { apagarRascunho(); return false; }

    var d = salvo.dados;
    var algo = false;
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.name === 'website' || !(el.name in d)) return;
      var v = d[el.name];
      if (el.type === 'checkbox') {
        el.checked = Array.isArray(v) && v.indexOf(el.value) !== -1;
        if (el.checked) algo = true;
      } else if (el.type === 'radio') {
        el.checked = v === el.value;
        if (el.checked) algo = true;
      } else if (typeof v === 'string') {
        el.value = v;
        if (v.trim()) algo = true;
      }
    });
    return algo;
  }

  // ---------- Envio ----------

  function montarDados() {
    var idade = idadeAtual();
    var menor = idade !== null && idade < 18;
    var apps = valoresMarcados('apps').map(function (a) {
      return a === 'Outro' && texto('appsOutro') ? 'Outro: ' + texto('appsOutro') : a;
    });
    var compromissos = valoresMarcados('compromissos');
    if (menor && $('#responsavelAutoriza').checked) compromissos.push('Responsável autoriza (menor)');

    return {
      website: form.elements.website.value,
      nome: texto('nome'),
      whatsapp: texto('whatsapp'),
      nascimento: texto('nascimento'),
      responsavelNome: menor ? texto('responsavelNome') : '',
      responsavelWhatsapp: menor ? texto('responsavelWhatsapp') : '',
      bairroCidade: texto('bairroCidade'),
      tempoIgreja: valorRadio('tempoIgreja'),
      batismo: valorRadio('batismo'),
      outroMinisterio: valorRadio('outroMinisterio'),
      outroMinisterioQual: valorRadio('outroMinisterio') === 'Sim' ? texto('outroMinisterioQual') : '',
      motivacao: texto('motivacao'),
      situacional: texto('situacional'),
      areas: valoresMarcados('areas'),
      apps: apps,
      aprendizado: texto('aprendizado'),
      link: normalizarLink(texto('link')),
      equipamento: valoresMarcados('equipamento'),
      cultos: valoresMarcados('cultos'),
      frequencia: valorRadio('frequencia'),
      compromissos: compromissos
    };
  }

  function mostrarErroEnvio(linhas) {
    var box = $('#erro-envio');
    box.textContent = '';
    linhas.forEach(function (l) {
      var p = document.createElement('p');
      p.textContent = l;
      box.appendChild(p);
    });
    box.hidden = false;
    box.scrollIntoView({ block: 'center' });
  }

  function urlConfigurada() {
    return /^https:\/\/script\.google(usercontent)?\.com\//.test(config.url);
  }

  function enviar() {
    if (enviando) return;
    $('#erro-envio').hidden = true;

    // Confere todas as etapas (o "avançar" do navegador pode ter pulado alguma).
    for (var i = 1; i <= ultimaEtapa; i++) {
      var invalido = validarEtapa(i);
      if (invalido) {
        if (i !== atual) mostrarEtapa(i, false);
        focarCampo(invalido);
        return;
      }
    }

    var decorrido = (Date.now() - abertoEm) / 1000;
    if (decorrido < MIN_SEGUNDOS) {
      mostrarErroEnvio(['Envio muito rápido. Espere alguns segundos e toque em "Enviar inscrição" de novo.']);
      return;
    }

    if (!urlConfigurada()) {
      mostrarErroEnvio([
        'O formulário ainda não está ligado à planilha.',
        'Avise a liderança de mídia. Seus dados continuam preenchidos aqui.'
      ]);
      return;
    }

    var dados = montarDados();
    var botao = $('#botao-enviar');
    enviando = true;
    botao.disabled = true;
    botao.textContent = 'Enviando…';
    form.setAttribute('aria-busy', 'true');

    var controle = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (controle) controle.abort(); }, TIMEOUT_ENVIO_MS);

    fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(dados),
      redirect: 'follow',
      signal: controle ? controle.signal : undefined
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (resposta) {
        if (!resposta || resposta.ok !== true) {
          var e = new Error('recusado');
          e.servidor = resposta && resposta.error ? String(resposta.error) : '';
          throw e;
        }
        concluir(dados);
      })
      .catch(function (err) {
        var linhas = ['Não foi possível enviar sua inscrição.'];
        if (err && err.servidor) {
          linhas.push(err.servidor);
        } else {
          linhas.push('Confira sua conexão com a internet e tente de novo.');
        }
        linhas.push('Seus dados continuam preenchidos.');
        mostrarErroEnvio(linhas);
      })
      .then(function () {
        clearTimeout(timer);
        enviando = false;
        if (!concluido) {
          botao.disabled = false;
          botao.textContent = 'Enviar inscrição';
          form.removeAttribute('aria-busy');
        }
      });
  }

  function concluir(dados) {
    concluido = true;
    apagarRascunho();
    var primeiroNome = dados.nome.split(/\s+/)[0];
    $('#t-ok').textContent = 'Inscrição recebida, ' + primeiroNome + '!';
    var lider = config.lider ? 'o líder de mídia, ' + config.lider : 'o líder de mídia';
    $('#texto-ok').textContent = 'O próximo passo é uma conversa com ' + lider +
      '. Ele vai te chamar no WhatsApp ' + dados.whatsapp + ' nos próximos dias.';
    form.hidden = true;
    $('#progresso').hidden = true;
    var ok = $('#confirmacao');
    ok.hidden = false;
    try { history.replaceState({ concluido: true }, ''); } catch (e) { /* ignora */ }
    window.scrollTo(0, 0);
    $('#t-ok').focus({ preventScroll: true });
    form.reset();
  }

  // ---------- Eventos ----------

  form.addEventListener('click', function (e) {
    var botao = e.target.closest('[data-action]');
    if (!botao || aguardandoHistorico) return;
    if (botao.getAttribute('data-action') === 'next') avancar();
    else voltar();
  });

  // Enter num campo de texto avança a etapa; o envio só acontece na última.
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (aguardandoHistorico) return;
    if (atual < ultimaEtapa) avancar();
    else enviar();
  });

  form.addEventListener('input', function (e) {
    var el = e.target;
    if (el.getAttribute('data-mask') === 'phone') aplicarMascaraTelefone(el, e);
    if (el.name === 'nascimento') atualizarIdade();
    if (el.tagName === 'TEXTAREA') atualizarContadores();
    revalidarSeComErro(el);
    salvarRascunho();
  });

  form.addEventListener('change', function (e) {
    var el = e.target;
    tratarEquipamento(el);
    if (el.name === 'nascimento') atualizarIdade();
    if (el.name === 'outroMinisterio') atualizarMinisterio();
    if (el.name === 'apps') atualizarAppsOutro();
    revalidarSeComErro(el);
    salvarRascunho();
  });

  $('#apagar-rascunho').addEventListener('click', function () {
    apagarRascunho();
    form.reset();
    limparErros(form);
    atualizarCondicionais();
    $('#aviso-rascunho').hidden = true;
    $('#t0').focus();
  });

  // ---------- Início ----------

  montarCultos();
  ligarDescricoes();
  form.elements.nascimento.max = hojeISO();
  if (restaurarRascunho()) $('#aviso-rascunho').hidden = false;
  $$('[data-mask="phone"]', form).forEach(function (el) { aplicarMascaraTelefone(el); });
  atualizarCondicionais();
  try { history.replaceState({ etapa: 0 }, ''); } catch (e) { /* ignora */ }
  mostrarEtapa(0, false);
})();
