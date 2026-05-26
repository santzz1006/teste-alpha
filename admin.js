/**
 * ==========================================================================
 * ARQUIVO: admin.js
 * SISTEMA: ALPHA CORE ADMIN PANEL V2.0
 * DESCRIÇÃO: Lógica de Autenticação Segura (Supabase), Roteamento e UI.
 * STATUS: Autenticação em Produção. Banco de dados e Storage na nuvem.
 * ==========================================================================
 */

// ==========================================================================
// 1. CONFIGURAÇÃO SUPABASE (AUTENTICAÇÃO E BANCO DE DADOS)
// ==========================================================================
const SUPABASE_URL = 'https://qpvstnbbibxizrdpcdex.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdnN0bmJiaWJ4aXpyZHBjZGV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NjA5NjEsImV4cCI6MjA4ODEzNjk2MX0.XIAlGVkQEVQ-3VzAMqtkqkaRyN-wE6kJYjJhdEAECS4';

// Inicializa o cliente Supabase globalmente
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================================================
// 2. CONFIGURAÇÕES GLOBAIS E ESTADO DO SISTEMA
// ==========================================================================
const ALPHA_CONFIG = {
    storageKeys: {
        updates: 'alpha_data_updates_v2',
        // Suppliers não usa mais localStorage principal, vem da nuvem.
    }
};

let systemState = {
    activeTab: 'dashboard',
    suppliers: [], // Agora será preenchido pelo banco de dados
    updates: [],
    isLogged: false,
    adminEmail: ''
};

/**
 * ==========================================================================
 * 3. INICIALIZAÇÃO E CICLO DE VIDA (BOOTSTRAP)
 * ==========================================================================
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 ALPHA ADMIN: Inicializando Módulos de Segurança...");
    
    // 1. Bloqueia a tela e verifica o token do Supabase
    await checkSession();
    
    // 2. Prepara os eventos de botões e formulários
    setupEventListeners();
    
    // 3. Se o Supabase confirmar o login, carrega os dados e mostra o painel
    if (systemState.isLogged) {
        await fetchSuppliersFromSupabase(); // Busca da nuvem
        loadDatabase(); // Busca updates do localStorage (Fase 1 de updates)
        renderAll();
        atualizarDadosPerfil();
    }
});

/**
 * ==========================================================================
 * 4. MÓDULO DE SEGURANÇA E AUTENTICAÇÃO (SUPABASE AUTH)
 * ==========================================================================
 */
async function checkSession() {
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        
        if (error) throw error;

        if (session) {
            console.log("✅ Sessão validada pelo Supabase.");
            systemState.isLogged = true;
            systemState.adminEmail = session.user.email;
            
            // Transição UI: Esconde Login, Mostra Painel
            const loginScreen = document.getElementById('loginScreen');
            const adminPanel = document.getElementById('adminPanel');
            
            if(loginScreen) loginScreen.classList.add('hidden-imp');
            if(adminPanel) {
                adminPanel.classList.remove('hidden');
                setTimeout(() => adminPanel.classList.add('opacity-100'), 50);
            }
        } else {
            console.log("🔒 Nenhuma sessão ativa. Exibindo tela de login.");
        }
    } catch (err) {
        console.error("Erro ao verificar sessão:", err.message);
    }
}

