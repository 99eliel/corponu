import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.mjs";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  runTransaction,
  writeBatch,
  getDocs,
  addDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBhIpXK6bPYiqdmjpuwEOcL5s87alz4HjE",
  authDomain: "corponu-b4942.firebaseapp.com",
  projectId: "corponu-b4942",
  storageBucket: "corponu-b4942.firebasestorage.app",
  messagingSenderId: "953146528035",
  appId: "1:953146528035:web:6265bde138aca7ef123c96",
  measurementId: "G-3FVRT3CD6W"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const secondaryApp = initializeApp(firebaseConfig, "SecondaryUserCreator");
const secondaryAuth = getAuth(secondaryApp);

pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.worker.mjs";

const state = {
  currentUser: null,
  perfil: null,
  produtos: [],
  ordens: [],
  usuarios: [],
  logs: [],
  pdfImportacaoPendente: [],
  relatorioAtual: "enfesto",
  unsubscribers: []
};

const pageInfo = {
  dashboard: {
    title: "Dashboard",
    subtitle: "Resumo geral das ordens e referências cadastradas."
  },
  produtos: {
    title: "Produtos / Referências",
    subtitle: "Cadastre as referências e marque se usam alça, bojo e renda."
  },
  ordens: {
    title: "Ordens de Produção",
    subtitle: "Crie OPs informando referência, cor, semana, mês e quantidade."
  },
  relatorios: {
    title: "Relatórios",
    subtitle: "Relatórios gerais, silk obrigatório e específicos por setor."
  },
  usuarios: {
    title: "Usuários",
    subtitle: "Gerencie logins comuns e admins."
  },
  logs: {
    title: "Logs / Auditoria",
    subtitle: "Acompanhe quem fez as ações importantes no sistema."
  },
  backup: {
    title: "Importar / Backup",
    subtitle: "Importe dados da planilha ou baixe backup atual."
  }
};

const reportInfo = {
  enfesto: {
    title: "Relatório de Enfesto",
    subtitle: "Processo geral: todas as ordens aparecem neste relatório.",
    tipo: "geral"
  },
  corte: {
    title: "Relatório de Corte",
    subtitle: "Processo geral: todas as ordens aparecem neste relatório.",
    tipo: "geral"
  },
  silk: {
    title: "Relatório de Silk",
    subtitle: "Processo obrigatório: todas as ordens aparecem neste relatório.",
    tipo: "geral"
  },
  separacao: {
    title: "Relatório de Separação",
    subtitle: "Processo geral: todas as ordens aparecem neste relatório.",
    tipo: "geral"
  },
  renda: {
    title: "Relatório de Renda",
    subtitle: "Relatório específico: mostra somente referências que possuem renda.",
    tipo: "especifico",
    campo: "possuiRenda",
    coluna: "Renda"
  },
  alca: {
    title: "Relatório de Alça",
    subtitle: "Relatório específico: mostra somente referências que possuem alça.",
    tipo: "especifico",
    campo: "possuiAlca",
    coluna: "Alça"
  },
  bojo: {
    title: "Relatório de Bojo",
    subtitle: "Relatório específico: mostra somente referências que possuem bojo.",
    tipo: "especifico",
    campo: "possuiBojo",
    coluna: "Bojo"
  }
};

document.addEventListener("DOMContentLoaded", () => {
  configurarVisibilidadeSenhas();
  configurarAuth();
  configurarNavegacao();
  configurarProduto();
  configurarOrdem();
  configurarRelatorios();
  configurarUsuarios();
  configurarLogs();
  configurarImportadorPDF();
  configurarBackup();
  preencherAnoAtual();
  preencherCamposPDFImportacao();
});


function configurarVisibilidadeSenhas() {
  document.querySelectorAll(".toggle-password").forEach(botao => {
    botao.addEventListener("click", () => {
      const targetId = botao.dataset.target;
      const input = document.getElementById(targetId);
      if (!input) return;

      const mostrando = input.type === "text";
      input.type = mostrando ? "password" : "text";
      botao.textContent = mostrando ? "Mostrar" : "Ocultar";
    });
  });
}

function configurarAuth() {
  document.getElementById("loginForm").addEventListener("submit", async event => {
    event.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const senha = document.getElementById("loginSenha").value;

    try {
      await signInWithEmailAndPassword(auth, email, senha);
    } catch (error) {
      console.error(error);
      toast("Erro ao entrar. Confira e-mail e senha.");
    }
  });

  document.getElementById("btnResetSenha").addEventListener("click", async () => {
    const email = document.getElementById("loginEmail").value.trim();

    if (!email) {
      toast("Digite seu e-mail primeiro.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      toast("E-mail de redefinição enviado.");
    } catch (error) {
      console.error(error);
      toast("Não foi possível enviar o e-mail de redefinição.");
    }
  });

  document.getElementById("btnLogout").addEventListener("click", async () => {
    await signOut(auth);
  });

  onAuthStateChanged(auth, async user => {
    limparListeners();

    if (!user) {
      state.currentUser = null;
      state.perfil = null;
      mostrarTelaLogin();
      return;
    }

    state.currentUser = user;

    try {
      const perfilSnap = await getDoc(doc(db, "usuarios", user.uid));

      if (!perfilSnap.exists()) {
        await signOut(auth);
        toast("Login sem perfil no Firestore. Crie o documento em usuarios usando o UID deste usuário.");
        return;
      }

      const perfil = {
        uid: user.uid,
        ...perfilSnap.data()
      };

      if (!perfil.ativo) {
        await signOut(auth);
        toast("Usuário inativo. Fale com o administrador.");
        return;
      }

      state.perfil = perfil;
      mostrarSistema();
      iniciarListenersFirestore();
      registrarLog("login", "sistema", "Sistema", "Usuário entrou no sistema.");
    } catch (error) {
      console.error(error);
      await signOut(auth);
      toast("Erro de permissão. Confira as regras do Firestore e o perfil do usuário.");
    }
  });
}

function mostrarTelaLogin() {
  document.getElementById("authScreen").classList.remove("hidden");
  document.getElementById("appShell").classList.add("hidden");
}

function mostrarSistema() {
  document.getElementById("authScreen").classList.add("hidden");
  document.getElementById("appShell").classList.remove("hidden");

  document.getElementById("userName").textContent = state.perfil.nome || state.currentUser.email;
  document.getElementById("userRole").textContent = ehAdmin() ? "Admin" : "Usuário comum";

  aplicarPermissoesTela();
  abrirPagina("dashboard");
}

function limparListeners() {
  state.unsubscribers.forEach(unsub => {
    try {
      unsub();
    } catch (error) {
      console.warn(error);
    }
  });

  state.unsubscribers = [];
}

function iniciarListenersFirestore() {
  const produtosQuery = query(collection(db, "produtos"), orderBy("referencia", "asc"));
  const ordensQuery = query(collection(db, "ordensProducao"), orderBy("criadoEm", "desc"));

  state.unsubscribers.push(onSnapshot(produtosQuery, snapshot => {
    state.produtos = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    renderTudo();
  }, error => {
    console.error(error);
    toast("Erro ao carregar produtos. Verifique as permissões.");
  }));

  state.unsubscribers.push(onSnapshot(ordensQuery, snapshot => {
    state.ordens = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    renderTudo();
  }, error => {
    console.error(error);
    toast("Erro ao carregar ordens. Verifique as permissões.");
  }));

  if (ehAdmin()) {
    const usuariosQuery = query(collection(db, "usuarios"), orderBy("nome", "asc"));
    const logsQuery = query(collection(db, "logsAlteracoes"), orderBy("criadoEm", "desc"));

    state.unsubscribers.push(onSnapshot(usuariosQuery, snapshot => {
      state.usuarios = snapshot.docs.map(item => ({ uid: item.id, ...item.data() }));
      renderUsuarios();
    }, error => {
      console.error(error);
      toast("Erro ao carregar usuários.");
    }));

    state.unsubscribers.push(onSnapshot(logsQuery, snapshot => {
      state.logs = snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
      renderLogs();
    }, error => {
      console.error(error);
      toast("Erro ao carregar logs.");
    }));
  }
}

function aplicarPermissoesTela() {
  const admin = ehAdmin();

  document.querySelectorAll(".admin-only, .admin-only-block, .admin-only-cell").forEach(el => {
    el.classList.toggle("hidden", !admin);
  });

  if (!admin) {
    const paginaAtiva = document.querySelector(".page.active")?.id;
    if (paginaAtiva === "usuarios" || paginaAtiva === "backup" || paginaAtiva === "logs") {
      abrirPagina("dashboard");
    }
  }
}

function ehAdmin() {
  return state.perfil?.tipo === "admin";
}

function configurarNavegacao() {
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if ((btn.dataset.page === "usuarios" || btn.dataset.page === "backup" || btn.dataset.page === "logs") && !ehAdmin()) {
        toast("Apenas admin acessa esta área.");
        return;
      }

      abrirPagina(btn.dataset.page);
    });
  });
}

