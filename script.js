const DB = {
  get: (k) => JSON.parse(localStorage.getItem(k)) || [],
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v))
};

const EMPRESA_PADRAO = {
  razaoSocial: "63.696.962 ANDRESSA RIKACZEWSKI RIBEIRO SAI",
  cnpj: "63.696.962/0001-47",
  endereco: "R MARCELINO PARZIANELLO, 481, GRALHA AZUL, PATO BRANCO/PR, CEP 85.508-320",
  email: "ARCABABYLOJA@OUTLOOK.COM",
  telefone: "(46) 9103-8286",
  cidade: "Pato Branco",
  estado: "PR"
};

let chartVendas = null;
let chartVendedor = null;
let carrinhoVenda = [];

function uid() {
  return Date.now() + Math.floor(Math.random() * 1000000);
}

function moeda(v) {
  return Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function arred2(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

function formatarDataBR(data) {
  return data.toLocaleDateString('pt-BR');
}

function parseDataBR(dataStr) {
  if (!dataStr) return null;
  const [dia, mes, ano] = dataStr.split('/').map(Number);
  return new Date(ano, mes - 1, dia);
}

function formatarDataISOparaBR(dataISO) {
  if (!dataISO) return '';
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarDataBRparaISO(dataBR) {
  if (!dataBR) return '';
  const [dia, mes, ano] = dataBR.split('/');
  return `${ano}-${mes}-${dia}`;
}

function adicionarDias(data, dias) {
  const nova = new Date(data);
  nova.setDate(nova.getDate() + dias);
  return nova;
}

function hojeISO() {
  return new Date().toISOString().split('T')[0];
}

function competenciaAtual() {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
}

function obterCompetenciaDeDataBR(dataBR) {
  const dt = parseDataBR(dataBR);
  if (!dt) return '';
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

function dataDentroDoPeriodo(dataBR, inicioISO, fimISO) {
  const data = parseDataBR(dataBR);
  if (!data) return false;

  let okInicio = true;
  let okFim = true;

  if (inicioISO) {
    const inicio = new Date(inicioISO + 'T00:00:00');
    okInicio = data >= inicio;
  }

  if (fimISO) {
    const fim = new Date(fimISO + 'T23:59:59');
    okFim = data <= fim;
  }

  return okInicio && okFim;
}

function calcularParcelas(total, qtdParcelas) {
  const totalCentavos = Math.round(Number(total) * 100);
  const base = Math.floor(totalCentavos / qtdParcelas);
  const resto = totalCentavos % qtdParcelas;

  const parcelas = [];
  for (let i = 0; i < qtdParcelas; i++) {
    const centavos = base + (i < resto ? 1 : 0);
    parcelas.push(centavos / 100);
  }
  return parcelas;
}

function gerarEAN13() {
  const base12 = String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  const digits = base12.split('').map(Number);
  let soma = 0;
  for (let i = 0; i < 12; i++) soma += digits[i] * (i % 2 === 0 ? 1 : 3);
  const digitoVerificador = (10 - (soma % 10)) % 10;
  return base12 + digitoVerificador;
}

function desenharCodigoBarrasJsPDF(doc, codigo, x, y, larguraTotal, altura) {
  const digits = String(codigo).replace(/\D/g, '');
  if (!digits) return;
  const bits = digits
    .split('')
    .map(d => Number(d).toString(2).padStart(4, '0'))
    .join('');
  const totalBits = bits.length;
  const larguraBarra = larguraTotal / totalBits;

  for (let i = 0; i < totalBits; i++) {
    if (bits[i] === '1') {
      doc.rect(x + i * larguraBarra, y, larguraBarra, altura, 'F');
    }
  }
}

function obterEmpresa() {
  const dados = localStorage.getItem('empresaDados');
  if (dados) return JSON.parse(dados);
  localStorage.setItem('empresaDados', JSON.stringify(EMPRESA_PADRAO));
  return EMPRESA_PADRAO;
}

function obterSaldosIniciais() {
  return DB.get('saldosIniciais');
}

function salvarSaldosIniciais(dados) {
  DB.set('saldosIniciais', dados);
}

function saldoInicialConta(nomeConta) {
  const saldos = obterSaldosIniciais();
  return Number(saldos[nomeConta] || 0);
}

function confirmar(mensagem) {
  return window.confirm(mensagem);
}

function badgeStatus(status) {
  if (status === 'Pago') return `<span class="badge-status badge-pago">Pago</span>`;
  if (status === 'Recebido') return `<span class="badge-status badge-recebido">Recebido</span>`;
  if (status === 'Realizado') return `<span class="badge-status badge-realizado">Realizado</span>`;
  if (status === 'Previsto') return `<span class="badge-status badge-previsto">Previsto</span>`;
  return `<span class="badge-status badge-aberto">${status || 'Aberto'}</span>`;
}

/* =========================
   VÍNCULOS ENTRE MÓDULOS
========================= */

function criarFluxoVinculado({
  origemTipo,
  origemId,
  desc,
  valor,
  tipo,
  dataBR,
  conta,
  statusFluxo = 'Previsto'
}) {
  const fluxo = DB.get('fluxo');
  fluxo.push({
    id: uid(),
    origemTipo,
    origemId,
    desc,
    valor,
    tipo,
    data: dataBR,
    conta,
    banco: conta,
    statusFluxo
  });
  DB.set('fluxo', fluxo);
}

function atualizarFluxoVinculado(origemTipo, origemId, patch) {
  let fluxo = DB.get('fluxo');
  fluxo = fluxo.map(item =>
    item.origemTipo === origemTipo && item.origemId === origemId
      ? { ...item, ...patch }
      : item
  );
  DB.set('fluxo', fluxo);
}

function excluirFluxoVinculado(origemTipo, origemId) {
  let fluxo = DB.get('fluxo');
  fluxo = fluxo.filter(item => !(item.origemTipo === origemTipo && item.origemId === origemId));
  DB.set('fluxo', fluxo);
}

/* =========================
   LOGIN / MENU
========================= */

function login() {
  let users = DB.get('users');

  if (users.length === 0) {
    users = [{ u: 'admin', p: '123' }];
    DB.set('users', users);
  }

  const usuario = document.getElementById('user').value.trim();
  const senha = document.getElementById('pass').value.trim();
  const ok = users.find(x => x.u === usuario && x.p === senha);

  if (ok) {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').classList.remove('hidden');
    iniciarPadroes();
    loadAll();
    show('dashboard');
  } else {
    alert('Login inválido');
  }
}

function logout() {
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login').style.display = 'flex';
}

function toggleMenu() {
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('mainContent');

  sidebar.classList.toggle('collapsed');
  mainContent.classList.toggle('expanded');

  if (sidebar.classList.contains('collapsed')) {
    document.querySelectorAll('.submenu').forEach(sub => {
      sub.classList.remove('aberto');
      sub.style.display = 'none';
    });
  }
}

function toggleSub(id) {
  const sidebar = document.getElementById('sidebar');
  if (sidebar.classList.contains('collapsed')) return;

  const submenu = document.getElementById(id);
  submenu.classList.toggle('aberto');
  submenu.style.display = submenu.classList.contains('aberto') ? 'block' : 'none';
}

function show(id) {
  [
    'dashboard',
    'produtos',
    'clientes',
    'novoCliente',
    'vendedores',
    'novoVendedorTela',
    'vendas',
    'fluxo',
    'receber',
    'pagar',
    'config',
    'relatorios'
  ].forEach(s => {
    const el = document.getElementById(s);
    if (el) el.classList.add('hidden');
  });

  const alvo = document.getElementById(id);
  if (alvo) alvo.classList.remove('hidden');

  if (id === 'vendas') {
    preencherDadosProdutoVenda();
    renderCarrinhoVenda();
    toggleParcelasVenda();
  }

  if (id === 'fluxo') loadFluxo();
  if (id === 'pagar') loadPagar();
  if (id === 'receber') loadReceber();
  if (id === 'relatorios') loadRelatorios();
}

function trocarPerfil(nome) {
  localStorage.setItem('perfilAtivo', nome);
  alert('Perfil alterado para: ' + nome);
}

/* =========================
   DADOS INICIAIS
========================= */

function iniciarPadroes() {
  if (DB.get('users').length === 0) DB.set('users', [{ u: 'admin', p: '123' }]);

  if (DB.get('vendedoresCadastro').length === 0) {
    DB.set('vendedoresCadastro', [
      { id: 1, nome: 'João Pereira', cpf: '222.222.222-22', telefone: '(43) 3333-2222', whats: '(43) 99999-2222', email: 'joao@empresa.com', cargo: 'Vendedor' },
      { id: 2, nome: 'Maria Costa', cpf: '333.333.333-33', telefone: '(43) 3333-3333', whats: '(43) 99999-3333', email: 'maria@empresa.com', cargo: 'Vendedora' }
    ]);
  }

  sincronizarListaSimplesVendedores();

  if (DB.get('bancos').length === 0) DB.set('bancos', ['Banco do Brasil', 'Nubank']);

  if (Object.keys(obterSaldosIniciais()).length === 0) {
    salvarSaldosIniciais({
      Caixa: 0,
      'Banco do Brasil': 0,
      Nubank: 0
    });
  }

  if (DB.get('produtos').length === 0) {
    DB.set('produtos', [
      { id: 1, nome: 'Camiseta Básica', custo: 25, preco: 59.9, qtd: 30, codigoBarras: gerarEAN13() },
      { id: 2, nome: 'Calça Jeans', custo: 70, preco: 149.9, qtd: 20, codigoBarras: gerarEAN13() },
      { id: 3, nome: 'Boné', custo: 15, preco: 39.9, qtd: 50, codigoBarras: gerarEAN13() }
    ]);
  } else {
    const produtos = DB.get('produtos').map(p => ({ ...p, codigoBarras: p.codigoBarras || gerarEAN13() }));
    DB.set('produtos', produtos);
  }

  if (DB.get('clientes').length === 0) {
    DB.set('clientes', [
      {
        id: 1,
        nome: 'Lucas Silva',
        cpf: '000.000.000-00',
        rg: '0.000.000-0',
        rua: 'Rua Exemplo, 123',
        cep: '86300-000',
        bairro: 'Centro',
        cidade: 'Sertanópolis',
        estado: 'PR',
        pais: 'Brasil',
        fixo: '(43) 3333-0000',
        whats: '(43) 99999-0000',
        email: 'lucas@email.com'
      }
    ]);
  }

  if (DB.get('vendas').length === 0) DB.set('vendas', []);
  if (DB.get('fluxo').length === 0) DB.set('fluxo', []);
  if (DB.get('receber').length === 0) DB.set('receber', []);
  if (DB.get('pagar').length === 0) DB.set('pagar', []);
  if (!localStorage.getItem('meta')) localStorage.setItem('meta', 10000);
  if (!localStorage.getItem('empresaDados')) localStorage.setItem('empresaDados', JSON.stringify(EMPRESA_PADRAO));
}

/* =========================
   CONFIG / SALDOS
========================= */

function loadConfig() {
  const vendedoresCadastro = DB.get('vendedoresCadastro');
  const bancos = DB.get('bancos');
  const metaInput = document.getElementById('meta');
  const vendedorSelect = document.getElementById('v_vendedor');
  const bancoSelect = document.getElementById('v_banco');
  const contaSaldoInicial = document.getElementById('contaSaldoInicial');
  const fConta = document.getElementById('f_conta');
  const pgConta = document.getElementById('pg_conta');
  const empresa = obterEmpresa();

  if (vendedorSelect) {
    vendedorSelect.innerHTML = vendedoresCadastro.length
      ? vendedoresCadastro.map(v => `<option value="${v.id}">${v.nome}</option>`).join('')
      : '<option value="">Sem vendedores</option>';
  }

  const listaContas = ['Caixa', ...bancos];

  if (bancoSelect) {
    bancoSelect.innerHTML = bancos.length
      ? bancos.map(b => `<option>${b}</option>`).join('')
      : '<option>Sem bancos</option>';
  }

  if (contaSaldoInicial) {
    contaSaldoInicial.innerHTML = listaContas.map(c => `<option>${c}</option>`).join('');
  }

  if (fConta) {
    fConta.innerHTML = listaContas.map(c => `<option>${c}</option>`).join('');
  }

  if (pgConta) {
    pgConta.innerHTML = listaContas.map(c => `<option>${c}</option>`).join('');
  }

  if (metaInput) metaInput.value = localStorage.getItem('meta') || '';

  document.getElementById('empresaRazao').innerText = empresa.razaoSocial;
  document.getElementById('empresaCnpj').innerText = empresa.cnpj;
  document.getElementById('empresaEndereco').innerText = empresa.endereco;
  document.getElementById('empresaEmail').innerText = empresa.email;
  document.getElementById('empresaTelefone').innerText = empresa.telefone;
}

function salvarMeta() {
  localStorage.setItem('meta', document.getElementById('meta').value || 0);
  loadDashboard();
  alert('Meta salva.');
}

function addBanco() {
  const nome = document.getElementById('novoBanco').value.trim();
  if (!nome) return alert('Informe o nome do banco.');

  let bancos = DB.get('bancos');
  if (!bancos.includes(nome)) bancos.push(nome);
  DB.set('bancos', bancos);

  const saldos = obterSaldosIniciais();
  if (typeof saldos[nome] === 'undefined') saldos[nome] = 0;
  salvarSaldosIniciais(saldos);

  document.getElementById('novoBanco').value = '';
  loadConfig();
  loadFluxo();
}

function addUser() {
  const u = document.getElementById('novoUser').value.trim();
  const p = document.getElementById('novoPass').value.trim();
  if (!u || !p) return alert('Informe usuário e senha.');

  let users = DB.get('users');
  users.push({ u, p });
  DB.set('users', users);

  document.getElementById('novoUser').value = '';
  document.getElementById('novoPass').value = '';
  alert('Usuário criado.');
}

function salvarSaldoInicialCaixa() {
  const valor = Number(document.getElementById('saldoInicialCaixa').value || 0);
  const saldos = obterSaldosIniciais();
  saldos['Caixa'] = valor;
  salvarSaldosIniciais(saldos);
  loadFluxo();
  loadDashboard();
  alert('Caixa inicial salvo.');
}

function salvarSaldoInicialConta() {
  const conta = document.getElementById('contaSaldoInicial').value;
  const valor = Number(document.getElementById('valorSaldoInicialConta').value || 0);
  const saldos = obterSaldosIniciais();
  saldos[conta] = valor;
  salvarSaldosIniciais(saldos);
  loadFluxo();
  loadDashboard();
  alert('Saldo inicial da conta salvo.');
}

function calcularSaldosPorConta() {
  const bancos = DB.get('bancos');
  const fluxo = DB.get('fluxo');
  const saldos = {};

  saldos["Caixa"] = saldoInicialConta("Caixa");
  bancos.forEach(b => {
    saldos[b] = saldoInicialConta(b);
  });

  fluxo
    .filter(item => item.statusFluxo === 'Realizado' || !item.statusFluxo)
    .forEach(item => {
      const conta = item.conta || item.banco || 'Caixa';
      if (typeof saldos[conta] === 'undefined') saldos[conta] = saldoInicialConta(conta);

      const valor = Number(item.valor || 0);
      if (item.tipo === 'Entrada') saldos[conta] += valor;
      else saldos[conta] -= valor;
    });

  return saldos;
}

function totalContasBancarias() {
  const saldos = calcularSaldosPorConta();
  let total = 0;
  Object.keys(saldos).forEach(conta => {
    if (conta !== 'Caixa') total += Number(saldos[conta] || 0);
  });
  return total;
}

/* =========================
   CLIENTES
========================= */

function addCliente() {
  const nome = document.getElementById('c_nome').value.trim();
  const cpf = document.getElementById('c_cpf').value.trim();
  const rg = document.getElementById('c_rg').value.trim();
  const rua = document.getElementById('c_rua').value.trim();
  const cep = document.getElementById('c_cep').value.trim();
  const bairro = document.getElementById('c_bairro').value.trim();
  const cidade = document.getElementById('c_cidade').value.trim();
  const estado = document.getElementById('c_estado').value.trim();
  const pais = document.getElementById('c_pais').value.trim();
  const fixo = document.getElementById('c_fixo').value.trim();
  const whats = document.getElementById('c_whats').value.trim();
  const email = document.getElementById('c_email').value.trim();
  const erro = document.getElementById('erroCliente');

  if (!nome || !cpf || !rg || !rua || !cep || !bairro || !cidade || !estado || !pais || !fixo || !whats || !email) {
    erro.classList.remove('hidden');
    return;
  }

  erro.classList.add('hidden');

  let lista = DB.get('clientes');
  const editando = localStorage.getItem('clienteEditando');

  const dados = {
    id: editando ? Number(editando) : uid(),
    nome, cpf, rg, rua, cep, bairro, cidade, estado, pais, fixo, whats, email
  };

  if (editando) lista = lista.map(c => c.id === Number(editando) ? dados : c);
  else lista.push(dados);

  DB.set('clientes', lista);
  limparFormularioCliente();
  loadClientes();
  show('clientes');
}

function loadClientes() {
  const lista = DB.get('clientes');

  document.getElementById('t_clientes').innerHTML =
    '<tr><th>Nome</th><th>CPF</th><th>WhatsApp</th><th>E-mail</th><th>Ações</th></tr>' +
    lista.map(c => `
      <tr>
        <td>${c.nome}</td>
        <td>${c.cpf}</td>
        <td>${c.whats}</td>
        <td>${c.email}</td>
        <td>
          <button onclick="editarCliente(${c.id})">✏️</button>
          <button class="btn-danger" onclick="excluirCliente(${c.id})">🗑️</button>
        </td>
      </tr>
    `).join('');

  const selectCliente = document.getElementById('v_cliente');
  if (selectCliente) {
    selectCliente.innerHTML = lista.length
      ? lista.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')
      : '<option value="">Sem clientes</option>';
  }
}

function editarCliente(id) {
  const lista = DB.get('clientes');
  const cliente = lista.find(c => c.id === id);
  if (!cliente) return;

  document.getElementById('c_nome').value = cliente.nome || '';
  document.getElementById('c_cpf').value = cliente.cpf || '';
  document.getElementById('c_rg').value = cliente.rg || '';
  document.getElementById('c_rua').value = cliente.rua || '';
  document.getElementById('c_cep').value = cliente.cep || '';
  document.getElementById('c_bairro').value = cliente.bairro || '';
  document.getElementById('c_cidade').value = cliente.cidade || '';
  document.getElementById('c_estado').value = cliente.estado || '';
  document.getElementById('c_pais').value = cliente.pais || '';
  document.getElementById('c_fixo').value = cliente.fixo || '';
  document.getElementById('c_whats').value = cliente.whats || '';
  document.getElementById('c_email').value = cliente.email || '';

  localStorage.setItem('clienteEditando', id);
  show('novoCliente');
}

function excluirCliente(id) {
  if (!confirmar('Deseja realmente excluir este cliente?')) return;
  let lista = DB.get('clientes');
  lista = lista.filter(c => c.id !== id);
  DB.set('clientes', lista);
  loadClientes();
}

function limparFormularioCliente() {
  ['c_nome','c_cpf','c_rg','c_rua','c_cep','c_bairro','c_cidade','c_estado','c_pais','c_fixo','c_whats','c_email']
    .forEach(id => document.getElementById(id).value = '');
  document.getElementById('erroCliente').classList.add('hidden');
  localStorage.removeItem('clienteEditando');
}

/* =========================
   VENDEDORES
========================= */

function addVendedorCadastro() {
  const nome = document.getElementById('vd_nome').value.trim();
  const cpf = document.getElementById('vd_cpf').value.trim();
  const telefone = document.getElementById('vd_telefone').value.trim();
  const whats = document.getElementById('vd_whats').value.trim();
  const email = document.getElementById('vd_email').value.trim();
  const cargo = document.getElementById('vd_cargo').value.trim();
  const erro = document.getElementById('erroVendedor');

  if (!nome || !cpf || !telefone || !whats || !email || !cargo) {
    erro.classList.remove('hidden');
    return;
  }

  erro.classList.add('hidden');

  let lista = DB.get('vendedoresCadastro');
  const editando = localStorage.getItem('vendedorEditando');

  const dados = {
    id: editando ? Number(editando) : uid(),
    nome, cpf, telefone, whats, email, cargo
  };

  if (editando) lista = lista.map(v => v.id === Number(editando) ? dados : v);
  else lista.push(dados);

  DB.set('vendedoresCadastro', lista);
  sincronizarListaSimplesVendedores();
  limparFormularioVendedor();
  loadVendedores();
  show('vendedores');
}

function addVendedor() {
  const nome = document.getElementById('novoVendedor').value.trim();
  if (!nome) return alert('Informe o nome do vendedor.');

  let cadastro = DB.get('vendedoresCadastro');
  cadastro.push({
    id: uid(),
    nome,
    cpf: '',
    telefone: '',
    whats: '',
    email: '',
    cargo: 'Vendedor'
  });

  DB.set('vendedoresCadastro', cadastro);
  sincronizarListaSimplesVendedores();
  document.getElementById('novoVendedor').value = '';
  loadVendedores();
  loadConfig();
}

function loadVendedores() {
  const lista = DB.get('vendedoresCadastro');

  document.getElementById('t_vendedores').innerHTML =
    '<tr><th>Nome</th><th>CPF</th><th>WhatsApp</th><th>E-mail</th><th>Cargo</th><th>Ações</th></tr>' +
    lista.map(v => `
      <tr>
        <td>${v.nome}</td>
        <td>${v.cpf || '-'}</td>
        <td>${v.whats || '-'}</td>
        <td>${v.email || '-'}</td>
        <td>${v.cargo || '-'}</td>
        <td>
          <button onclick="editarVendedor(${v.id})">✏️</button>
          <button class="btn-danger" onclick="excluirVendedor(${v.id})">🗑️</button>
        </td>
      </tr>
    `).join('');
}

function editarVendedor(id) {
  const lista = DB.get('vendedoresCadastro');
  const vendedor = lista.find(v => v.id === id);
  if (!vendedor) return;

  document.getElementById('vd_nome').value = vendedor.nome || '';
  document.getElementById('vd_cpf').value = vendedor.cpf || '';
  document.getElementById('vd_telefone').value = vendedor.telefone || '';
  document.getElementById('vd_whats').value = vendedor.whats || '';
  document.getElementById('vd_email').value = vendedor.email || '';
  document.getElementById('vd_cargo').value = vendedor.cargo || '';

  localStorage.setItem('vendedorEditando', id);
  show('novoVendedorTela');
}

function excluirVendedor(id) {
  if (!confirmar('Deseja realmente excluir este vendedor?')) return;
  let lista = DB.get('vendedoresCadastro');
  lista = lista.filter(v => v.id !== id);
  DB.set('vendedoresCadastro', lista);
  sincronizarListaSimplesVendedores();
  loadVendedores();
  loadConfig();
}

function limparFormularioVendedor() {
  ['vd_nome','vd_cpf','vd_telefone','vd_whats','vd_email','vd_cargo']
    .forEach(id => document.getElementById(id).value = '');
  document.getElementById('erroVendedor').classList.add('hidden');
  localStorage.removeItem('vendedorEditando');
}

function cancelarEdicaoVendedor() {
  limparFormularioVendedor();
  show('vendedores');
}

function sincronizarListaSimplesVendedores() {
  const cadastro = DB.get('vendedoresCadastro');
  DB.set('vendedores', cadastro.map(v => v.nome));
}

/* =========================
   PRODUTOS
========================= */

function addProduto() {
  const nome = document.getElementById('p_nome').value.trim();
  const custo = Number(document.getElementById('p_custo').value);
  const preco = Number(document.getElementById('p_preco').value);
  const qtd = Number(document.getElementById('p_qtd').value);

  if (!nome || custo < 0 || preco < 0 || qtd < 0) {
    alert('Preencha os dados do produto corretamente.');
    return;
  }

  let lista = DB.get('produtos');
  lista.push({
    id: uid(),
    nome,
    custo,
    preco,
    qtd,
    codigoBarras: gerarEAN13()
  });

  DB.set('produtos', lista);

  document.getElementById('p_nome').value = '';
  document.getElementById('p_custo').value = '';
  document.getElementById('p_preco').value = '';
  document.getElementById('p_qtd').value = '';

  loadProdutos();
  loadRelatorios();
}

function loadProdutos() {
  const lista = DB.get('produtos');

  document.getElementById('t_produtos').innerHTML =
    '<tr><th>Nome</th><th>Código de Barras</th><th>Custo</th><th>Preço</th><th>Qtd</th></tr>' +
    lista.map(p => `
      <tr>
        <td>${p.nome}</td>
        <td>${p.codigoBarras || '-'}</td>
        <td>${moeda(p.custo)}</td>
        <td>${moeda(p.preco)}</td>
        <td>${p.qtd}</td>
      </tr>
    `).join('');

  const selectProduto = document.getElementById('v_produto');
  if (selectProduto) {
    selectProduto.innerHTML = lista.length
      ? lista.map(p => `<option value="${p.id}">${p.nome}</option>`).join('')
      : '<option value="">Sem produtos</option>';
  }

  preencherDadosProdutoVenda();
}

/* =========================
   VENDAS / CARRINHO
========================= */

function preencherDadosProdutoVenda() {
  const produtoId = Number(document.getElementById('v_produto')?.value);
  const produtos = DB.get('produtos');
  const produto = produtos.find(p => p.id === produtoId);

  const cod = document.getElementById('v_codigo_barra');
  const preco = document.getElementById('v_preco_unit');

  if (!produto) {
    if (cod) cod.value = '';
    if (preco) preco.value = '';
    return;
  }

  cod.value = produto.codigoBarras || '';
  preco.value = moeda(produto.preco);
  atualizarPreviewParcelas();
}

function buscarProdutoPorCodigo() {
  const codigo = document.getElementById('v_busca_codigo').value.trim();
  if (!codigo) return alert('Informe o código de barras.');

  const produtos = DB.get('produtos');
  const produto = produtos.find(p => String(p.codigoBarras) === codigo);

  if (!produto) return alert('Produto não encontrado para este código.');

  document.getElementById('v_produto').value = produto.id;
  preencherDadosProdutoVenda();
}

function calcularDescontoItem(subtotal, tipo, valorInformado) {
  const valor = Number(valorInformado || 0);

  if (tipo === 'percentual') {
    const desconto = subtotal * (valor / 100);
    return desconto > subtotal ? subtotal : desconto;
  }

  if (tipo === 'valor') return valor > subtotal ? subtotal : valor;
  return 0;
}

function adicionarItemCarrinho() {
  const produtoId = Number(document.getElementById('v_produto').value);
  const qtd = Number(document.getElementById('v_qtd').value || 1);
  const descontoTipo = document.getElementById('v_desc_tipo').value;
  const descontoValor = Number(document.getElementById('v_desc_valor').value || 0);

  if (!produtoId || qtd <= 0) return alert('Informe produto e quantidade válidos.');

  const produtos = DB.get('produtos');
  const produto = produtos.find(p => p.id === produtoId);
  if (!produto) return alert('Produto inválido.');

  const qtdNoCarrinho = carrinhoVenda
    .filter(i => i.produtoId === produtoId)
    .reduce((acc, item) => acc + item.qtd, 0);

  if ((qtd + qtdNoCarrinho) > Number(produto.qtd || 0)) {
    return alert('Quantidade maior que o estoque disponível.');
  }

  const subtotal = arred2(produto.preco * qtd);
  const desconto = arred2(calcularDescontoItem(subtotal, descontoTipo, descontoValor));
  const total = arred2(subtotal - desconto);

  carrinhoVenda.push({
    itemId: uid(),
    produtoId: produto.id,
    produto: produto.nome,
    codigoBarras: produto.codigoBarras || '',
    qtd,
    precoUnit: Number(produto.preco),
    custoUnit: Number(produto.custo),
    subtotal,
    descontoTipo,
    descontoValor,
    desconto,
    total
  });

  document.getElementById('v_qtd').value = 1;
  document.getElementById('v_desc_tipo').value = 'nenhum';
  document.getElementById('v_desc_valor').value = '';
  document.getElementById('v_busca_codigo').value = '';

  renderCarrinhoVenda();
  toggleParcelasVenda();
}

function removerItemCarrinho(itemId) {
  carrinhoVenda = carrinhoVenda.filter(i => i.itemId !== itemId);
  renderCarrinhoVenda();
  toggleParcelasVenda();
}

function limparCarrinhoVenda() {
  carrinhoVenda = [];
  renderCarrinhoVenda();
  toggleParcelasVenda();
}

function obterResumoCarrinho() {
  const subtotal = arred2(carrinhoVenda.reduce((acc, item) => acc + Number(item.subtotal || 0), 0));
  const desconto = arred2(carrinhoVenda.reduce((acc, item) => acc + Number(item.desconto || 0), 0));
  const total = arred2(carrinhoVenda.reduce((acc, item) => acc + Number(item.total || 0), 0));
  return { subtotal, desconto, total };
}

function renderCarrinhoVenda() {
  const tabela = document.getElementById('t_carrinho');
  if (!tabela) return;

  if (carrinhoVenda.length === 0) {
    tabela.innerHTML = `
      <tr>
        <th>Produto</th><th>Cód. Barras</th><th>Qtd</th><th>Unitário</th><th>Subtotal</th><th>Desconto</th><th>Total</th><th>Ações</th>
      </tr>
      <tr><td colspan="8" class="carrinho-vazio">Nenhum item adicionado à compra.</td></tr>
    `;
  } else {
    tabela.innerHTML =
      `<tr>
        <th>Produto</th><th>Cód. Barras</th><th>Qtd</th><th>Unitário</th><th>Subtotal</th><th>Desconto</th><th>Total</th><th>Ações</th>
      </tr>` +
      carrinhoVenda.map(item => `
        <tr>
          <td>${item.produto}</td>
          <td><small>${item.codigoBarras}</small></td>
          <td>${item.qtd}</td>
          <td>${moeda(item.precoUnit)}</td>
          <td>${moeda(item.subtotal)}</td>
          <td>${item.descontoTipo === 'percentual'
              ? `${item.descontoValor}% (${moeda(item.desconto)})`
              : item.descontoTipo === 'valor'
                ? `${moeda(item.desconto)}`
                : '-'
            }</td>
          <td>${moeda(item.total)}</td>
          <td><button class="btn-danger" onclick="removerItemCarrinho(${item.itemId})">Remover</button></td>
        </tr>
      `).join('');
  }

  const resumo = obterResumoCarrinho();
  document.getElementById('cartSubtotal').innerText = moeda(resumo.subtotal);
  document.getElementById('cartDesconto').innerText = moeda(resumo.desconto);
  document.getElementById('cartTotal').innerText = moeda(resumo.total);
}

function toggleParcelasVenda() {
  const pagamento = document.getElementById('v_pagamento').value;
  const wrap = document.getElementById('wrapParcelas');
  const parcelasInput = document.getElementById('v_parcelas');
  const valorParcelaInput = document.getElementById('v_valorParcela');
  const totalCarrinho = obterResumoCarrinho().total;

  if (pagamento === 'Fiado' || pagamento === 'Cartão') {
    wrap.classList.remove('hidden');
  } else {
    wrap.classList.add('hidden');
    parcelasInput.value = 1;
    valorParcelaInput.value = '';
    return;
  }

  if (!totalCarrinho || totalCarrinho <= 0) {
    valorParcelaInput.value = '';
    return;
  }

  const parcelas = Math.max(1, Number(parcelasInput.value || 1));
  const valores = calcularParcelas(totalCarrinho, parcelas);
  valorParcelaInput.value = moeda(valores[0]);
}

function atualizarPreviewParcelas() {
  toggleParcelasVenda();
}

function finalizarVenda() {
  let vendas = DB.get('vendas');
  let produtos = DB.get('produtos');
  let clientes = DB.get('clientes');
  let vendedoresCadastro = DB.get('vendedoresCadastro');
  let receber = DB.get('receber');

  const clienteId = Number(document.getElementById('v_cliente').value);
  const vendedorId = Number(document.getElementById('v_vendedor').value);
  const pagamento = document.getElementById('v_pagamento').value;
  const banco = document.getElementById('v_banco').value;
  const qtdParcelas = Math.max(1, Number(document.getElementById('v_parcelas')?.value || 1));

  if (!clienteId || !vendedorId) return alert('Selecione cliente e vendedor.');
  if (carrinhoVenda.length === 0) return alert('Adicione pelo menos um item à compra.');

  const cli = clientes.find(c => c.id === clienteId);
  const vendedor = vendedoresCadastro.find(v => v.id === vendedorId);

  if (!cli || !vendedor) return alert('Cliente ou vendedor inválido.');

  for (const item of carrinhoVenda) {
    const prod = produtos.find(p => p.id === item.produtoId);
    if (!prod) return alert(`Produto não encontrado: ${item.produto}`);
    if (Number(prod.qtd) < Number(item.qtd)) return alert(`Estoque insuficiente para o produto: ${item.produto}`);
  }

  for (const item of carrinhoVenda) {
    const prod = produtos.find(p => p.id === item.produtoId);
    prod.qtd -= item.qtd;
  }

  const resumo = obterResumoCarrinho();
  const custoTotal = arred2(carrinhoVenda.reduce((acc, item) => acc + (Number(item.custoUnit) * Number(item.qtd)), 0));
  const lucro = arred2(resumo.total - custoTotal);
  const dataVenda = new Date();
  const dataVendaBR = formatarDataBR(dataVenda);
  const valoresParcelas = calcularParcelas(resumo.total, qtdParcelas);

  const venda = {
    id: uid(),
    clienteId: cli.id,
    clienteNome: cli.nome,
    clienteDados: {
      cpf: cli.cpf || '',
      rg: cli.rg || '',
      rua: cli.rua || '',
      cep: cli.cep || '',
      bairro: cli.bairro || '',
      cidade: cli.cidade || '',
      estado: cli.estado || '',
      pais: cli.pais || '',
      fixo: cli.fixo || '',
      whats: cli.whats || '',
      email: cli.email || ''
    },
    itens: carrinhoVenda.map(item => ({ ...item })),
    subtotal: resumo.subtotal,
    descontoTotal: resumo.desconto,
    total: resumo.total,
    custoTotal,
    lucro,
    vendedorId: vendedor.id,
    vendedorNome: vendedor.nome,
    pagamento,
    banco,
    parcelas: qtdParcelas,
    valoresParcelas,
    data: dataVendaBR
  };

  vendas.push(venda);

  const parcelasQtd = (pagamento === 'Dinheiro' || pagamento === 'PIX') ? 1 : qtdParcelas;
  const valores = (pagamento === 'Dinheiro' || pagamento === 'PIX') ? [resumo.total] : valoresParcelas;

  for (let i = 0; i < parcelasQtd; i++) {
    const vencimento = (pagamento === 'Dinheiro' || pagamento === 'PIX')
      ? dataVenda
      : adicionarDias(dataVenda, 30 * (pagamento === 'Cartão' ? i : (i + 1)));

    const vencimentoBR = formatarDataBR(vencimento);

    const contaReceber = {
      id: uid(),
      vendaId: venda.id,
      clienteId: cli.id,
      cliente: cli.nome,
      cnpjCpf: cli.cpf || '',
      total: valores[i],
      parcela: i + 1,
      parcelas: parcelasQtd,
      data: dataVendaBR,
      vencimento: vencimentoBR,
      competencia: obterCompetenciaDeDataBR(vencimentoBR),
      produto: venda.itens.map(x => `${x.produto} (${x.qtd})`).join(', '),
      status: (pagamento === 'Dinheiro' || pagamento === 'PIX') ? 'Recebido' : 'Aberto',
      tipo: pagamento,
      contaLiquidacao: (pagamento === 'Dinheiro') ? 'Caixa' : banco
    };

    receber.push(contaReceber);

    criarFluxoVinculado({
      origemTipo: 'receber',
      origemId: contaReceber.id,
      desc: `Recebimento venda - ${cli.nome} - parcela ${i + 1}/${parcelasQtd}`,
      valor: contaReceber.total,
      tipo: 'Entrada',
      dataBR: vencimentoBR,
      conta: contaReceber.contaLiquidacao || banco || 'Caixa',
      statusFluxo: contaReceber.status === 'Recebido' ? 'Realizado' : 'Previsto'
    });
  }

  DB.set('vendas', vendas);
  DB.set('produtos', produtos);
  DB.set('receber', receber);

  carrinhoVenda = [];
  renderCarrinhoVenda();
  document.getElementById('v_qtd').value = 1;
  document.getElementById('v_desc_tipo').value = 'nenhum';
  document.getElementById('v_desc_valor').value = '';
  document.getElementById('v_busca_codigo').value = '';
  document.getElementById('v_parcelas').value = 1;
  document.getElementById('v_valorParcela').value = '';

  loadAll();

  if (pagamento === 'Fiado') {
    gerarNotasPromissoriasPorVenda(venda.id);
    alert('Venda fiado registrada com parcelas em contas a receber e fluxo previsto.');
  } else {
    alert('Venda registrada.');
  }
}

function loadVendas() {
  const vendas = DB.get('vendas');

  document.getElementById('t_vendas').innerHTML =
    `<tr>
      <th>Data</th>
      <th>Cliente</th>
      <th>Itens</th>
      <th>Total</th>
      <th>Parcelas</th>
      <th>Vendedor</th>
      <th>Pagamento</th>
      <th>Recibo</th>
      <th>Promissórias</th>
    </tr>` +
    vendas.map((x, i) => `
      <tr>
        <td>${x.data}</td>
        <td>${x.clienteNome}</td>
        <td><small>${(x.itens || []).map(item => `${item.produto} (${item.qtd})`).join(', ')}</small></td>
        <td>${moeda(x.total)}</td>
        <td>${x.parcelas || 1}x de ${moeda((x.valoresParcelas && x.valoresParcelas[0]) || x.total)}</td>
        <td>${x.vendedorNome || ''}</td>
        <td>${x.pagamento}</td>
        <td><button onclick="gerarRecibo(${i})">PDF</button></td>
        <td>${x.pagamento === 'Fiado' ? `<button onclick="gerarNotasPromissoriasPorVenda(${x.id})">PDF</button>` : '-'}</td>
      </tr>
    `).join('');
}

/* =========================
   FLUXO DE CAIXA
========================= */

function limparFormularioFluxo() {
  document.getElementById('f_edit_id').value = '';
  document.getElementById('f_desc').value = '';
  document.getElementById('f_valor').value = '';
  document.getElementById('f_data').value = hojeISO();
  document.getElementById('f_tipo').value = 'Entrada';
  document.getElementById('f_conta').selectedIndex = 0;
}

function cancelarEdicaoFluxo() {
  limparFormularioFluxo();
}

function limparFiltroFluxo() {
  document.getElementById('fluxo_data_inicial').value = '';
  document.getElementById('fluxo_data_final').value = '';
  loadFluxo();
}

function addFluxo() {
  const editId = document.getElementById('f_edit_id').value;
  const desc = document.getElementById('f_desc').value.trim();
  const valor = Number(document.getElementById('f_valor').value);
  const tipo = document.getElementById('f_tipo').value;
  const dataISO = document.getElementById('f_data').value;
  const conta = document.getElementById('f_conta').value;

  if (!desc || !valor || !dataISO || !conta) {
    return alert('Informe descrição, valor, data e conta.');
  }

  let fluxo = DB.get('fluxo');

  const dados = {
    id: editId ? Number(editId) : uid(),
    origemTipo: 'manual',
    origemId: editId ? Number(editId) : null,
    desc,
    valor,
    tipo,
    data: formatarDataISOparaBR(dataISO),
    conta,
    banco: conta,
    statusFluxo: 'Realizado'
  };

  if (editId) {
    fluxo = fluxo.map(item => item.id === Number(editId) ? { ...item, ...dados } : item);
  } else {
    fluxo.push(dados);
  }

  DB.set('fluxo', fluxo);
  limparFormularioFluxo();
  loadFluxo();
  loadDashboard();
}

function editarFluxo(id) {
  const fluxo = DB.get('fluxo');
  const item = fluxo.find(x => x.id === id);
  if (!item) return;

  document.getElementById('f_edit_id').value = item.id;
  document.getElementById('f_desc').value = item.desc || '';
  document.getElementById('f_valor').value = item.valor || '';
  document.getElementById('f_data').value = formatarDataBRparaISO(item.data);
  document.getElementById('f_tipo').value = item.tipo || 'Entrada';
  document.getElementById('f_conta').value = item.conta || item.banco || 'Caixa';
  show('fluxo');
}

function excluirFluxo(id) {
  if (!confirmar('Deseja excluir este lançamento do fluxo?')) return;
  let fluxo = DB.get('fluxo');
  fluxo = fluxo.filter(x => x.id !== id);
  DB.set('fluxo', fluxo);
  loadFluxo();
  loadDashboard();
}

function loadFluxo() {
  const fluxo = DB.get('fluxo');
  const saldos = calcularSaldosPorConta();
  const dataInicial = document.getElementById('fluxo_data_inicial')?.value || '';
  const dataFinal = document.getElementById('fluxo_data_final')?.value || '';

  const lista = fluxo.filter(item => {
    if (!dataInicial && !dataFinal) return true;
    return dataDentroDoPeriodo(item.data, dataInicial, dataFinal);
  });

  document.getElementById('t_fluxo').innerHTML =
    '<tr><th>Data</th><th>Descrição</th><th>Valor</th><th>Tipo</th><th>Conta</th><th>Status</th><th>Ações</th></tr>' +
    lista.map(x => `
      <tr>
        <td>${x.data || '-'}</td>
        <td>${x.desc}</td>
        <td>${moeda(x.valor)}</td>
        <td>${x.tipo}</td>
        <td>${x.conta || x.banco || '-'}</td>
        <td>${badgeStatus(x.statusFluxo || 'Realizado')}</td>
        <td>
          ${x.origemTipo === 'manual'
            ? `<button class="btn-warning" onclick="editarFluxo(${x.id})">Editar</button>
               <button class="btn-danger" onclick="excluirFluxo(${x.id})">Excluir</button>`
            : '-'
          }
        </td>
      </tr>
    `).join('');

  document.getElementById('saldoCaixaFluxo').innerText = moeda(saldos['Caixa'] || 0);
  document.getElementById('saldoContasFluxo').innerText = moeda(totalContasBancarias());

  document.getElementById('t_saldos_conta').innerHTML =
    '<tr><th>Conta</th><th>Saldo Atual</th></tr>' +
    Object.keys(saldos).map(conta => `
      <tr>
        <td>${conta}</td>
        <td>${moeda(saldos[conta])}</td>
      </tr>
    `).join('');

  document.getElementById('saldoInicialCaixa').value = saldoInicialConta('Caixa');
  if (!document.getElementById('f_data').value) document.getElementById('f_data').value = hojeISO();
}

/* =========================
   CONTAS A PAGAR
========================= */

function limparFormularioPagar() {
  document.getElementById('pg_edit_id').value = '';
  document.getElementById('pg_fornecedor').value = '';
  document.getElementById('pg_cnpj').value = '';
  document.getElementById('pg_desc').value = '';
  document.getElementById('pg_valor').value = '';
  document.getElementById('pg_competencia').value = competenciaAtual();
  document.getElementById('pg_vencimento').value = '';
  document.getElementById('pg_conta').selectedIndex = 0;
}

function cancelarEdicaoPagar() {
  limparFormularioPagar();
}

function addPagar() {
  const editId = document.getElementById('pg_edit_id').value;
  const fornecedor = document.getElementById('pg_fornecedor').value.trim();
  const cnpj = document.getElementById('pg_cnpj').value.trim();
  const desc = document.getElementById('pg_desc').value.trim();
  const valor = Number(document.getElementById('pg_valor').value);
  const competencia = document.getElementById('pg_competencia').value;
  const vencimentoISO = document.getElementById('pg_vencimento').value;
  const conta = document.getElementById('pg_conta').value;

  if (!fornecedor || !cnpj || !desc || !valor || !competencia || !vencimentoISO || !conta) {
    return alert('Preencha fornecedor, CNPJ, descrição, valor, competência, vencimento e conta.');
  }

  let pagar = DB.get('pagar');

  const dados = {
    id: editId ? Number(editId) : uid(),
    fornecedor,
    cnpj,
    desc,
    valor,
    competencia,
    vencimento: formatarDataISOparaBR(vencimentoISO),
    dataCadastro: formatarDataBR(new Date()),
    status: editId ? (pagar.find(x => x.id === Number(editId))?.status || 'Aberto') : 'Aberto',
    contaLiquidacao: conta
  };

  if (editId) {
    pagar = pagar.map(item => item.id === Number(editId) ? dados : item);
  } else {
    pagar.push(dados);
  }

  DB.set('pagar', pagar);

  if (editId) {
    atualizarFluxoVinculado('pagar', Number(editId), {
      desc: `Conta a pagar - ${fornecedor} - ${desc}`,
      valor,
      data: dados.vencimento,
      conta,
      banco: conta
    });
  } else {
    criarFluxoVinculado({
      origemTipo: 'pagar',
      origemId: dados.id,
      desc: `Conta a pagar - ${fornecedor} - ${desc}`,
      valor,
      tipo: 'Saída',
      dataBR: dados.vencimento,
      conta,
      statusFluxo: 'Previsto'
    });
  }

  limparFormularioPagar();
  loadPagar();
  loadFluxo();
  loadDashboard();
}

function editarPagar(id) {
  const pagar = DB.get('pagar');
  const item = pagar.find(x => x.id === id);
  if (!item) return;

  document.getElementById('pg_edit_id').value = item.id;
  document.getElementById('pg_fornecedor').value = item.fornecedor || '';
  document.getElementById('pg_cnpj').value = item.cnpj || '';
  document.getElementById('pg_desc').value = item.desc || '';
  document.getElementById('pg_valor').value = item.valor || '';
  document.getElementById('pg_competencia').value = item.competencia || '';
  document.getElementById('pg_vencimento').value = formatarDataBRparaISO(item.vencimento);
  document.getElementById('pg_conta').value = item.contaLiquidacao || 'Caixa';
  show('pagar');
}

function excluirPagar(id) {
  if (!confirmar('Deseja excluir esta conta a pagar?')) return;
  let pagar = DB.get('pagar');
  pagar = pagar.filter(x => x.id !== id);
  DB.set('pagar', pagar);
  excluirFluxoVinculado('pagar', id);
  loadPagar();
  loadFluxo();
  loadDashboard();
}

function baixarPagar(id) {
  let pagar = DB.get('pagar');
  pagar = pagar.map(item => item.id === id ? { ...item, status: 'Pago' } : item);
  DB.set('pagar', pagar);
  atualizarFluxoVinculado('pagar', id, { statusFluxo: 'Realizado' });
  loadPagar();
  loadFluxo();
  loadDashboard();
}

function reabrirPagar(id) {
  let pagar = DB.get('pagar');
  pagar = pagar.map(item => item.id === id ? { ...item, status: 'Aberto' } : item);
  DB.set('pagar', pagar);
  atualizarFluxoVinculado('pagar', id, { statusFluxo: 'Previsto' });
  loadPagar();
  loadFluxo();
  loadDashboard();
}

function loadPagar() {
  const pagar = DB.get('pagar');
  const filtro = document.getElementById('pg_filtro_competencia')?.value || '';
  const lista = filtro ? pagar.filter(x => x.competencia === filtro) : pagar;

  document.getElementById('t_pagar').innerHTML =
    '<tr><th>Fornecedor</th><th>CNPJ</th><th>Descrição</th><th>Competência</th><th>Vencimento</th><th>Valor</th><th>Status</th><th>Ações</th></tr>' +
    lista.map(x => `
      <tr>
        <td>${x.fornecedor}</td>
        <td>${x.cnpj}</td>
        <td>${x.desc}</td>
        <td>${x.competencia}</td>
        <td>${x.vencimento}</td>
        <td>${moeda(x.valor)}</td>
        <td>${badgeStatus(x.status || 'Aberto')}</td>
        <td>
          ${x.status !== 'Pago'
            ? `<button class="btn-success" onclick="baixarPagar(${x.id})">Baixar</button>`
            : `<button class="btn-secundario" onclick="reabrirPagar(${x.id})">Reabrir</button>`
          }
          <button class="btn-warning" onclick="editarPagar(${x.id})">Editar</button>
          <button class="btn-danger" onclick="excluirPagar(${x.id})">Excluir</button>
        </td>
      </tr>
    `).join('');
}

function gerarRelatorioPagarCompetencia() {
  const competencia = document.getElementById('pg_filtro_competencia').value || document.getElementById('pg_competencia').value;
  if (!competencia) return alert('Selecione a competência.');

  const pagar = DB.get('pagar').filter(x => x.competencia === competencia);
  const total = pagar.reduce((acc, item) => acc + Number(item.valor || 0), 0);
  const empresa = obterEmpresa();

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 20;

  doc.setFontSize(16);
  doc.text('RELATÓRIO DE CONTAS A PAGAR', 105, y, null, null, 'center');
  y += 8;
  doc.setFontSize(10);
  doc.text(`${empresa.razaoSocial} | CNPJ: ${empresa.cnpj}`, 105, y, null, null, 'center');
  y += 10;
  doc.text(`Competência: ${competencia}`, 20, y);
  y += 10;

  pagar.forEach(item => {
    doc.text(`${item.fornecedor} | ${item.desc} | Venc.: ${item.vencimento} | ${moeda(item.valor)} | ${item.status || 'Aberto'}`, 20, y, { maxWidth: 170 });
    y += 8;
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  });

  y += 6;
  doc.text(`Total da competência: ${moeda(total)}`, 20, y);
  doc.save(`contas_pagar_${competencia}.pdf`);
}

/* =========================
   CONTAS A RECEBER
========================= */

function editarReceber(id) {
  const receber = DB.get('receber');
  const item = receber.find(x => x.id === id);
  if (!item) return;

  const novoVencimento = prompt('Informe a nova data de vencimento (dd/mm/aaaa):', item.vencimento || '');
  if (!novoVencimento) return;

  const novaCompetencia = obterCompetenciaDeDataBR(novoVencimento);
  const novoValorStr = prompt('Informe o novo valor da parcela:', item.total);
  if (novoValorStr === null || novoValorStr === '') return;

  const novoValor = Number(String(novoValorStr).replace(',', '.'));
  if (isNaN(novoValor) || novoValor <= 0) return alert('Valor inválido.');

  const contaLiquidacao = prompt('Informe a conta de liquidação (Caixa ou banco):', item.contaLiquidacao || 'Caixa') || item.contaLiquidacao || 'Caixa';

  const atualizada = receber.map(x =>
    x.id === id
      ? { ...x, vencimento: novoVencimento, competencia: novaCompetencia, total: novoValor, contaLiquidacao }
      : x
  );

  DB.set('receber', atualizada);
  atualizarFluxoVinculado('receber', id, {
    data: novoVencimento,
    valor: novoValor,
    conta: contaLiquidacao,
    banco: contaLiquidacao
  });
  loadReceber();
  loadFluxo();
  loadDashboard();
}

function excluirReceber(id) {
  if (!confirmar('Deseja excluir esta conta a receber?')) return;
  let receber = DB.get('receber');
  receber = receber.filter(x => x.id !== id);
  DB.set('receber', receber);
  excluirFluxoVinculado('receber', id);
  loadReceber();
  loadFluxo();
  loadDashboard();
}

function baixarReceber(id) {
  let receber = DB.get('receber');
  receber = receber.map(item => item.id === id ? { ...item, status: 'Recebido' } : item);
  DB.set('receber', receber);
  atualizarFluxoVinculado('receber', id, { statusFluxo: 'Realizado' });
  loadReceber();
  loadFluxo();
  loadDashboard();
}

function reabrirReceber(id) {
  let receber = DB.get('receber');
  receber = receber.map(item => item.id === id ? { ...item, status: 'Aberto' } : item);
  DB.set('receber', receber);
  atualizarFluxoVinculado('receber', id, { statusFluxo: 'Previsto' });
  loadReceber();
  loadFluxo();
  loadDashboard();
}

function loadReceber() {
  const receber = DB.get('receber');
  const filtro = document.getElementById('r_filtro_competencia')?.value || '';
  const lista = filtro ? receber.filter(x => x.competencia === filtro) : receber;

  document.getElementById('t_receber').innerHTML =
    `<tr>
      <th>Cliente</th>
      <th>CPF/CNPJ</th>
      <th>Tipo</th>
      <th>Competência</th>
      <th>Vencimento</th>
      <th>Parcela</th>
      <th>Valor</th>
      <th>Status</th>
      <th>Ações</th>
    </tr>` +
    lista.map(x => `
      <tr>
        <td>${x.cliente || '-'}</td>
        <td>${x.cnpjCpf || '-'}</td>
        <td>${x.tipo || '-'}</td>
        <td>${x.competencia || '-'}</td>
        <td>${x.vencimento || '-'}</td>
        <td>${x.parcela ? `${x.parcela}/${x.parcelas}` : '-'}</td>
        <td>${moeda(x.total)}</td>
        <td>${badgeStatus(x.status || 'Aberto')}</td>
        <td>
          ${x.status !== 'Recebido'
            ? `<button class="btn-success" onclick="baixarReceber(${x.id})">Baixar</button>`
            : `<button class="btn-secundario" onclick="reabrirReceber(${x.id})">Reabrir</button>`
          }
          <button class="btn-warning" onclick="editarReceber(${x.id})">Editar</button>
          <button class="btn-danger" onclick="excluirReceber(${x.id})">Excluir</button>
        </td>
      </tr>
    `).join('');
}

function gerarRelatorioReceberCompetencia() {
  const competencia = document.getElementById('r_filtro_competencia').value;
  if (!competencia) return alert('Selecione a competência.');

  const receber = DB.get('receber').filter(x => x.competencia === competencia);
  const total = receber.reduce((acc, item) => acc + Number(item.total || 0), 0);
  const empresa = obterEmpresa();

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 20;

  doc.setFontSize(16);
  doc.text('RELATÓRIO DE CONTAS A RECEBER', 105, y, null, null, 'center');
  y += 8;
  doc.setFontSize(10);
  doc.text(`${empresa.razaoSocial} | CNPJ: ${empresa.cnpj}`, 105, y, null, null, 'center');
  y += 10;
  doc.text(`Competência: ${competencia}`, 20, y);
  y += 10;

  receber.forEach(item => {
    doc.text(`${item.cliente} | Parcela ${item.parcela}/${item.parcelas} | Venc.: ${item.vencimento} | ${moeda(item.total)} | ${item.status || 'Aberto'}`, 20, y, { maxWidth: 170 });
    y += 8;
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  });

  y += 6;
  doc.text(`Total real a receber na competência: ${moeda(total)}`, 20, y);
  doc.save(`contas_receber_${competencia}.pdf`);
}

/* =========================
   RELATÓRIOS
========================= */

function loadRelatorios() {
  const produtos = DB.get('produtos');
  const tabela = document.getElementById('t_relatorios_produtos');
  const filtroProduto = document.getElementById('lucro_produto_filtro');

  if (tabela) {
    tabela.innerHTML =
      `<tr>
        <th>Selecionar</th>
        <th>Produto</th>
        <th>Cód. Barras</th>
        <th>Preço</th>
        <th>Qtd. Etiquetas</th>
      </tr>` +
      produtos.map(p => `
        <tr>
          <td><input type="checkbox" class="rel-prod-check" data-id="${p.id}"></td>
          <td>${p.nome}</td>
          <td>${p.codigoBarras}</td>
          <td>${moeda(p.preco)}</td>
          <td><input type="number" min="1" value="1" id="etq_qtd_${p.id}" style="width:90px"></td>
        </tr>
      `).join('');
  }

  if (filtroProduto) {
    filtroProduto.innerHTML =
      `<option value="">Todos os produtos</option>` +
      produtos.map(p => `<option value="${p.id}">${p.nome}</option>`).join('');
  }

  if (!document.getElementById('lucro_data_inicial').value) document.getElementById('lucro_data_inicial').value = hojeISO();
  if (!document.getElementById('lucro_data_final').value) document.getElementById('lucro_data_final').value = hojeISO();
}

function gerarEtiquetasSelecionadas() {
  const produtos = DB.get('produtos');
  const checks = Array.from(document.querySelectorAll('.rel-prod-check:checked'));
  const empresa = obterEmpresa();

  if (checks.length === 0) return alert('Selecione pelo menos um produto.');
  if (!window.jspdf) return alert('Biblioteca de PDF não carregada.');

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'cm',
    format: [8, 5]
  });

  let primeiraPagina = true;

  checks.forEach(check => {
    const id = Number(check.dataset.id);
    const produto = produtos.find(p => p.id === id);
    const qtdEtiquetas = Math.max(1, Number(document.getElementById(`etq_qtd_${id}`).value || 1));
    if (!produto) return;

    for (let i = 0; i < qtdEtiquetas; i++) {
      if (!primeiraPagina) doc.addPage([8, 5], 'portrait');
      primeiraPagina = false;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(produto.nome, 2.5, 0.8, { align: 'center', maxWidth: 4.3 });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`CNPJ: ${empresa.cnpj}`, 2.5, 1.4, { align: 'center' });

      doc.setFontSize(11);
      doc.text(moeda(produto.preco), 2.5, 2.1, { align: 'center' });

      doc.setFillColor(0, 0, 0);
      desenharCodigoBarrasJsPDF(doc, produto.codigoBarras, 0.6, 2.6, 3.8, 1.8);

      doc.setFontSize(8);
      doc.text(String(produto.codigoBarras), 2.5, 4.8, { align: 'center' });
    }
  });

  doc.save(`etiquetas_produtos.pdf`);
}

function gerarRelatorioLucroPeriodo() {
  const dataInicialISO = document.getElementById('lucro_data_inicial').value;
  const dataFinalISO = document.getElementById('lucro_data_final').value;
  const produtoIdFiltro = document.getElementById('lucro_produto_filtro').value;
  const empresa = obterEmpresa();
  const vendas = DB.get('vendas');
  const produtos = DB.get('produtos');

  if (!dataInicialISO || !dataFinalISO) {
    return alert('Informe data inicial e data final.');
  }

  const produtoSelecionado = produtoIdFiltro
    ? produtos.find(p => p.id === Number(produtoIdFiltro))
    : null;

  let receita = 0;
  let custo = 0;
  let itens = [];

  vendas.forEach(venda => {
    if (!dataDentroDoPeriodo(venda.data, dataInicialISO, dataFinalISO)) return;

    (venda.itens || []).forEach(item => {
      if (produtoIdFiltro && Number(item.produtoId) !== Number(produtoIdFiltro)) return;

      const receitaItem = Number(item.total || 0);
      const custoItem = Number(item.custoUnit || 0) * Number(item.qtd || 0);
      const lucroItem = receitaItem - custoItem;

      receita += receitaItem;
      custo += custoItem;

      itens.push({
        data: venda.data,
        produto: item.produto,
        qtd: item.qtd,
        receita: receitaItem,
        custo: custoItem,
        lucro: lucroItem
      });
    });
  });

  const lucro = receita - custo;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  let y = 20;

  doc.setFontSize(16);
  doc.text('RELATÓRIO DE LUCRO POR PERÍODO', 105, y, null, null, 'center');
  y += 8;
  doc.setFontSize(10);
  doc.text(`${empresa.razaoSocial} | CNPJ: ${empresa.cnpj}`, 105, y, null, null, 'center');
  y += 10;
  doc.text(`Período: ${formatarDataISOparaBR(dataInicialISO)} a ${formatarDataISOparaBR(dataFinalISO)}`, 20, y);
  y += 8;
  doc.text(`Produto: ${produtoSelecionado ? produtoSelecionado.nome : 'Todos os produtos'}`, 20, y);
  y += 12;

  doc.setFontSize(11);
  itens.forEach(item => {
    doc.text(
      `${item.data} | ${item.produto} | Qtd: ${item.qtd} | Receita: ${moeda(item.receita)} | Custo: ${moeda(item.custo)} | Lucro: ${moeda(item.lucro)}`,
      20,
      y,
      { maxWidth: 170 }
    );
    y += 8;

    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  });

  y += 8;
  doc.setFontSize(12);
  doc.text(`Receita total: ${moeda(receita)}`, 20, y); y += 8;
  doc.text(`Custo total: ${moeda(custo)}`, 20, y); y += 8;
  doc.text(`Lucro total: ${moeda(lucro)}`, 20, y);

  doc.save(`lucro_periodo_${dataInicialISO}_a_${dataFinalISO}.pdf`);
}

/* =========================
   PDFs
========================= */

function gerarRecibo(i) {
  const vendas = DB.get('vendas');
  const venda = vendas[i];
  const empresa = obterEmpresa();
  if (!venda || !window.jspdf) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text(empresa.razaoSocial, 105, 15, null, null, 'center');
  doc.setFontSize(10);
  doc.text(`CNPJ: ${empresa.cnpj}`, 105, 22, null, null, 'center');
  doc.text(empresa.endereco, 105, 28, null, null, 'center');

  doc.setFontSize(18);
  doc.text('RECIBO DE VENDA', 105, 40, null, null, 'center');

  doc.setFontSize(12);
  doc.text(`Data: ${venda.data}`, 20, 55);
  doc.text(`Cliente: ${venda.clienteNome}`, 20, 65);
  doc.text(`Vendedor: ${venda.vendedorNome}`, 20, 75);
  doc.text(`Pagamento: ${venda.pagamento}`, 20, 85);

  let y = 100;
  doc.text('Itens da compra:', 20, y);
  y += 10;

  (venda.itens || []).forEach(item => {
    doc.text(
      `${item.produto} | Qtd: ${item.qtd} | Unit: ${moeda(item.precoUnit)} | Desc: ${moeda(item.desconto)} | Total: ${moeda(item.total)}`,
      20,
      y,
      { maxWidth: 170 }
    );
    y += 10;
  });

  y += 5;
  doc.text(`Subtotal: ${moeda(venda.subtotal || 0)}`, 20, y); y += 10;
  doc.text(`Desconto total: ${moeda(venda.descontoTotal || 0)}`, 20, y); y += 10;
  doc.text(`Valor total: ${moeda(venda.total || 0)}`, 20, y); y += 10;

  doc.line(20, 240, 90, 240);
  doc.text('Assinatura', 40, 248);

  doc.save(`recibo_${venda.clienteNome.replace(/\s+/g, '_')}.pdf`);
}

function gerarNotasPromissoriasPorVenda(vendaId) {
  if (!window.jspdf) return alert('Biblioteca de PDF não carregada.');

  const { jsPDF } = window.jspdf;
  const vendas = DB.get('vendas');
  const venda = vendas.find(v => v.id === vendaId);
  const empresa = obterEmpresa();

  if (!venda) return alert('Venda não encontrada.');
  if (venda.pagamento !== 'Fiado') return alert('Esta venda não é do tipo fiado.');

  const cliente = venda.clienteDados || {};
  const parcelas = venda.valoresParcelas || [venda.total];
  const dataBase = parseDataBR(venda.data);

  for (let i = 0; i < parcelas.length; i++) {
    const doc = new jsPDF();
    const vencimento = formatarDataBR(adicionarDias(dataBase, 30 * (i + 1)));
    const numeroNota = `${String(i + 1).padStart(2, '0')}/${String(parcelas.length).padStart(2, '0')}`;
    const valor = parcelas[i];

    doc.setFontSize(12);
    doc.text(empresa.razaoSocial, 105, 12, null, null, 'center');
    doc.text(`CNPJ: ${empresa.cnpj}`, 105, 18, null, null, 'center');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('NOTA PROMISSÓRIA', 105, 30, null, null, 'center');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Nº: ${numeroNota}`, 20, 42);
    doc.text(`Emissão: ${venda.data}`, 140, 42);

    doc.setFont('helvetica', 'bold');
    doc.text(`Vencimento: ${vencimento}`, 20, 54);
    doc.text(`Valor: ${moeda(valor)}`, 140, 54);

    doc.setFont('helvetica', 'normal');
    doc.text(
      `Ao(s) ${vencimento}, pagarei por esta única via de NOTA PROMISSÓRIA a ${empresa.razaoSocial}, inscrita no CNPJ sob nº ${empresa.cnpj}, ou à sua ordem, a quantia de ${moeda(valor)}.`,
      20,
      70,
      { maxWidth: 170 }
    );

    doc.text(`Emitente (devedor): ${venda.clienteNome}`, 20, 96);
    doc.text(`CPF: ${cliente.cpf || '-'}`, 20, 106);
    doc.text(`RG: ${cliente.rg || '-'}`, 110, 106);

    const endereco = `${cliente.rua || ''}, ${cliente.bairro || ''}, ${cliente.cidade || ''}/${cliente.estado || ''}, CEP ${cliente.cep || ''}`;
    doc.text(`Endereço: ${endereco}`, 20, 116, { maxWidth: 170 });

    doc.text(`Referente à compra de: ${(venda.itens || []).map(x => `${x.produto} (${x.qtd})`).join(', ')}`, 20, 132, { maxWidth: 170 });
    doc.text(`Parcela: ${i + 1}/${parcelas.length}`, 20, 148);

    doc.text(`Local de pagamento: ${empresa.cidade}/${empresa.estado}`, 20, 160);
    doc.text(`Praça de emissão: ${empresa.cidade}/${empresa.estado}`, 20, 170);

    doc.line(20, 205, 105, 205);
    doc.text('Assinatura do emitente', 40, 211);

    doc.save(`promissoria_${(venda.clienteNome || 'cliente').replace(/\s+/g, '_')}_${String(i + 1).padStart(2, '0')}.pdf`);
  }
}

function gerarDRE() {
  if (!window.jspdf) return alert('Biblioteca de PDF não carregada.');

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const empresa = obterEmpresa();

  const vendas = DB.get('vendas');
  const fluxo = DB.get('fluxo');

  let y = 20;
  const totalReceitas = vendas.reduce((a, b) => a + Number(b.total || 0), 0);
  const totalCustos = vendas.reduce((a, b) => a + Number(b.custoTotal || 0), 0);
  const lucroBruto = totalReceitas - totalCustos;

  const despesasOperacionais = fluxo
    .filter(x => x.tipo === 'Saída' && (x.statusFluxo === 'Realizado' || !x.statusFluxo))
    .reduce((a, b) => a + Number(b.valor || 0), 0);

  const entradasExtras = fluxo
    .filter(x => x.tipo === 'Entrada' && (x.statusFluxo === 'Realizado' || !x.statusFluxo))
    .reduce((a, b) => a + Number(b.valor || 0), 0) - totalReceitas;

  const lucroOperacional = lucroBruto - despesasOperacionais;
  const lucroLiquido = lucroOperacional + entradasExtras;

  doc.setFontSize(15);
  doc.text(empresa.razaoSocial, 105, y, null, null, 'center'); y += 7;
  doc.setFontSize(10);
  doc.text(`CNPJ: ${empresa.cnpj}`, 105, y, null, null, 'center'); y += 10;

  doc.setFontSize(16);
  doc.text('DRE - Demonstração de Resultado do Exercício', 105, y, null, null, 'center');
  y += 15;

  doc.setFontSize(12);
  doc.text(`Data de emissão: ${formatarDataBR(new Date())}`, 20, y);
  y += 15;

  doc.text('1. RECEITA BRUTA DE VENDAS', 20, y); doc.text(moeda(totalReceitas), 150, y); y += 10;
  doc.text('2. (-) CUSTO DAS MERCADORIAS VENDIDAS', 20, y); doc.text(moeda(totalCustos), 150, y); y += 10;
  doc.text('3. (=) LUCRO BRUTO', 20, y); doc.text(moeda(lucroBruto), 150, y); y += 10;
  doc.text('4. (-) DESPESAS OPERACIONAIS', 20, y); doc.text(moeda(despesasOperacionais), 150, y); y += 10;
  doc.text('5. (=) LUCRO OPERACIONAL', 20, y); doc.text(moeda(lucroOperacional), 150, y); y += 10;
  doc.text('6. (+) OUTRAS RECEITAS', 20, y); doc.text(moeda(entradasExtras), 150, y); y += 10;
  doc.text('7. (=) LUCRO LÍQUIDO', 20, y); doc.text(moeda(lucroLiquido), 150, y);

  doc.save(`DRE_${formatarDataBR(new Date()).replace(/\//g, '-')}.pdf`);
}

/* =========================
   DASHBOARD
========================= */

function gerarAlertasDashboard() {
  const hoje = new Date();
  const limite = new Date();
  limite.setDate(hoje.getDate() + 7);

  const pagar = DB.get('pagar');
  const receber = DB.get('receber');
  const alertas = [];

  pagar.forEach(item => {
    const dt = parseDataBR(item.vencimento);
    if (item.status !== 'Pago' && dt && dt >= hoje && dt <= limite) {
      alertas.push(`Pagar: ${item.fornecedor} - vencimento em ${item.vencimento} - ${moeda(item.valor)}`);
    }
  });

  receber.forEach(item => {
    const dt = parseDataBR(item.vencimento);
    if (item.status !== 'Recebido' && dt && dt >= hoje && dt <= limite) {
      alertas.push(`Receber: ${item.cliente} - vencimento em ${item.vencimento} - ${moeda(item.total)}`);
    }
  });

  const box = document.getElementById('alertasDashboard');
  if (!box) return;

  if (alertas.length === 0) {
    box.innerHTML = 'Sem alertas no momento.';
  } else {
    box.innerHTML = alertas.map(a => `<div class="alerta-item">${a}</div>`).join('');
  }
}

function loadDashboard() {
  const vendas = DB.get('vendas');
  const vendedoresCadastro = DB.get('vendedoresCadastro');
  const competencia = competenciaAtual();
  const saldos = calcularSaldosPorConta();

  const faturamento = vendas.reduce((a, b) => a + Number(b.total || 0), 0);
  const lucro = vendas.reduce((a, b) => a + Number(b.lucro || 0), 0);
  const ticket = vendas.length ? faturamento / vendas.length : 0;
  const metaVal = Number(localStorage.getItem('meta') || 0);
  const atingido = metaVal > 0 ? (faturamento / metaVal) * 100 : 0;

  const totalPagarMes = DB.get('pagar')
    .filter(x => x.competencia === competencia && x.status !== 'Pago')
    .reduce((acc, item) => acc + Number(item.valor || 0), 0);

  const totalReceberMes = DB.get('receber')
    .filter(x => x.competencia === competencia && x.status !== 'Recebido')
    .reduce((acc, item) => acc + Number(item.total || 0), 0);

  document.getElementById('fatBox').innerText = 'Faturamento: ' + moeda(faturamento);
  document.getElementById('lucBox').innerText = 'Lucro: ' + moeda(lucro);
  document.getElementById('ticketBox').innerText = 'Ticket Médio: ' + moeda(ticket);
  document.getElementById('metaProgBox').innerText = 'Meta: ' + moeda(metaVal) + ' | Atingido: ' + atingido.toFixed(1) + '%';

  document.getElementById('saldoCaixaFisico').innerText = moeda(saldos['Caixa'] || 0);
  document.getElementById('saldoTotalContas').innerText = moeda(totalContasBancarias());
  document.getElementById('dashPagarMes').innerText = moeda(totalPagarMes);
  document.getElementById('dashReceberMes').innerText = moeda(totalReceberMes);

  gerarAlertasDashboard();

  let vendasPorData = {};
  vendas.forEach(x => {
    vendasPorData[x.data] = (vendasPorData[x.data] || 0) + Number(x.total || 0);
  });

  const canvasVendas = document.getElementById('grafVendas');
  if (canvasVendas && typeof Chart !== 'undefined') {
    if (chartVendas) chartVendas.destroy();
    chartVendas = new Chart(canvasVendas, {
      type: 'line',
      data: {
        labels: Object.keys(vendasPorData),
        datasets: [{
          label: 'Vendas por Dia',
          data: Object.values(vendasPorData),
          tension: 0.3
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  let vendasPorVendedor = {};
  vendedoresCadastro.forEach(v => { vendasPorVendedor[v.nome] = 0; });

  vendas.forEach(v => {
    const nome = v.vendedorNome || 'Sem vendedor';
    vendasPorVendedor[nome] = (vendasPorVendedor[nome] || 0) + Number(v.total || 0);
  });

  const canvasVendedor = document.getElementById('grafVendedor');
  if (canvasVendedor && typeof Chart !== 'undefined') {
    if (chartVendedor) chartVendedor.destroy();
    chartVendedor = new Chart(canvasVendedor, {
      type: 'bar',
      data: {
        labels: Object.keys(vendasPorVendedor),
        datasets: [{
          label: 'Vendas por Vendedor',
          data: Object.values(vendasPorVendedor)
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
}

/* =========================
   LOAD GERAL
========================= */

function loadAll() {
  loadProdutos();
  loadClientes();
  loadVendedores();
  loadVendas();
  loadFluxo();
  loadReceber();
  loadPagar();
  loadConfig();
  loadDashboard();
  loadRelatorios();
  renderCarrinhoVenda();
  toggleParcelasVenda();

  if (document.getElementById('pg_competencia')) document.getElementById('pg_competencia').value = document.getElementById('pg_competencia').value || competenciaAtual();
  if (document.getElementById('pg_filtro_competencia')) document.getElementById('pg_filtro_competencia').value = document.getElementById('pg_filtro_competencia').value || competenciaAtual();
  if (document.getElementById('r_filtro_competencia')) document.getElementById('r_filtro_competencia').value = document.getElementById('r_filtro_competencia').value || competenciaAtual();
  if (document.getElementById('f_data')) document.getElementById('f_data').value = document.getElementById('f_data').value || hojeISO();
}

/* =========================
   EVENTOS
========================= */

window.addEventListener('load', () => {
  const parcelas = document.getElementById('v_parcelas');
  const produto = document.getElementById('v_produto');
  const pagamento = document.getElementById('v_pagamento');
  const filtroPagar = document.getElementById('pg_filtro_competencia');
  const filtroReceber = document.getElementById('r_filtro_competencia');

  if (parcelas) parcelas.addEventListener('input', atualizarPreviewParcelas);
  if (produto) produto.addEventListener('change', preencherDadosProdutoVenda);
  if (pagamento) pagamento.addEventListener('change', atualizarPreviewParcelas);
  if (filtroPagar) filtroPagar.addEventListener('change', loadPagar);
  if (filtroReceber) filtroReceber.addEventListener('change', loadReceber);

  iniciarPadroes();
  renderCarrinhoVenda();
  loadAll();
  limparFormularioFluxo();
  limparFormularioPagar();
});