async function handleLogin() {
    const emailInput = document.getElementById('loginUser').value.trim();
    const passInput = document.getElementById('loginPass').value;
    const errBox = document.getElementById('loginError');
    const btnSubmit = document.querySelector('#loginForm button[type="submit"]');

    if (!emailInput || !passInput) {
        showLoginError("Preencha o e-mail e a senha.");
        return;
    }

    // Feedback Visual: Loading state
    const originalBtnHtml = btnSubmit.innerHTML;
    btnSubmit.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Autenticando...';
    btnSubmit.disabled = true;
    btnSubmit.classList.add('opacity-70', 'cursor-not-allowed');
    errBox.classList.add('hidden');

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: emailInput,
            password: passInput,
        });

        if (error) throw error;

        // --- SUCESSO NO LOGIN ---
        console.log("🔓 Acesso Concedido.");
        systemState.isLogged = true;
        systemState.adminEmail = data.user.email;
        
        // Efeito de transição suave
        document.getElementById('loginScreen').classList.add('opacity-0');
        
        setTimeout(async () => {
            document.getElementById('loginScreen').classList.add('hidden-imp');
            const adminPanel = document.getElementById('adminPanel');
            adminPanel.classList.remove('hidden');
            
            setTimeout(async () => {
                adminPanel.classList.add('opacity-100');
                
                // Carrega os dados da nuvem
                await fetchSuppliersFromSupabase();
                loadDatabase();
                
                renderAll();
                atualizarDadosPerfil();
                showNotification(`Bem-vindo, ${systemState.adminEmail}`, "success");
            }, 100);
        }, 500);

    } catch (error) {
        console.error("Falha no login:", error.message);
        let msg = "Acesso Negado. Verifique suas credenciais.";
        if (error.message.includes("Invalid login")) msg = "E-mail ou senha incorretos.";
        if (error.message.includes("Email not confirmed")) msg = "Confirme seu e-mail primeiro.";
        showLoginError(msg);
    } finally {
        btnSubmit.innerHTML = originalBtnHtml;
        btnSubmit.disabled = false;
        btnSubmit.classList.remove('opacity-70', 'cursor-not-allowed');
    }
}

async function doLogout() {
    if (confirm("Deseja encerrar a sessão administrativa e sair do sistema?")) {
        try {
            const { error } = await supabaseClient.auth.signOut();
            if (error) throw error;
            console.log("Sessão encerrada.");
            window.location.reload();
        } catch (err) {
            showNotification("Erro ao tentar sair: " + err.message, "error");
        }
    }
}

function showLoginError(message) {
    const errBox = document.getElementById('loginError');
    errBox.innerHTML = `<i class="fas fa-triangle-exclamation"></i> ${message}`;
    errBox.classList.remove('hidden');
    errBox.classList.remove('animate-shake');
    void errBox.offsetWidth; 
    errBox.classList.add('animate-shake');
}

/**
 * ==========================================================================
 * 5. LISTENERS GERAIS E EVENTOS DE UI
 * ==========================================================================
 */
function setupEventListeners() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleLogin();
        });
    }

    const btnPass = document.getElementById('togglePass');
    if (btnPass) {
        btnPass.addEventListener('click', () => {
            const input = document.getElementById('loginPass');
            const icon = btnPass.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.replace('fa-eye-slash', 'fa-eye');
            }
        });
    }

    const searchInput = document.getElementById('searchSupplier');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterSuppliers(e.target.value);
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modals = ['modal-fornecedor', 'modal-update'];
            modals.forEach(id => {
                const modal = document.getElementById(id);
                if (modal && !modal.classList.contains('hidden') && !modal.classList.contains('hidden-imp')) {
                    closeModal(id);
                }
            });
        }
    });
}

/**
 * ==========================================================================
 * 6. SISTEMA DE ROTEAMENTO (NAVEGAÇÃO SPA)
 * ==========================================================================
 */
function changeTab(tabId) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active', 'bg-white/5', 'text-white');
        btn.classList.add('text-gray-400');
        const icon = btn.querySelector('i');
        if(icon) icon.classList.remove('text-primary');

        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active', 'bg-white/5', 'text-white');
            btn.classList.remove('text-gray-400');
            if(icon) icon.classList.add('text-primary');
        }
    });

    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
        content.classList.remove('block');
    });

    const activeView = document.getElementById(`view-${tabId}`);
    if(activeView) {
        activeView.classList.remove('hidden');
        activeView.classList.add('block');
    }

    const titles = {
        dashboard: "Dashboard Inicial",
        analytics: "Analytics & Dados",
        fornecedores: "Gestão de Fornecedores",
        usuarios: "Base de Usuários",
        atualizacoes: "Histórico de Atualizações",
        configuracoes: "Configurações Globais",
        perfil: "Meu Perfil Alpha"
    };
    
    const headerTitle = document.getElementById('headerTitle');
    if(headerTitle) headerTitle.innerText = titles[tabId] || "Alpha Admin";
    
    systemState.activeTab = tabId;
    renderAll();
}

/**
 * ==========================================================================
 * 7. BANCO DE DADOS (SUPABASE + LOCALSTORAGE PARA UPDATES)
 * ==========================================================================
 */