function abrirPagina(page) {
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));

  document.querySelector(`.nav-btn[data-page="${page}"]`)?.classList.add("active");
  document.getElementById(page)?.classList.add("active");

  if (pageInfo[page]) {
    document.getElementById("pageTitle").textContent = pageInfo[page].title;
    document.getElementById("pageSubtitle").textContent = pageInfo[page].subtitle;
  }
}

function configurarProduto() {
  const form = document.getElementById("formProduto");

  form.addEventListener("submit", async event => {
    event.preventDefault();

    if (!ehAdmin()) {
      toast("Apenas admin pode salvar produtos.");
      return;
    }

    const produtoIdAtual = document.getElementById("produtoId").value;
    const referencia = normalizarReferencia(document.getElementById("produtoReferencia").value);
    const nome = document.getElementById("produtoNome").value.trim();

    if (!referencia || !nome) {
      toast("Preencha referência e nome do produto.");
      return;
    }

    const produto = {
      referencia,
      nome,
      possuiAlca: document.getElementById("produtoAlca").checked,
      possuiBojo: document.getElementById("produtoBojo").checked,
      possuiRenda: document.getElementById("produtoRenda").checked,
      observacoes: document.getElementById("produtoObs").value.trim(),
      cadastroPendente: false,
      statusCadastro: "conferido",
      atualizadoPor: state.currentUser.uid,
      atualizadoEm: serverTimestamp()
    };

    if (!produtoIdAtual) {
      produto.criadoPor = state.currentUser.uid;
      produto.criadoEm = serverTimestamp();
    }

    try {
      const docId = produtoIdAtual || docIdSeguro(referencia);
      await setDoc(doc(db, "produtos", docId), produto, { merge: true });
      const ordensAtualizadas = await atualizarOrdensDaReferencia(produto);
      await registrarLog(
        produtoIdAtual ? "produto_atualizado" : "produto_criado",
        "produto",
        docId,
        `Referência ${referencia} - ${nome}. Ordens atualizadas: ${ordensAtualizadas}`
      );

      limparFormProduto();
      toast("Produto salvo no Firebase.");
      restaurarOrdemPendenteSePossivel({ id: docId, ...produto });
    } catch (error) {
      console.error(error);
      toast("Erro ao salvar produto.");
    }
  });

  document.getElementById("buscaProduto").addEventListener("input", renderProdutos);
  document.getElementById("btnCancelarProduto").addEventListener("click", limparFormProduto);
}

function limparFormProduto() {
  document.getElementById("produtoId").value = "";
  document.getElementById("produtoReferencia").value = "";
  document.getElementById("produtoNome").value = "";
  document.getElementById("produtoAlca").checked = false;
  document.getElementById("produtoBojo").checked = false;
  document.getElementById("produtoRenda").checked = false;
  document.getElementById("produtoObs").value = "";
}

function editarProduto(id) {
  if (!ehAdmin()) {
    toast("Apenas admin pode editar produtos.");
    return;
  }

  const produto = state.produtos.find(p => p.id === id);
  if (!produto) return;

  document.getElementById("produtoId").value = produto.id;
  document.getElementById("produtoReferencia").value = produto.referencia;
  document.getElementById("produtoNome").value = produto.nome;
  document.getElementById("produtoAlca").checked = Boolean(produto.possuiAlca);
  document.getElementById("produtoBojo").checked = Boolean(produto.possuiBojo);
  document.getElementById("produtoRenda").checked = Boolean(produto.possuiRenda);
  document.getElementById("produtoObs").value = produto.observacoes || "";

  abrirPagina("produtos");
}

async function excluirProduto(id) {
  if (!ehAdmin()) {
    toast("Apenas admin pode excluir produtos.");
    return;
  }

  const produto = state.produtos.find(p => p.id === id);
  if (!produto) return;

  const possuiOP = state.ordens.some(op => op.referencia === produto.referencia);
  const mensagem = possuiOP
    ? "Essa referência já possui ordens cadastradas. Excluir mesmo assim?"
    : "Deseja excluir este produto?";

  if (!confirm(mensagem)) return;

  try {
    await deleteDoc(doc(db, "produtos", id));
    await registrarLog("produto_excluido", "produto", id, `Referência ${produto.referencia} - ${produto.nome}`);
    toast("Produto excluído.");
  } catch (error) {
    console.error(error);
    toast("Erro ao excluir produto.");
  }
}

function configurarOrdem() {
  const form = document.getElementById("formOrdem");

  document.getElementById("ordemReferencia").addEventListener("input", mostrarPreviewProduto);

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const id = document.getElementById("ordemId").value;
    const referencia = normalizarReferencia(document.getElementById("ordemReferencia").value);
    const produto = state.produtos.find(p => p.referencia === referencia);

    if (!produto) {
      const cadastrarAgora = confirm(`A referência ${referencia || "(vazia)"} ainda não está cadastrada. Deseja cadastrar esse produto agora?`);

      if (cadastrarAgora) {
        if (!ehAdmin()) {
          toast("Apenas admin pode cadastrar nova referência.");
          return;
        }

        iniciarCadastroProdutoPelaOrdem(referencia);
      } else {
        toast("Cadastre a referência antes de salvar a OP.");
      }

      return;
    }

    const cor = normalizarCor(document.getElementById("ordemCor").value);
    const quantidade = Number(document.getElementById("ordemQuantidade").value);
    const semana = Number(document.getElementById("ordemSemana").value);
    const mes = document.getElementById("ordemMes").value;
    const ano = Number(document.getElementById("ordemAno").value);

    if (!cor) {
      toast("Informe a cor da OP.");
      return;
    }

    if (!quantidade || quantidade <= 0) {
      toast("Informe uma quantidade válida.");
      return;
    }

    if (!semana || semana < 1 || semana > 5) {
      toast("A semana deve ser de 1 a 5.");
      return;
    }

    if (!mes || !ano) {
      toast("Informe mês e ano.");
      return;
    }

    try {
      if (id) {
        const opAntiga = state.ordens.find(op => op.id === id);
        const ordemAtualizada = montarDadosOrdem({
          numeroOP: opAntiga?.numeroOP || id,
          produto,
          referencia,
          cor,
          quantidade,
          semana,
          mes,
          ano,
          observacoes: document.getElementById("ordemObs").value.trim(),
          criada: false
        });

        await setDoc(doc(db, "ordensProducao", id), ordemAtualizada, { merge: true });
        await registrarLog("ordem_atualizada", "ordemProducao", id, `${ordemAtualizada.numeroOP} | Ref. ${referencia} | Cor ${cor} | Qtd. ${quantidade}`);
        toast("OP atualizada.");
      } else {
        const numeroOP = await gerarNumeroOPFirebase(ano);
        const ordemNova = montarDadosOrdem({
          numeroOP,
          produto,
          referencia,
          cor,
          quantidade,
          semana,
          mes,
          ano,
          observacoes: document.getElementById("ordemObs").value.trim(),
          criada: true
        });

        const ordemDocId = docIdSeguro(numeroOP);
        await setDoc(doc(db, "ordensProducao", ordemDocId), ordemNova);
        await registrarLog("ordem_criada", "ordemProducao", ordemDocId, `${numeroOP} | Ref. ${referencia} | Cor ${cor} | Qtd. ${quantidade}`);
        toast("OP cadastrada.");
      }

      limparFormOrdem();
    } catch (error) {
      console.error(error);
      toast("Erro ao salvar OP.");
    }
  });

  document.getElementById("buscaOrdem").addEventListener("input", renderOrdens);
  document.getElementById("btnCancelarOrdem").addEventListener("click", limparFormOrdem);
}