// BUSCAR FORNECEDORES DO BANCO DE DADOS NUVEM
async function fetchSuppliersFromSupabase() {
    try {
        const { data, error } = await supabaseClient
            .from('fornecedores')
            .select('*')
            .order('id', { ascending: false });

        if (error) throw error;
        
        systemState.suppliers = data || [];
        console.log(`📦 ${systemState.suppliers.length} fornecedores carregados da nuvem.`);
    } catch (err) {
        console.error("Erro ao buscar fornecedores:", err.message);
        showNotification("Erro ao conectar com o banco de dados.", "error");
    }
}

function loadDatabase() {
    try {
        const storedUpd = localStorage.getItem(ALPHA_CONFIG.storageKeys.updates);
        systemState.updates = storedUpd ? JSON.parse(storedUpd) : [];
    } catch (e) {
        console.error("Erro ao ler LocalStorage", e);
        systemState.updates = [];
    }
}

function saveDatabase() {
    try {
        localStorage.setItem(ALPHA_CONFIG.storageKeys.updates, JSON.stringify(systemState.updates));
    } catch (e) {
        showNotification("Erro ao salvar dados localmente.", "error");
    }
}

/**
 * ==========================================================================
 * 8. MÓDULO: GESTÃO DE FORNECEDORES (CRUD NUVEM)
 * ==========================================================================
 */
function renderSuppliers(filteredData = null) {
    const list = filteredData || systemState.suppliers;
    const tbody = document.getElementById('tableSuppliersBody');
    const dashCount = document.getElementById('dashSupplierCount');
    const tableCount = document.getElementById('supCountBottom');

    if (dashCount) dashCount.innerText = systemState.suppliers.length;
    if (tableCount) tableCount.innerText = list.length;

    if (!tbody) return;

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-10 text-center text-gray-500 font-medium">O catálogo de fornecedores está vazio.</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    list.forEach(sup => {
        let statusClass = 'text-gray-500 bg-gray-500/10 border-gray-500/30';
        // Simulando status já que o DB original não tinha essa coluna no SQL que criei, 
        // mas mantendo a lógica de UI caso você adicione depois.
        const statusReal = sup.status || 'Ativo'; 
        if (statusReal === 'Ativo') statusClass = 'text-green-500 bg-green-500/10 border-green-500/30';
        if (statusReal === 'Analise') statusClass = 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
        if (statusReal === 'Bloqueado') statusClass = 'text-red-500 bg-red-500/10 border-red-500/30';

        const scoreValue = parseFloat(sup.score) || 10;
        const fullStars = Math.floor(scoreValue / 2);
        let starsHtml = '';
        for(let i=0; i<5; i++) {
            starsHtml += `<i class="${i < fullStars ? 'fas' : 'far'} fa-star"></i>`;
        }

        const logoUrl = sup.image ? sup.image : `https://ui-avatars.com/api/?name=${encodeURIComponent(sup.name)}&background=111&color=00a2ff`;

        tbody.innerHTML += `
            <tr class="group hover:bg-white/[0.03] transition-colors border-b border-white/5">
                <td class="p-4">
                    <div class="flex items-center gap-4">
                        <img src="${logoUrl}" alt="Logo" class="w-10 h-10 rounded-xl object-cover border border-white/10 flex-shrink-0" onerror="this.src='https://ui-avatars.com/api/?name=Erro&background=111&color=red'">
                        <div>
                            <p class="text-sm font-bold text-white mb-0.5">${sup.name}</p>
                            <p class="text-[10px] text-gray-500 font-mono tracking-wider">${sup.id}</p>
                        </div>
                    </div>
                </td>
                <td class="p-4">
                    <span class="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md bg-dark-700 text-gray-300 border border-white/5 inline-block mb-2">
                        ${sup.category || 'Geral'}
                    </span>
                    <div class="flex gap-3 text-xs">
                        ${sup.link ? `<a href="${sup.link}" target="_blank" class="text-gray-500 hover:text-primary transition" title="Acessar Loja Original"><i class="fas fa-external-link-alt"></i></a>` : ''}
                    </div>
                </td>
                <td class="p-4">
                    <div class="flex items-center gap-2">
                        <div class="flex text-[10px] text-yellow-500 tracking-tighter">
                            ${starsHtml}
                        </div>
                        <span class="text-xs font-black text-white">${scoreValue.toFixed(1)}</span>
                    </div>
                </td>
                <td class="p-4 text-center">
                    <span class="text-[9px] font-black uppercase tracking-wider px-3 py-1 rounded-full border ${statusClass}">
                        ${statusReal}
                    </span>
                </td>
                <td class="p-4 text-right">
                    <div class="flex justify-end gap-2">
                        <button onclick="editSupplier('${sup.id}')" class="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition border border-transparent hover:border-blue-400 shadow-sm" title="Editar Fornecedor">
                            <i class="fas fa-edit text-xs"></i>
                        </button>
                        <button onclick="deleteSupplier('${sup.id}')" class="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition border border-transparent hover:border-red-400 shadow-sm" title="Excluir Fornecedor">
                            <i class="fas fa-trash text-xs"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
}

function openSupplierModal(id = null) {
    const modal = document.getElementById('modal-fornecedor');
    const box = document.getElementById('modal-fornecedor-box');
    const form = document.getElementById('form-fornecedor');
    
    form.reset();
    document.getElementById('supId').value = "";
    document.getElementById('formSupTitle').innerText = "Cadastrar Novo Fornecedor";

    if (id) {
        // Encontra no state (já que são IDs numéricos vindos do Supabase)
        const sup = systemState.suppliers.find(s => s.id == id);
        if (sup) {
            document.getElementById('supId').value = sup.id;
            document.getElementById('supName').value = sup.name || '';
            
            // Usa o novo input dinâmico de categoria
            const catInput = document.getElementById('categoria-input');
            if(catInput) catInput.value = sup.category || '';
            
            const desc = document.getElementById('supDesc'); if(desc) desc.value = sup.description || '';
            const link = document.getElementById('supLink'); if(link) link.value = sup.link || '';
            const logoLink = document.getElementById('link-logo'); if(logoLink) logoLink.value = sup.image || '';

            document.getElementById('formSupTitle').innerText = "Editar Cadastro";
        }
    }

    modal.classList.remove('hidden', 'hidden-imp');
    modal.classList.add('flex');
    setTimeout(() => box.classList.replace('scale-95', 'scale-100'), 10);
}

// BOTÃO SALVAR AGORA CONECTADO AO SUPABASE E STORAGE
async function saveSupplierBtn() {
    const btn = document.querySelector('#modal-fornecedor .bg-primary');
    const originalText = btn.innerHTML;
    
    // Coleta dados
    const rawId = document.getElementById('supId').value;
    const nameVal = document.getElementById('supName').value.trim();
    const catInput = document.getElementById('categoria-input');
    const categoryVal = catInput ? catInput.value : 'Outros';
    const descInput = document.getElementById('supDesc');
    const descriptionVal = descInput ? descInput.value.trim() : '';
    const linkInput = document.getElementById('supLink');
    const linkVal = linkInput ? linkInput.value.trim() : '';
    
    // Lógica de Imagem
    let finalImageUrl = '';
    const linkLogoInput = document.getElementById('link-logo');
    if (linkLogoInput) finalImageUrl = linkLogoInput.value.trim();
    
    const fileInput = document.getElementById('arquivo-logo');
    const imageFile = fileInput && fileInput.files.length > 0 ? fileInput.files[0] : null;

    if (!nameVal) {
        showNotification("Erro: O Nome do Fornecedor é obrigatório.", "error");
        return;
    }

    try {
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
        btn.disabled = true;

        // 1. FAZ O UPLOAD SE HOUVER ARQUIVO
        if (imageFile) {
            const fileExt = imageFile.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;

            const { data: uploadData, error: uploadError } = await supabaseClient.storage
                .from('logos') 
                .upload(fileName, imageFile);

            if (uploadError) throw uploadError;

            // Pega o link público
            const { data: publicUrlData } = supabaseClient.storage
                .from('logos')
                .getPublicUrl(fileName);

            finalImageUrl = publicUrlData.publicUrl;
        }

        // 2. MONTA O OBJETO PRO BANCO DE DADOS
        const dbPayload = {
            name: nameVal,
            category: categoryVal,
            description: descriptionVal,
            link: linkVal,
            image: finalImageUrl
        };

        // 3. INSERE OU ATUALIZA NO SUPABASE
        if (rawId) {
            // EDITAR EXISTENTE
            const { error } = await supabaseClient
                .from('fornecedores')
                .update(dbPayload)
                .eq('id', rawId);
                
            if (error) throw error;
        } else {
            // CRIAR NOVO
            const { error } = await supabaseClient
                .from('fornecedores')
                .insert([dbPayload]);
                
            if (error) throw error;
        }

        // 4. ATUALIZA A TELA LENDO DA NUVEM NOVAMENTE
        await fetchSuppliersFromSupabase();
        renderSuppliers();
        if(systemState.activeTab === 'dashboard') carregarUltimasAtividades();
        closeModal('modal-fornecedor');
        showNotification("Fornecedor salvo na nuvem com sucesso!", "success");

    } catch (error) {
        console.error("Erro ao salvar no banco:", error.message);
        showNotification("Erro ao salvar: " + error.message, "error");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function deleteSupplier(id) {
    if (confirm("Alerta de Segurança: A exclusão de um fornecedor não pode ser desfeita na nuvem. Confirmar?")) {
        try {
            const { error } = await supabaseClient
                .from('fornecedores')
                .delete()
                .eq('id', id);

            if (error) throw error;

            await fetchSuppliersFromSupabase();
            renderSuppliers();
            showNotification("Fornecedor permanentemente excluído.", "warning");
            
        } catch (err) {
            console.error("Erro ao excluir:", err.message);
            showNotification("Erro ao excluir do servidor.", "error");
        }
    }
}

// Mantido filterSuppliers (pesquisa na memória local que foi baixada da nuvem)
function filterSuppliers(query) {
    const q = query.toLowerCase().trim();
    const filtered = systemState.suppliers.filter(s => 
        (s.name && s.name.toLowerCase().includes(q)) || 
        (s.category && s.category.toLowerCase().includes(q))
    );
    renderSuppliers(filtered);
}

// Alias para manter compatibilidade com o HTML (botão de editar antigo)
function editSupplier(id) {
    openSupplierModal(id);
}

/**
 * ==========================================================================
 * 9. MÓDULO: HISTÓRICO DE ATUALIZAÇÕES (CHANGELOG) - MANTIDO LOCAL
 * ==========================================================================
 */
function renderUpdates() {
    const container = document.getElementById('updatesListContainer');
    if (!container) return;

    if (systemState.updates.length === 0) {
        container.innerHTML = `
            <div class="p-12 bg-dark-800 rounded-2xl border border-dashed border-white/10 text-center shadow-inner">
                <i class="fas fa-timeline text-4xl text-gray-700 mb-4"></i>
                <p class="text-sm font-bold text-gray-500 uppercase tracking-widest">Nenhuma atualização registrada.</p>
                <p class="text-xs text-gray-600 mt-2">Mantenha seus usuários informados postando as novidades do site.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    systemState.updates.forEach(upd => {
        let badgeColor = 'bg-gray-500/10 text-gray-500';
        let iconHtml = '<i class="fas fa-info"></i>';
        
        if (upd.type === 'FEATURE') {
            badgeColor = 'bg-green-500/10 text-green-500 border border-green-500/20';
            iconHtml = '<i class="fas fa-star"></i>';
        } else if (upd.type === 'FIX') {
            badgeColor = 'bg-red-500/10 text-red-500 border border-red-500/20';
            iconHtml = '<i class="fas fa-bug"></i>';
        }

        let dataVisual = upd.date;
        if(upd.date && upd.date.includes('-')) {
            const p = upd.date.split('-');
            dataVisual = `${p[2]}/${p[1]}/${p[0]}`;
        }

        container.innerHTML += `
            <div class="bg-dark-800 border border-white/5 rounded-2xl p-6 flex justify-between items-start group hover:border-primary/30 transition-all duration-300">
                <div class="flex gap-4 md:gap-6">
                    <div class="w-12 h-12 rounded-xl bg-dark-900 border border-white/5 flex items-center justify-center text-gray-400 group-hover:text-primary group-hover:bg-primary/5 transition-colors flex-shrink-0 shadow-sm">
                        ${iconHtml}
                    </div>
                    <div>
                        <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
                            <h4 class="text-white font-black text-lg tracking-tight">${upd.title}</h4>
                            <span class="text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest ${badgeColor}">${upd.type}</span>
                            <span class="text-xs text-gray-500 font-mono sm:ml-auto"><i class="far fa-clock mr-1"></i>${dataVisual}</span>
                        </div>
                        <p class="text-sm text-gray-400 leading-relaxed whitespace-pre-line">${upd.content}</p>
                    </div>
                </div>
                <div class="flex flex-col gap-2 pl-4 border-l border-white/5 ml-4 flex-shrink-0 justify-center">
                    <button onclick="deleteUpdate('${upd.id}')" class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:bg-red-500/10 hover:text-red-500 transition" title="Excluir Registro">
                        <i class="fas fa-trash-alt text-xs"></i>
                    </button>
                </div>
            </div>
        `;
    });
}