function montarDadosOrdem({ numeroOP, produto, referencia, cor, quantidade, semana, mes, ano, observacoes, criada }) {
  const dados = {
    numeroOP,
    referencia,
    cor,
    produtoNome: produto.nome,
    semana,
    mes,
    ano,
    quantidade,
    possuiAlca: Boolean(produto.possuiAlca),
    possuiBojo: Boolean(produto.possuiBojo),
    possuiRenda: Boolean(produto.possuiRenda),
    observacoes,
    atualizadoPor: state.currentUser.uid,
    atualizadoEm: serverTimestamp()
  };

  if (criada) {
    dados.status = "aberta";
    dados.criadoPor = state.currentUser.uid;
    dados.criadoEm = serverTimestamp();
  }

  return dados;
}

async function gerarNumeroOPFirebase(ano) {
  const configRef = doc(db, "configuracoes", "sistema");

  return await runTransaction(db, async transaction => {
    const snap = await transaction.get(configRef);
    const atual = snap.exists() ? Number(snap.data().ultimoNumeroOP || 0) : 0;
    const proximo = atual + 1;

    transaction.set(configRef, {
      ultimoNumeroOP: proximo,
      anoAtual: ano,
      nomeSistema: "Sistema OP Confecção",
      atualizadoEm: serverTimestamp()
    }, { merge: true });

    return `OP-${ano}-${String(proximo).padStart(4, "0")}`;
  });
}

function mostrarPreviewProduto() {
  const referencia = normalizarReferencia(document.getElementById("ordemReferencia").value);
  const produto = state.produtos.find(p => p.referencia === referencia);
  const preview = document.getElementById("produtoPreview");

  if (!referencia) {
    preview.classList.add("hidden");
    preview.classList.remove("warning");
    preview.innerHTML = "";
    return;
  }

  if (!produto) {
    preview.classList.remove("hidden");
    preview.classList.add("warning");

    const botaoCadastro = ehAdmin()
      ? `<div class="preview-actions">
          <button type="button" class="btn btn-sm btn-primary" onclick="iniciarCadastroProdutoPelaOrdem('${encodeURIComponent(referencia)}')">
            Cadastrar essa referência
          </button>
        </div>`
      : `<br><strong>Peça para um admin cadastrar essa referência.</strong>`;

    preview.innerHTML = `
      <strong>Referência não cadastrada:</strong> ${escapeHtml(referencia)}<br>
      Para salvar essa OP, o produto precisa estar cadastrado.
      ${botaoCadastro}
    `;
    return;
  }

  preview.classList.remove("hidden");
  preview.classList.remove("warning");
  preview.innerHTML = `
    <strong>Produto encontrado:</strong><br>
    Referência: ${escapeHtml(produto.referencia)}<br>
    Produto: ${escapeHtml(produto.nome)}<br>
    Alça: ${produto.possuiAlca ? "Sim" : "Não"} |
    Bojo: ${produto.possuiBojo ? "Sim" : "Não"} |
    Renda: ${produto.possuiRenda ? "Sim" : "Não"}
  `;
}

function capturarOrdemPendente(referencia) {
  return {
    referencia: normalizarReferencia(referencia),
    cor: normalizarCor(document.getElementById("ordemCor").value),
    quantidade: document.getElementById("ordemQuantidade").value,
    semana: document.getElementById("ordemSemana").value,
    mes: document.getElementById("ordemMes").value,
    ano: document.getElementById("ordemAno").value,
    observacoes: document.getElementById("ordemObs").value
  };
}

function iniciarCadastroProdutoPelaOrdem(referenciaEncoded) {
  if (!ehAdmin()) {
    toast("Apenas admin pode cadastrar referência.");
    return;
  }

  const referencia = normalizarReferencia(decodeURIComponent(referenciaEncoded));
  if (!referencia) {
    toast("Digite a referência primeiro.");
    return;
  }

  sessionStorage.setItem("op_confeccao_ordem_pendente", JSON.stringify(capturarOrdemPendente(referencia)));

  limparFormProduto();
  abrirPagina("produtos");

  document.getElementById("produtoReferencia").value = referencia;
  document.getElementById("produtoNome").focus();

  toast("Cadastre essa referência. Depois o sistema volta para a OP.");
}

function restaurarOrdemPendenteSePossivel(produtoCadastrado) {
  const raw = sessionStorage.getItem("op_confeccao_ordem_pendente");
  if (!raw) return false;

  try {
    const pendente = JSON.parse(raw);

    if (normalizarReferencia(pendente.referencia) !== produtoCadastrado.referencia) {
      return false;
    }

    sessionStorage.removeItem("op_confeccao_ordem_pendente");
    abrirPagina("ordens");

    document.getElementById("ordemReferencia").value = produtoCadastrado.referencia;
    document.getElementById("ordemCor").value = pendente.cor || "";
    document.getElementById("ordemQuantidade").value = pendente.quantidade || "";
    document.getElementById("ordemSemana").value = pendente.semana || "";
    document.getElementById("ordemMes").value = pendente.mes || "";
    document.getElementById("ordemAno").value = pendente.ano || new Date().getFullYear();
    document.getElementById("ordemObs").value = pendente.observacoes || "";

    mostrarPreviewProduto();

    toast("Produto cadastrado. Confira os dados e salve a OP.");
    return true;
  } catch (error) {
    sessionStorage.removeItem("op_confeccao_ordem_pendente");
    return false;
  }
}

function limparFormOrdem() {
  document.getElementById("ordemId").value = "";
  document.getElementById("ordemReferencia").value = "";
  document.getElementById("ordemCor").value = "";
  document.getElementById("ordemQuantidade").value = "";
  document.getElementById("ordemSemana").value = "";
  document.getElementById("ordemMes").value = "";
  document.getElementById("ordemObs").value = "";
  document.getElementById("produtoPreview").classList.add("hidden");
  preencherAnoAtual();
}

function editarOrdem(id) {
  const ordem = state.ordens.find(op => op.id === id);
  if (!ordem) return;

  document.getElementById("ordemId").value = ordem.id;
  document.getElementById("ordemReferencia").value = ordem.referencia;
  document.getElementById("ordemCor").value = ordem.cor || "";
  document.getElementById("ordemQuantidade").value = ordem.quantidade;
  document.getElementById("ordemSemana").value = ordem.semana;
  document.getElementById("ordemMes").value = ordem.mes;
  document.getElementById("ordemAno").value = ordem.ano;
  document.getElementById("ordemObs").value = ordem.observacoes || "";

  mostrarPreviewProduto();
  abrirPagina("ordens");
}

async function excluirOrdem(id) {
  if (!ehAdmin()) {
    toast("Apenas admin pode excluir OP.");
    return;
  }

  if (!confirm("Deseja excluir esta ordem de produção?")) return;

  try {
    const ordem = state.ordens.find(op => op.id === id);
    await deleteDoc(doc(db, "ordensProducao", id));
    await registrarLog("ordem_excluida", "ordemProducao", id, `${ordem?.numeroOP || id} | Ref. ${ordem?.referencia || "-"} | Cor ${ordem?.cor || "-"}`);
    toast("OP excluída.");
  } catch (error) {
    console.error(error);
    toast("Erro ao excluir OP.");
  }
}

function configurarRelatorios() {
  document.querySelectorAll(".report-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".report-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.relatorioAtual = btn.dataset.relatorio;
      renderRelatorio();
    });
  });

  document.getElementById("btnAplicarFiltros").addEventListener("click", renderRelatorio);

  document.getElementById("btnLimparFiltros").addEventListener("click", () => {
    document.getElementById("filtroSemana").value = "";
    document.getElementById("filtroMes").value = "";
    document.getElementById("filtroAno").value = "";
    document.getElementById("filtroReferencia").value = "";
    document.getElementById("filtroCor").value = "";
    renderRelatorio();
  });

  document.getElementById("btnExportarCSV").addEventListener("click", exportarCSV);
  document.getElementById("btnImprimir").addEventListener("click", () => window.print());
}