function openUpdateModal() {
    const modal = document.getElementById('modal-update');
    const box = document.getElementById('modal-update-box');
    
    document.getElementById('form-update').reset();
    
    const dateInput = document.getElementById('updDate');
    if (dateInput) {
        const hoje = new Date();
        const dia = String(hoje.getDate()).padStart(2, '0');
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        const ano = hoje.getFullYear();
        dateInput.value = `${ano}-${mes}-${dia}`;
    }
    
    modal.classList.remove('hidden', 'hidden-imp');
    modal.classList.add('flex');
    setTimeout(() => box.classList.replace('scale-95', 'scale-100'), 10);
}

function saveUpdateBtn() {
    const updTitle = document.getElementById('updTitle');
    const updDate = document.getElementById('updDate');
    const updType = document.getElementById('updType');
    const updContent = document.getElementById('updContent');

    if (!updTitle || !updContent || !updTitle.value.trim() || !updContent.value.trim()) {
        showNotification("Erro: Título e Conteúdo são obrigatórios.", "error");
        return;
    }

    const upd = {
        id: `UPD-${Date.now()}`,
        title: updTitle.value.trim(),
        date: updDate ? updDate.value : new Date().toISOString().split('T')[0],
        type: updType ? updType.value : 'FEATURE',
        content: updContent.value.trim()
    };

    systemState.updates.unshift(upd);
    saveDatabase();
    renderUpdates();
    closeModal('modal-update');
    showNotification("Atualização publicada com sucesso!", "success");
}