function getOrdensRelatorio() {
  const info = reportInfo[state.relatorioAtual];
  let ordens = [...state.ordens];

  if (info.tipo === "especifico") {
    ordens = ordens.filter(op => Boolean(op[info.campo]));
  }

  const semana = document.getElementById("filtroSemana").value;
  const mes = document.getElementById("filtroMes").value;
  const ano = document.getElementById("filtroAno").value;
  const referencia = normalizarReferencia(document.getElementById("filtroReferencia").value);
  const cor = normalizarCor(document.getElementById("filtroCor").value);

  if (semana) ordens = ordens.filter(op => String(op.semana) === String(semana));
  if (mes) ordens = ordens.filter(op => op.mes === mes);
  if (ano) ordens = ordens.filter(op => String(op.ano) === String(ano));
  if (referencia) ordens = ordens.filter(op => String(op.referencia).includes(referencia));
  if (cor) ordens = ordens.filter(op => normalizarCor(op.cor).includes(cor));

  return ordens.sort((a, b) => {
    if (Number(a.ano) !== Number(b.ano)) return Number(a.ano) - Number(b.ano);
    if (a.mes !== b.mes) return ordemMes(a.mes) - ordemMes(b.mes);
    if (Number(a.semana) !== Number(b.semana)) return Number(a.semana) - Number(b.semana);
    return String(a.referencia).localeCompare(String(b.referencia));
  });
}

function ordemMes(mes) {
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  return meses.indexOf(mes) + 1;
}

function renderRelatorio() {
  const info = reportInfo[state.relatorioAtual];
  document.getElementById("tituloRelatorio").textContent = info.title;
  document.getElementById("subtituloRelatorio").textContent = info.subtitle;

  const thead = document.getElementById("cabecalhoRelatorio");
  const tbody = document.getElementById("corpoRelatorio");
  const ordens = getOrdensRelatorio();

  if (info.tipo === "geral") {
    thead.innerHTML = `
      <tr>
        <th>OP</th>
        <th>Semana</th>
        <th>Mês/Ano</th>
        <th>Referência</th>
        <th>Cor</th>
        <th>Produto</th>
        <th>Qtd.</th>
        <th>Alça</th>
        <th>Bojo</th>
        <th>Renda</th>
        <th>Obs.</th>
      </tr>
    `;

    if (!ordens.length) {
      tbody.innerHTML = `<tr><td colspan="11" class="empty">Nenhuma ordem encontrada para este relatório.</td></tr>`;
      return;
    }

    tbody.innerHTML = ordens.map(op => `
      <tr>
        <td><strong>${escapeHtml(op.numeroOP)}</strong></td>
        <td>Semana ${op.semana}</td>
        <td>${escapeHtml(op.mes)}/${op.ano}</td>
        <td>${escapeHtml(op.referencia)}</td>
        <td><strong>${escapeHtml(op.cor || "-")}</strong></td>
        <td>${escapeHtml(op.produtoNome)}</td>
        <td>${op.quantidade}</td>
        <td>${simNaoBadge(op.possuiAlca)}</td>
        <td>${simNaoBadge(op.possuiBojo)}</td>
        <td>${simNaoBadge(op.possuiRenda)}</td>
        <td>${escapeHtml(op.observacoes || "-")}</td>
      </tr>
    `).join("");

    return;
  }

  thead.innerHTML = `
    <tr>
      <th>OP</th>
      <th>Semana</th>
      <th>Mês/Ano</th>
      <th>Referência</th>
      <th>Cor</th>
      <th>Quantidade</th>
      <th>${escapeHtml(info.coluna)}</th>
    </tr>
  `;

  if (!ordens.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty">Nenhuma ordem encontrada para este relatório.</td></tr>`;
    return;
  }

  tbody.innerHTML = ordens.map(op => `
    <tr>
      <td><strong>${escapeHtml(op.numeroOP)}</strong></td>
      <td>Semana ${op.semana}</td>
      <td>${escapeHtml(op.mes)}/${op.ano}</td>
      <td>${escapeHtml(op.referencia)}</td>
      <td><strong>${escapeHtml(op.cor || "-")}</strong></td>
      <td>${op.quantidade}</td>
      <td>${simNaoBadge(true)}</td>
    </tr>
  `).join("");
}

function configurarUsuarios() {
  document.getElementById("formUsuario").addEventListener("submit", async event => {
    event.preventDefault();

    if (!ehAdmin()) {
      toast("Apenas admin pode criar usuários.");
      return;
    }

    const nome = document.getElementById("usuarioNome").value.trim();
    const email = document.getElementById("usuarioEmail").value.trim();
    const senha = document.getElementById("usuarioSenha").value;
    const tipo = document.getElementById("usuarioTipo").value;

    if (!nome || !email || !senha || senha.length < 6) {
      toast("Preencha nome, e-mail e senha com pelo menos 6 caracteres.");
      return;
    }

    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, senha);

      await setDoc(doc(db, "usuarios", cred.user.uid), {
        nome,
        email,
        tipo,
        ativo: true,
        criadoPor: state.currentUser.uid,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp()
      });

      await registrarLog("usuario_criado", "usuario", cred.user.uid, `${nome} | ${email} | ${tipo}`);
      await signOut(secondaryAuth);

      document.getElementById("formUsuario").reset();
      document.getElementById("usuarioTipo").value = "usuario";

      toast("Usuário criado com sucesso.");
    } catch (error) {
      console.error(error);
      toast("Erro ao criar usuário. Confira se o e-mail já existe.");
    }
  });
}

function renderUsuarios() {
  const tbody = document.getElementById("listaUsuarios");

  if (!state.usuarios.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">Nenhum usuário encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.usuarios.map(usuario => `
    <tr>
      <td><strong>${escapeHtml(usuario.nome || "-")}</strong></td>
      <td>${escapeHtml(usuario.email || "-")}</td>
      <td>${usuario.tipo === "admin" ? "Admin" : "Usuário comum"}</td>
      <td>
        <span class="status-dot ${usuario.ativo ? "active" : "inactive"}">
          ${usuario.ativo ? "Ativo" : "Inativo"}
        </span>
      </td>
      <td>
        <button class="btn btn-sm ${usuario.ativo ? "btn-warning" : "btn-success"}" onclick="alternarUsuario('${usuario.uid}', ${usuario.ativo ? "false" : "true"})">
          ${usuario.ativo ? "Desativar" : "Ativar"}
        </button>
      </td>
    </tr>
  `).join("");
}

async function alternarUsuario(uid, novoStatus) {
  if (!ehAdmin()) {
    toast("Apenas admin pode alterar usuários.");
    return;
  }

  if (uid === state.currentUser.uid && novoStatus === false) {
    toast("Você não pode desativar seu próprio usuário.");
    return;
  }

  try {
    await updateDoc(doc(db, "usuarios", uid), {
      ativo: novoStatus,
      atualizadoEm: serverTimestamp()
    });

    const usuario = state.usuarios.find(item => item.uid === uid);
    await registrarLog("usuario_status_alterado", "usuario", uid, `${usuario?.nome || uid} | status: ${novoStatus ? "ativo" : "inativo"}`);

    toast("Usuário atualizado.");
  } catch (error) {
    console.error(error);
    toast("Erro ao atualizar usuário.");
  }
}


function configurarLogs() {
  const busca = document.getElementById("buscaLog");
  if (busca) {
    busca.addEventListener("input", renderLogs);
  }

  const btn = document.getElementById("btnExportarLogs");
  if (btn) {
    btn.addEventListener("click", exportarLogsCSV);
  }
}

function renderLogs() {
  const tbody = document.getElementById("listaLogs");
  if (!tbody) return;

  if (!ehAdmin()) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">Apenas admin pode visualizar logs.</td></tr>`;
    return;
  }

  const busca = normalizarTexto(document.getElementById("buscaLog")?.value || "");
  let logs = [...state.logs];

  if (busca) {
    logs = logs.filter(log => {
      const texto = normalizarTexto([
        log.usuarioNome,
        log.usuarioEmail,
        log.usuarioTipo,
        log.acao,
        log.tipoAlvo,
        log.alvoId,
        log.detalhes
      ].join(" "));
      return texto.includes(busca);
    });
  }

  if (!logs.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty">Nenhum log encontrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = logs.slice(0, 300).map(log => `
    <tr>
      <td>${escapeHtml(formatarDataHora(log.criadoEm))}</td>
      <td>
        <strong>${escapeHtml(log.usuarioNome || "-")}</strong><br>
        <small>${escapeHtml(log.usuarioEmail || "-")}</small>
      </td>
      <td><span class="log-action">${escapeHtml(labelAcaoLog(log.acao))}</span></td>
      <td>${escapeHtml(log.tipoAlvo || "-")}</td>
      <td>${escapeHtml(log.alvoId || "-")}</td>
      <td class="log-detail">${escapeHtml(log.detalhes || "-")}</td>
    </tr>
  `).join("");
}

function exportarLogsCSV() {
  if (!ehAdmin()) {
    toast("Apenas admin pode exportar logs.");
    return;
  }

  const logs = [...state.logs];

  if (!logs.length) {
    toast("Não há logs para exportar.");
    return;
  }

  const linhas = [
    ["Data/Hora", "Usuário", "E-mail", "Tipo usuário", "Ação", "Tipo alvo", "Item", "Detalhes"]
  ];

  logs.forEach(log => {
    linhas.push([
      formatarDataHora(log.criadoEm),
      log.usuarioNome || "",
      log.usuarioEmail || "",
      log.usuarioTipo || "",
      labelAcaoLog(log.acao),
      log.tipoAlvo || "",
      log.alvoId || "",
      log.detalhes || ""
    ]);
  });

  const csv = linhas
    .map(linha => linha.map(campo => `"${String(campo).replaceAll('"', '""')}"`).join(";"))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "logs-auditoria-op-confeccao.csv";
  link.click();

  URL.revokeObjectURL(url);
  registrarLog("logs_exportados", "auditoria", "logsAlteracoes", `${logs.length} logs exportados em CSV`);
}

async function registrarLog(acao, tipoAlvo, alvoId, detalhes = "") {
  if (!state.currentUser || !state.perfil) return;

  try {
    await addDoc(collection(db, "logsAlteracoes"), {
      acao,
      tipoAlvo,
      alvoId: String(alvoId || ""),
      detalhes: String(detalhes || ""),
      usuarioUid: state.currentUser.uid,
      usuarioNome: state.perfil.nome || "",
      usuarioEmail: state.perfil.email || state.currentUser.email || "",
      usuarioTipo: state.perfil.tipo || "",
      criadoEm: serverTimestamp()
    });
  } catch (error) {
    console.warn("Não foi possível registrar log:", error);
  }
}

function labelAcaoLog(acao) {
  const labels = {
    login: "Login",
    produto_criado: "Produto criado",
    produto_atualizado: "Produto atualizado",
    produto_excluido: "Produto excluído",
    ordem_criada: "OP criada",
    ordem_atualizada: "OP atualizada",
    ordem_excluida: "OP excluída",
    usuario_criado: "Usuário criado",
    usuario_status_alterado: "Status de usuário",
    backup_importado: "Backup importado",
    backup_exportado: "Backup exportado",
    relatorio_exportado: "Relatório exportado",
    logs_exportados: "Logs exportados",
    pdf_importado: "PDF importado",
    ordens_zeradas: "Ordens zeradas"
  };

  return labels[acao] || acao || "-";
}

function formatarDataHora(valor) {
  if (!valor) return "-";
  const data = typeof valor.toDate === "function" ? valor.toDate() : new Date(valor);
  if (Number.isNaN(data.getTime())) return "-";

  return data.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function normalizarTexto(valor) {
  return String(valor || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}


function configurarImportadorPDF() {
  const input = document.getElementById("inputImportarPDF");
  const confirmar = document.getElementById("btnConfirmarImportacaoPDF");
  const zerar = document.getElementById("btnZerarOrdens");

  if (input) {
    input.addEventListener("change", async event => {
      const file = event.target.files[0];
      if (!file) return;

      if (!ehAdmin()) {
        toast("Apenas admin pode importar relatório PDF.");
        event.target.value = "";
        return;
      }

      try {
        toast("Lendo PDF, aguarde...");
        const texto = await extrairTextoPDF(file);
        const registros = extrairOrdensDoRelatorioPDF(texto);

        state.pdfImportacaoPendente = registros;
        renderPreviewPDF(registros);

        if (registros.length) {
          toast(`${registros.length} ordens encontradas no PDF.`);
        } else {
          toast("Nenhuma ordem foi encontrada no PDF.");
        }
      } catch (error) {
        console.error(error);
        toast("Erro ao ler PDF. Verifique se o arquivo é um relatório válido.");
      }

      event.target.value = "";
    });
  }

  if (confirmar) {
    confirmar.addEventListener("click", importarPDFConfirmado);
  }

  if (zerar) {
    zerar.addEventListener("click", zerarOrdensProducao);
  }
}

function preencherCamposPDFImportacao() {
  const ano = new Date().getFullYear();
  const mes = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ][new Date().getMonth()];

  const pdfAno = document.getElementById("pdfAno");
  const pdfMes = document.getElementById("pdfMes");

  if (pdfAno) pdfAno.value = ano;
  if (pdfMes) pdfMes.value = mes;
}

async function extrairTextoPDF(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let textoFinal = "";

  for (let pagina = 1; pagina <= pdf.numPages; pagina++) {
    const page = await pdf.getPage(pagina);
    const content = await page.getTextContent();

    const itens = content.items
      .map(item => ({
        str: item.str,
        x: item.transform[4],
        y: Math.round(item.transform[5])
      }))
      .filter(item => String(item.str || "").trim());

    itens.sort((a, b) => {
      if (Math.abs(b.y - a.y) > 2) return b.y - a.y;
      return a.x - b.x;
    });

    const linhas = [];
    let linhaAtual = [];
    let yAtual = null;

    for (const item of itens) {
      if (yAtual === null || Math.abs(item.y - yAtual) <= 2) {
        linhaAtual.push(item);
        yAtual = yAtual === null ? item.y : yAtual;
      } else {
        linhas.push(linhaAtual.sort((a, b) => a.x - b.x).map(i => i.str).join(" ").replace(/\s+/g, " ").trim());
        linhaAtual = [item];
        yAtual = item.y;
      }
    }

    if (linhaAtual.length) {
      linhas.push(linhaAtual.sort((a, b) => a.x - b.x).map(i => i.str).join(" ").replace(/\s+/g, " ").trim());
    }

    textoFinal += "\n" + linhas.join("\n") + "\n";
  }

  return textoFinal;
}

function extrairOrdensDoRelatorioPDF(texto) {
  const registros = [];
  const regex = /OP-Lote:\s*([^\n]+?)\s+Situação:[\s\S]*?Referência:\s*([^\n]+)\n[\s\S]*?COR\s*\/\s*TAMANHO[^\n]*\n([\s\S]*?)Planejado:\s*([\d.,]+)/g;
  let match;

  while ((match = regex.exec(texto)) !== null) {
    const opLote = limparTexto(match[1]);
    const referenciaLinha = limparTexto(match[2]);
    const blocoCor = match[3] || "";
    const planejadoTexto = limparTexto(match[4]);

    const refMatch = referenciaLinha.match(/^([^\s-]+)\s*-\s*(.+)$/);
    const referencia = normalizarReferencia(refMatch ? refMatch[1] : referenciaLinha);
    const produto = limparTexto(refMatch ? refMatch[2] : "");

    const corLinha = encontrarLinhaCor(blocoCor);
    const corMatch = corLinha.match(/^(\d{3,4})\s*-\s*(.+?)(?:\s+\d{1,4},\d{2}|\s+Planejado:|$)/);

    const corCodigo = corMatch ? limparTexto(corMatch[1]) : "";
    const cor = normalizarCor(corMatch ? corMatch[2] : corLinha);

    const partesOp = opLote.split("-").map(parte => parte.trim());
    const numeroOrdem = partesOp[0] || opLote;
    const lote = partesOp[1] || "";

    if (!numeroOrdem || !referencia || !cor || !planejadoTexto) continue;

    registros.push({
      numeroOP: numeroOrdem,
      opLote,
      lote,
      referencia,
      produto,
      corCodigo,
      cor,
      planejadoTexto,
      quantidade: numeroBrasileiroParaFloat(planejadoTexto)
    });
  }

  const unicos = new Map();

  for (const item of registros) {
    const chave = `${item.numeroOP}-${item.lote}-${item.referencia}-${item.cor}`;
    if (!unicos.has(chave)) {
      unicos.set(chave, item);
    }
  }

  return [...unicos.values()];
}

function encontrarLinhaCor(bloco) {
  const linhas = String(bloco || "").split(/\n/).map(limparTexto).filter(Boolean);
  return linhas.find(linha => /^\d{3,4}\s*-\s*/.test(linha)) || "";
}

function limparTexto(valor) {
  return String(valor || "").replace(/\s+/g, " ").trim();
}

function numeroBrasileiroParaFloat(valor) {
  const normalizado = String(valor || "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  return Number(normalizado || 0);
}

function renderPreviewPDF(registros) {
  const resumo = document.getElementById("pdfImportResumo");
  const wrap = document.getElementById("pdfPreviewWrap");
  const tbody = document.getElementById("pdfPreviewBody");
  const btnConfirmar = document.getElementById("btnConfirmarImportacaoPDF");

  if (!resumo || !wrap || !tbody || !btnConfirmar) return;

  if (!registros.length) {
    resumo.classList.remove("hidden");
    wrap.classList.add("hidden");
    btnConfirmar.disabled = true;
    resumo.innerHTML = "<strong>Nenhuma OP encontrada.</strong><br>Confira se o PDF está no formato correto.";
    tbody.innerHTML = "";
    return;
  }

  const referenciasExistentes = new Set(state.produtos.map(produto => normalizarReferencia(produto.referencia)));
  const refsNovas = [...new Set(registros.map(item => item.referencia).filter(ref => !referenciasExistentes.has(ref)))];

  resumo.classList.remove("hidden");
  wrap.classList.remove("hidden");
  btnConfirmar.disabled = false;

  resumo.innerHTML = `
    <strong>Prévia do PDF:</strong><br>
    Ordens encontradas: ${registros.length}<br>
    Referências novas: ${refsNovas.length}${refsNovas.length ? ` (${refsNovas.slice(0, 12).join(", ")}${refsNovas.length > 12 ? "..." : ""})` : ""}
  `;

  tbody.innerHTML = registros.slice(0, 300).map(item => {
    const existe = referenciasExistentes.has(item.referencia);
    return `
      <tr>
        <td><strong>${escapeHtml(item.numeroOP)}</strong></td>
        <td>${escapeHtml(item.lote || "-")}</td>
        <td>${escapeHtml(item.referencia)}</td>
        <td>${escapeHtml(item.produto || "-")}</td>
        <td>${escapeHtml(item.cor)}</td>
        <td>${escapeHtml(item.planejadoTexto)}</td>
        <td class="${existe ? "pdf-ok" : "pdf-missing"}">${existe ? "Cadastrada" : "Nova"}</td>
      </tr>
    `;
  }).join("");
}

async function importarPDFConfirmado() {
  if (!ehAdmin()) {
    toast("Apenas admin pode importar PDF.");
    return;
  }

  const registros = state.pdfImportacaoPendente || [];

  if (!registros.length) {
    toast("Nenhum PDF lido para importar.");
    return;
  }

  const semana = Number(document.getElementById("pdfSemana").value);
  const mes = document.getElementById("pdfMes").value;
  const ano = Number(document.getElementById("pdfAno").value);
  const criarProdutos = document.getElementById("pdfCriarProdutos").checked;

  if (!semana || !mes || !ano) {
    toast("Informe semana, mês e ano para importar.");
    return;
  }

  const referenciasExistentes = new Set(state.produtos.map(produto => normalizarReferencia(produto.referencia)));
  const refsNovas = [...new Set(registros.map(item => item.referencia).filter(ref => !referenciasExistentes.has(ref)))];

  if (refsNovas.length && !criarProdutos) {
    toast("Existem referências novas. Marque a opção para cadastrar automaticamente ou cadastre antes.");
    return;
  }

  const confirmar = confirm(`Importar ${registros.length} ordens do PDF para o Firestore?`);
  if (!confirmar) return;

  try {
    let batch = writeBatch(db);
    let contador = 0;

    if (criarProdutos) {
      const mapaProdutosNovos = new Map();

      for (const item of registros) {
        if (!referenciasExistentes.has(item.referencia) && !mapaProdutosNovos.has(item.referencia)) {
          mapaProdutosNovos.set(item.referencia, item.produto || `Referência ${item.referencia}`);
        }
      }

      for (const [referencia, nome] of mapaProdutosNovos.entries()) {
        batch.set(doc(db, "produtos", docIdSeguro(referencia)), {
          referencia,
          nome,
          possuiAlca: false,
          possuiBojo: false,
          possuiRenda: false,
          cadastroPendente: true,
          statusCadastro: "pendente",
          pendencia: "Conferir se esta referência possui alça, bojo e renda/sutiã.",
          observacoes: "Cadastrado automaticamente pela importação de relatório externo PDF. Conferir alça, bojo e renda/sutiã.",
          criadoPor: state.currentUser.uid,
          criadoEm: serverTimestamp(),
          atualizadoPor: state.currentUser.uid,
          atualizadoEm: serverTimestamp()
        }, { merge: true });

        contador++;
      }
    }

    for (const item of registros) {
      const produtoExistente = state.produtos.find(prod => normalizarReferencia(prod.referencia) === item.referencia);
      const referenciaPendente = !produtoExistente || Boolean(produtoExistente?.cadastroPendente) || produtoExistente?.statusCadastro === "pendente";

      const docId = docIdSeguro(`PDF-${item.numeroOP}-${item.lote || "SEMLOTE"}`);

      batch.set(doc(db, "ordensProducao", docId), {
        numeroOP: String(item.numeroOP),
        numeroOPExterno: String(item.numeroOP),
        loteExterno: String(item.lote || ""),
        opLoteExterno: item.opLote,
        referencia: item.referencia,
        cor: item.cor,
        corCodigo: item.corCodigo,
        produtoNome: produtoExistente?.nome || item.produto || `Referência ${item.referencia}`,
        semana,
        mes,
        ano,
        quantidade: item.quantidade,
        quantidadePlanejadaTexto: item.planejadoTexto,
        possuiAlca: Boolean(produtoExistente?.possuiAlca),
        possuiBojo: Boolean(produtoExistente?.possuiBojo),
        possuiRenda: Boolean(produtoExistente?.possuiRenda),
        referenciaPendente,
        statusReferencia: referenciaPendente ? "pendente" : "conferida",
        pendencia: referenciaPendente ? "Referência nova cadastrada automaticamente. Conferir alça, bojo e renda/sutiã no cadastro do produto." : "",
        observacoes: `Importado do relatório externo PDF. OP-Lote: ${item.opLote}.${referenciaPendente ? " Referência pendente de conferência." : ""}`,
        status: "aberta",
        origem: "pdf_externo",
        criadoPor: state.currentUser.uid,
        criadoEm: serverTimestamp(),
        atualizadoPor: state.currentUser.uid,
        atualizadoEm: serverTimestamp()
      }, { merge: true });

      contador++;

      if (contador >= 430) {
        await batch.commit();
        batch = writeBatch(db);
        contador = 0;
      }
    }

    if (contador > 0) {
      await batch.commit();
    }

    await registrarLog("pdf_importado", "importacao", "relatorio-pdf", `${registros.length} ordens importadas do PDF. Referências novas: ${refsNovas.length}.`);

    state.pdfImportacaoPendente = [];
    renderPreviewPDF([]);

    toast("PDF importado com sucesso.");
  } catch (error) {
    console.error(error);
    toast("Erro ao importar PDF para o Firestore.");
  }
}

async function zerarOrdensProducao() {
  if (!ehAdmin()) {
    toast("Apenas admin pode zerar ordens.");
    return;
  }

  if (!confirm("Tem certeza que deseja apagar TODAS as ordens de produção do Firestore?")) return;
  if (!confirm("Confirma novamente? Essa ação não apaga produtos, usuários nem logs, apenas ordens de produção.")) return;

  try {
    const snap = await getDocs(collection(db, "ordensProducao"));
    let batch = writeBatch(db);
    let contador = 0;
    let total = 0;

    for (const documento of snap.docs) {
      batch.delete(doc(db, "ordensProducao", documento.id));
      contador++;
      total++;

      if (contador >= 430) {
        await batch.commit();
        batch = writeBatch(db);
        contador = 0;
      }
    }

    if (contador > 0) {
      await batch.commit();
    }

    await setDoc(doc(db, "configuracoes", "sistema"), {
      ultimoNumeroOP: 0,
      atualizadoEm: serverTimestamp()
    }, { merge: true });

    await registrarLog("ordens_zeradas", "ordensProducao", "todas", `${total} ordens de produção foram removidas.`);

    toast(`${total} ordens de produção foram apagadas.`);
  } catch (error) {
    console.error(error);
    toast("Erro ao zerar ordens de produção.");
  }
}

function configurarBackup() {
  document.getElementById("inputImportarFirestore").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;

    if (!ehAdmin()) {
      toast("Apenas admin pode importar dados.");
      return;
    }

    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const backup = JSON.parse(reader.result);

        if (!Array.isArray(backup.produtos) || !Array.isArray(backup.ordens)) {
          throw new Error("Formato inválido.");
        }

        if (!confirm("Importar estes dados para o Firestore? Documentos com mesmo ID serão atualizados.")) return;

        await importarBackupFirestore(backup);
        await registrarLog("backup_importado", "importacao", "backup-json", `${backup.produtos.length} produtos e ${backup.ordens.length} ordens importados`);
        toast("Dados importados para o Firebase.");
      } catch (error) {
        console.error(error);
        toast("Erro ao importar backup.");
      }
    };

    reader.readAsText(file);
    event.target.value = "";
  });

  document.getElementById("btnBaixarBackupAtual").addEventListener("click", baixarBackupAtual);
}