function deleteUpdate(id) {
    if (confirm("Confirmar a exclusão permanente deste changelog?")) {
        systemState.updates = systemState.updates.filter(u => u.id !== id);
        saveDatabase();
        renderUpdates();
        showNotification("Registro de atualização excluído.", "warning");
    }
}

// BUSCAR TODAS AS ATIVIDADES (FORNECEDORES + SCANS)
async function carregarUltimasAtividades() {
    const container = document.getElementById('listaAtividades');
    if (!container) return;

    try {
        // 1. Busca os últimos fornecedores
        const { data: fornecedores } = await supabaseClient
            .from('fornecedores')
            .select('id, name, category')
            .order('id', { ascending: false })
            .limit(5);

        // 2. Busca os últimos scans (ajuste o nome da tabela se for diferente no seu banco)
        const { data: scans } = await supabaseClient
            .from('historico_scans') 
            .select('id, url, status')
            .order('id', { ascending: false })
            .limit(5);

        // 3. Une e identifica cada tipo
        let atividades = [
            ...(fornecedores || []).map(f => ({ ...f, tipo: 'fornecedor' })),
            ...(scans || []).map(s => ({ ...s, tipo: 'scan' }))
        ];

        // 4. Ordena pelo ID (mais recente no topo)
        atividades.sort((a, b) => b.id - a.id);

        if (atividades.length === 0) {
            container.innerHTML = '<p class="text-gray-600 text-center text-xs py-10">Nenhuma atividade registrada.</p>';
            return;
        }

        container.innerHTML = ''; // Limpa o carregando...

        atividades.slice(0, 6).forEach(atv => {
            const isFornecedor = atv.tipo === 'fornecedor';
            const icone = isFornecedor ? 'fa-plus-circle text-[#00a2ff]' : 'fa-shield-alt text-yellow-500';
            const label = isFornecedor ? 'Novo Fornecedor' : 'Scan Efetuado';
            const principal = isFornecedor ? atv.name : atv.url;
            const sub = isFornecedor ? atv.category : (atv.status === 'safe' ? 'Link Seguro' : 'Link Suspeito');

            container.innerHTML += `
                <div class="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all group">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                            <i class="fas ${icone}"></i>
                        </div>
                        <div class="max-w-[180px] md:max-w-xs">
                            <p class="text-sm font-bold text-gray-200 truncate">${label}: <span class="text-white">${principal}</span></p>
                            <p class="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">${sub}</p>
                        </div>
                    </div>
                    <div class="text-right flex-shrink-0">
                        <span class="text-[9px] text-gray-600 font-mono">ID #${atv.id}</span>
                    </div>
                </div>
            `;
        });

    } catch (err) {
        console.error("Erro ao carregar log:", err);
        container.innerHTML = '<p class="text-red-500 text-center text-xs">Erro ao sincronizar atividades.</p>';
    }
}
/**
 * ==========================================================================
 * 10. FUNÇÕES UTILITÁRIAS DE UI E HELPERS GLOBAIS
 * ==========================================================================
 */