async function importarBackupFirestore(backup) {
  let batch = writeBatch(db);
  let contador = 0;

  for (const produto of backup.produtos) {
    const referencia = normalizarReferencia(produto.referencia);
    if (!referencia) continue;

    const produtoRef = doc(db, "produtos", docIdSeguro(referencia));

    batch.set(produtoRef, {
      referencia,
      nome: produto.nome || `Referência ${referencia}`,
      possuiAlca: Boolean(produto.possuiAlca),
      possuiBojo: Boolean(produto.possuiBojo),
      possuiRenda: Boolean(produto.possuiRenda),
      observacoes: produto.observacoes || "",
      importadoPor: state.currentUser.uid,
      importadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    }, { merge: true });

    contador++;
  }

  let maiorOP = 0;

  for (const op of backup.ordens) {
    const numeroOP = op.numeroOP || op.id || `OP-IMPORTADA-${Date.now()}-${contador}`;
    const match = String(numeroOP).match(/(\d+)$/);

    if (match) {
      maiorOP = Math.max(maiorOP, Number(match[1]));
    }

    const ordemRef = doc(db, "ordensProducao", docIdSeguro(numeroOP));

    batch.set(ordemRef, {
      numeroOP,
      referencia: normalizarReferencia(op.referencia),
      cor: normalizarCor(op.cor || extrairCorDeObservacao(op.observacoes)),
      produtoNome: op.produtoNome || `Referência ${op.referencia}`,
      semana: Number(op.semana || 1),
      mes: op.mes || "",
      ano: Number(op.ano || new Date().getFullYear()),
      quantidade: Number(op.quantidade || 0),
      possuiAlca: Boolean(op.possuiAlca),
      possuiBojo: Boolean(op.possuiBojo),
      possuiRenda: Boolean(op.possuiRenda),
      observacoes: op.observacoes || "",
      status: op.status || "aberta",
      importadoPor: state.currentUser.uid,
      importadoEm: serverTimestamp(),
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    }, { merge: true });

    contador++;

    if (contador >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      contador = 0;
    }
  }

  if (contador > 0) {
    await batch.commit();
  }

  await setDoc(doc(db, "configuracoes", "sistema"), {
    ultimoNumeroOP: maiorOP,
    nomeSistema: "Sistema OP Confecção",
    atualizadoEm: serverTimestamp()
  }, { merge: true });
}

function baixarBackupAtual() {
  const backup = {
    produtos: state.produtos,
    ordens: state.ordens,
    usuarios: ehAdmin() ? state.usuarios.map(u => ({
      uid: u.uid,
      nome: u.nome,
      email: u.email,
      tipo: u.tipo,
      ativo: u.ativo
    })) : [],
    exportadoEm: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "backup-op-confeccao-firebase.json";
  link.click();

  URL.revokeObjectURL(url);
  registrarLog("backup_exportado", "exportacao", "backup-atual", `${state.produtos.length} produtos e ${state.ordens.length} ordens exportados`);
}

function renderTudo() {
  renderDashboard();
  renderProdutos();
  renderProdutosPendentes();
  renderOrdens();
  renderDatalistReferencias();
  renderDatalistCores();
  renderRelatorio();
  renderLogs();
  aplicarPermissoesTela();
}

function renderDashboard() {
  document.getElementById("totalProdutos").textContent = state.produtos.length;
  document.getElementById("totalOrdens").textContent = state.ordens.length;
  document.getElementById("totalRenda").textContent = state.ordens.filter(op => op.possuiRenda).length;
  document.getElementById("totalAlca").textContent = state.ordens.filter(op => op.possuiAlca).length;
  document.getElementById("totalBojo").textContent = state.ordens.filter(op => op.possuiBojo).length;
  const totalPendentesEl = document.getElementById("totalPendentes");
  if (totalPendentesEl) {
    totalPendentesEl.textContent = state.ordens.filter(op => op.referenciaPendente || op.statusReferencia === "pendente").length;
  }

  const ultimas = [...state.ordens].slice(0, 8);
  const tbody = document.getElementById("ultimasOrdens");

  if (!ultimas.length) {
    tbody.innerHTML = `<tr><td colspan="11" class="empty">Nenhuma ordem cadastrada ainda.</td></tr>`;
    return;
  }

  tbody.innerHTML = ultimas.map(op => `
    <tr>
      <td><strong>${escapeHtml(op.numeroOP)}</strong></td>
      <td>Semana ${op.semana}</td>
      <td>${escapeHtml(op.mes)}/${op.ano}</td>
      <td>${escapeHtml(op.referencia)}</td>
      <td><strong>${escapeHtml(op.cor || "-")}</strong></td>
      <td>${escapeHtml(op.produtoNome)}</td>
      <td>${op.quantidade}</td>
      <td>${simNaoBadge(op.possuiAlca)}</td>
      <td>${simNaoBadge(op.possuiBojo)}</td>
      <td>${simNaoBadge(op.possuiRenda)}</td>
      <td>${statusReferenciaBadge(op)}</td>
    </tr>
  `).join("");
}

function renderProdutos() {
  const busca = normalizarReferencia(document.getElementById("buscaProduto")?.value || "");
  let produtos = [...state.produtos];

  if (busca) {
    produtos = produtos.filter(p => String(p.referencia).includes(busca) || String(p.nome).toUpperCase().includes(busca));
  }

  produtos.sort((a, b) => String(a.referencia).localeCompare(String(b.referencia)));

  const tbody = document.getElementById("listaProdutos");

  if (!produtos.length) {
    tbody.innerHTML = `<tr><td colspan="${ehAdmin() ? 7 : 6}" class="empty">Nenhum produto cadastrado.</td></tr>`;
    return;
  }

  tbody.innerHTML = produtos.map(produto => `
    <tr>
      <td><strong>${escapeHtml(produto.referencia)}</strong></td>
      <td>${escapeHtml(produto.nome)}</td>
      <td>${simNaoBadge(produto.possuiAlca)}</td>
      <td>${simNaoBadge(produto.possuiBojo)}</td>
      <td>${simNaoBadge(produto.possuiRenda)}</td>
      <td>${statusProdutoBadge(produto)}</td>
      ${ehAdmin() ? `<td>
        <button class="btn btn-sm" onclick="editarProduto('${produto.id}')">Editar</button>
        <button class="btn btn-sm btn-danger" onclick="excluirProduto('${produto.id}')">Excluir</button>
      </td>` : ""}
    </tr>
  `).join("");
}


function renderProdutosPendentes() {
  const tbody = document.getElementById("listaProdutosPendentes");
  const totalEl = document.getElementById("totalProdutosPendentes");

  if (!tbody || !totalEl) return;

  const pendentes = state.produtos
    .filter(produto => Boolean(produto.cadastroPendente) || produto.statusCadastro === "pendente")
    .sort((a, b) => String(a.referencia).localeCompare(String(b.referencia)));

  totalEl.textContent = `${pendentes.length} pendente${pendentes.length === 1 ? "" : "s"}`;

  if (!pendentes.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">Nenhuma referência pendente no momento.</td></tr>`;
    return;
  }

  tbody.innerHTML = pendentes.map(produto => {
    const totalOps = state.ordens.filter(op => {
      return normalizarReferencia(op.referencia) === normalizarReferencia(produto.referencia)
        && (op.referenciaPendente || op.statusReferencia === "pendente");
    }).length;

    return `
      <tr>
        <td><strong>${escapeHtml(produto.referencia)}</strong></td>
        <td>${escapeHtml(produto.nome || "-")}</td>
        <td>${totalOps}</td>
        <td>${escapeHtml(produto.pendencia || "Conferir alça, bojo e renda/sutiã.")}</td>
        <td>
          ${ehAdmin() ? `<button class="btn btn-sm btn-primary" onclick="conferirReferenciaPendente('${produto.id}')">Conferir</button>` : ""}
          <button class="btn btn-sm" onclick="verOrdensDaReferencia('${escapeHtml(produto.referencia)}')">Ver OPs</button>
        </td>
      </tr>
    `;
  }).join("");
}

function conferirReferenciaPendente(id) {
  if (!ehAdmin()) {
    toast("Apenas admin pode conferir referências pendentes.");
    return;
  }

  editarProduto(id);
  toast("Marque alça, bojo e renda/sutiã. Ao salvar, as OPs dessa referência serão atualizadas.");
}

function verOrdensDaReferencia(referencia) {
  abrirPagina("ordens");
  const busca = document.getElementById("buscaOrdem");

  if (busca) {
    busca.value = normalizarReferencia(referencia);
    renderOrdens();
  }
}

function renderOrdens() {
  const busca = normalizarReferencia(document.getElementById("buscaOrdem")?.value || "");
  let ordens = [...state.ordens];

  if (busca) {
    ordens = ordens.filter(op => {
      return String(op.numeroOP).toUpperCase().includes(busca) ||
        String(op.referencia).includes(busca) ||
        String(op.cor || "").toUpperCase().includes(busca) ||
        String(op.produtoNome).toUpperCase().includes(busca);
    });
  }

  const tbody = document.getElementById("listaOrdens");

  if (!ordens.length) {
    tbody.innerHTML = `<tr><td colspan="12" class="empty">Nenhuma ordem cadastrada.</td></tr>`;
    return;
  }

  tbody.innerHTML = ordens.map(op => `
    <tr>
      <td><strong>${escapeHtml(op.numeroOP)}</strong></td>
      <td>Semana ${op.semana}</td>
      <td>${escapeHtml(op.mes)}/${op.ano}</td>
      <td>${escapeHtml(op.referencia)}</td>
      <td><strong>${escapeHtml(op.cor || "-")}</strong></td>
      <td>${escapeHtml(op.produtoNome)}</td>
      <td>${op.quantidade}</td>
      <td>${simNaoBadge(op.possuiAlca)}</td>
      <td>${simNaoBadge(op.possuiBojo)}</td>
      <td>${simNaoBadge(op.possuiRenda)}</td>
      <td>${statusReferenciaBadge(op)}</td>
      <td>
        <button class="btn btn-sm" onclick="editarOrdem('${op.id}')">Editar</button>
        ${ehAdmin() ? `<button class="btn btn-sm btn-danger" onclick="excluirOrdem('${op.id}')">Excluir</button>` : ""}
      </td>
    </tr>
  `).join("");
}

function renderDatalistReferencias() {
  const datalist = document.getElementById("referenciasList");

  datalist.innerHTML = state.produtos.map(produto => {
    return `<option value="${escapeHtml(produto.referencia)}">${escapeHtml(produto.nome)}</option>`;
  }).join("");
}

function renderDatalistCores() {
  const datalist = document.getElementById("coresList");
  const cores = [...new Set(state.ordens.map(op => normalizarCor(op.cor)).filter(Boolean))].sort();

  datalist.innerHTML = cores.map(cor => `<option value="${escapeHtml(cor)}"></option>`).join("");
}

function getLinhasCSVRelatorio(ordens) {
  const info = reportInfo[state.relatorioAtual];

  if (info.tipo === "geral") {
    const linhas = [
      ["OP", "Semana", "Mês", "Ano", "Referência", "Cor", "Produto", "Quantidade", "Alça", "Bojo", "Renda", "Observações"]
    ];

    ordens.forEach(op => {
      linhas.push([
        op.numeroOP,
        `Semana ${op.semana}`,
        op.mes,
        op.ano,
        op.referencia,
        op.cor || "",
        op.produtoNome,
        op.quantidade,
        op.possuiAlca ? "Sim" : "Não",
        op.possuiBojo ? "Sim" : "Não",
        op.possuiRenda ? "Sim" : "Não",
        op.observacoes || ""
      ]);
    });

    return linhas;
  }

  const linhas = [
    ["OP", "Semana", "Mês", "Ano", "Referência", "Cor", "Quantidade", info.coluna]
  ];

  ordens.forEach(op => {
    linhas.push([
      op.numeroOP,
      `Semana ${op.semana}`,
      op.mes,
      op.ano,
      op.referencia,
      op.cor || "",
      op.quantidade,
      "Sim"
    ]);
  });

  return linhas;
}

function exportarCSV() {
  const ordens = getOrdensRelatorio();

  if (!ordens.length) {
    toast("Não há dados para exportar.");
    return;
  }

  const linhas = getLinhasCSVRelatorio(ordens);

  const csv = linhas
    .map(linha => linha.map(campo => `"${String(campo).replaceAll('"', '""')}"`).join(";"))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${reportInfo[state.relatorioAtual].title.replaceAll(" ", "_")}.csv`;
  link.click();

  URL.revokeObjectURL(url);
  registrarLog("relatorio_exportado", "relatorio", state.relatorioAtual, `${reportInfo[state.relatorioAtual].title} exportado em CSV`);
}

function preencherAnoAtual() {
  document.getElementById("ordemAno").value = new Date().getFullYear();
}

function normalizarReferencia(valor) {
  return String(valor || "").trim().toUpperCase();
}

function normalizarCor(valor) {
  return String(valor || "").trim().toUpperCase();
}

function docIdSeguro(valor) {
  return String(valor || "")
    .trim()
    .replaceAll("/", "-")
    .replaceAll("\\", "-")
    .replaceAll("#", "-")
    .replaceAll("?", "-");
}

function extrairCorDeObservacao(texto) {
  const match = String(texto || "").match(/cor\s*:\s*([^|,\n\r;]+)/i);
  return match ? match[1].trim() : "";
}


function statusReferenciaBadge(op) {
  const pendente = Boolean(op?.referenciaPendente) || op?.statusReferencia === "pendente";

  if (pendente) {
    return `<span class="badge pending">Pendente</span>`;
  }

  return `<span class="badge ok">Conferida</span>`;
}

function statusProdutoBadge(produto) {
  const pendente = Boolean(produto?.cadastroPendente) || produto?.statusCadastro === "pendente";

  if (pendente) {
    return `<span class="badge pending">Pendente</span>`;
  }

  return `<span class="badge ok">Conferido</span>`;
}

async function atualizarOrdensDaReferencia(produto) {
  if (!produto?.referencia) return 0;

  const ordensQuery = query(
    collection(db, "ordensProducao"),
    where("referencia", "==", normalizarReferencia(produto.referencia))
  );

  const snap = await getDocs(ordensQuery);

  if (snap.empty) return 0;

  let batch = writeBatch(db);
  let contador = 0;
  let total = 0;

  snap.docs.forEach(documento => {
    batch.set(doc(db, "ordensProducao", documento.id), {
      produtoNome: produto.nome,
      possuiAlca: Boolean(produto.possuiAlca),
      possuiBojo: Boolean(produto.possuiBojo),
      possuiRenda: Boolean(produto.possuiRenda),
      referenciaPendente: false,
      statusReferencia: "conferida",
      pendencia: "",
      atualizadoPor: state.currentUser.uid,
      atualizadoEm: serverTimestamp()
    }, { merge: true });

    contador++;
    total++;
  });

  if (contador > 0) {
    await batch.commit();
  }

  return total;
}

function simNaoBadge(valor) {
  return `<span class="badge ${valor ? "yes" : "no"}">${valor ? "Sim" : "Não"}</span>`;
}

function escapeHtml(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden");

  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    el.classList.add("hidden");
  }, 3500);
}

window.editarProduto = editarProduto;
window.excluirProduto = excluirProduto;
window.editarOrdem = editarOrdem;
window.excluirOrdem = excluirOrdem;
window.alternarUsuario = alternarUsuario;
window.iniciarCadastroProdutoPelaOrdem = iniciarCadastroProdutoPelaOrdem;
window.conferirReferenciaPendente = conferirReferenciaPendente;
window.verOrdensDaReferencia = verOrdensDaReferencia;