function closeModal(id) {
    const modal = document.getElementById(id);
    const box = document.getElementById(`${id}-box`);
    
    if (box) {
        box.classList.replace('scale-100', 'scale-95');
    }
    
    setTimeout(() => {
        if(modal) {
            modal.classList.remove('flex');
            modal.classList.add('hidden');
        }
    }, 200); 
}

function renderAll() {
    if (systemState.activeTab === 'dashboard') {
        const supCount = document.getElementById('dashSupplierCount');
        if (supCount) supCount.innerText = systemState.suppliers.length;
        // --- ADICIONE ESTA LINHA ABAIXO ---
        carregarUltimasAtividades(); 
        // ---------------------------------
    }
    
    if (systemState.activeTab === 'fornecedores') {
        renderSuppliers();
    }
    
    if (systemState.activeTab === 'atualizacoes') {
        renderUpdates();
    }
}

function showNotification(msg, type = "success") {
    const oldToast = document.getElementById('alpha-toast');
    if(oldToast) oldToast.remove();

    let colorClass = "bg-primary text-white";
    let iconClass = "fa-check-circle";

    if (type === "error") {
        colorClass = "bg-red-500 text-white";
        iconClass = "fa-triangle-exclamation";
    } else if (type === "warning") {
        colorClass = "bg-orange-500 text-white";
        iconClass = "fa-info-circle";
    }

    const toast = document.createElement('div');
    toast.id = 'alpha-toast';
    toast.className = `fixed bottom-8 right-8 ${colorClass} px-6 py-4 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] font-bold text-sm z-[200] flex items-center gap-3 transition-all duration-300 transform translate-y-10 opacity-0`;
    toast.innerHTML = `<i class="fas ${iconClass} text-lg"></i> <span>${msg}</span>`;
    
    document.body.appendChild(toast);
    
    requestAnimationFrame(() => {
        setTimeout(() => {
            toast.classList.remove('translate-y-10', 'opacity-0');
            toast.classList.add('translate-y-0', 'opacity-100');
        }, 10);
    });
    
    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-10', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function atualizarDadosPerfil() {
    const emailToDisplay = systemState.adminEmail || 'admin@alphacore.com';
    
    const sidebarEmail = document.querySelector('aside .text-\\[10px\\].text-gray-500.uppercase');
    if(sidebarEmail) {
        sidebarEmail.innerText = emailToDisplay;
    }

    const profileEmail = document.querySelector('#view-perfil .text-primary.font-bold.text-sm');
    if(profileEmail) profileEmail.innerText = emailToDisplay;

    const profileIpDate = document.querySelectorAll('#view-perfil .italic');
    if(profileIpDate.length > 0) {
        const dataHoje = new Date().toLocaleDateString('pt-BR');
        profileIpDate[0].innerText = "Ambiente Seguro (Supabase Auth)";
        profileIpDate[0].classList.remove('italic');
        if(profileIpDate[1]) {
            profileIpDate[1].innerText = `Sessão validada em ${dataHoje}`;
            profileIpDate[1].classList.remove('italic');
        }
    }
}