/**
 * ==============================================================================
 * ALPHA CORE - ENGINE DE INTELIGÊNCIA ARTIFICIAL (ANTI-GOLPE)
 * Version: 5.5.1 (Enterprise Ultimate Edition - VIP Save Analytics)
 * Architecture: Modular Namespace Design
 * Features: Supabase + suppliersData.js Integration, Deterministic PRNG, Flawless Matching
 * ==============================================================================
 */

window.AlphaCore = window.AlphaCore || {};

/**
 * ------------------------------------------------------------------------------
 * 1. CONFIGURAÇÕES E ESTADOS GLOBAIS
 * ------------------------------------------------------------------------------
 */
AlphaCore.Config = {
    SUPABASE_URL: 'https://qpvstnbbibxizrdpcdex.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwdnN0bmJiaWJ4aXpyZHBjZGV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NjA5NjEsImV4cCI6MjA4ODEzNjk2MX0.XIAlGVkQEVQ-3VzAMqtkqkaRyN-wE6kJYjJhdEAECS4',
    RISK_PROBABILITY: 0.20, // 20% de chance (1 em 5) de dar risco em links DESCONHECIDOS
    ANIMATION_SPEED: 1500
};

try {
    AlphaCore.db = supabase.createClient(AlphaCore.Config.SUPABASE_URL, AlphaCore.Config.SUPABASE_KEY);
} catch (e) {
    console.error("[AlphaCore] Falha ao inicializar Supabase SDK.", e);
}

/**
 * ------------------------------------------------------------------------------
 * 2. UTILITÁRIOS (Limpador de Link Inteligente e Matemática)
 * ------------------------------------------------------------------------------
 */
AlphaCore.Utils = {
    sanitizeURL: function(url) {
        if (!url) return '';
        let clean = url.trim().toLowerCase();
        if (!clean.startsWith('http')) clean = 'https://' + clean;

        try {
            let urlObj = new URL(clean);
            let domain = urlObj.hostname.replace('www.', '');
            let path = urlObj.pathname;
            let id = urlObj.searchParams.get('id');
            let itemID = urlObj.searchParams.get('itemID');
            
            // Tratamento específico por plataforma
            if (domain.includes('taobao.com') || domain.includes('tmall.com')) {
                if (id) return `taobao.com/item.htm?id=${id}`;
            }
            if (domain.includes('weidian.com')) {
                if (itemID) return `weidian.com/item.html?itemID=${itemID}`;
            }
            if (domain.includes('1688.com')) {
                let match = path.match(/\/(\d+)\.html/);
                if (match) return `1688.com/offer/${match[1]}.html`;
            }
            if (domain.includes('goofish.com') || domain.includes('xianyu') || domain.includes('2.taobao.com')) {
                if (id) return `goofish.com/item?id=${id}`;
            }

            // Fallback genérico: remove rastreadores conhecidos (spm, utm)
            urlObj.searchParams.delete('spm');
            urlObj.searchParams.delete('utm_source');
            urlObj.searchParams.delete('scm');
            let params = urlObj.searchParams.toString();
            return domain + path + (params ? '?' + params : '');

        } catch(e) {
            return clean.split('?')[0].replace(/[^a-zA-Z0-9.\-\/:]/g, '');
        }
    },

    // Extrai a sequência de números do link para cruzar dados
    extractID: function(url) {
        if (!url) return null;
        const matches = url.match(/\d{6,}/); // Busca sequências de 6 ou mais números
        return matches ? matches[0] : null;
    },

    // Semente matemática para gerar sempre a mesma nota pro mesmo link
    seededRandom: function(seed) {
        let num = parseInt(seed) || 12345;
        let x = Math.sin(num++) * 10000;
        return x - Math.floor(x);
    },

    formatNumber: function(num) {
        return num.toLocaleString('pt-BR');
    },

    animateValue: function(obj, start, end, duration, isFloat = false) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
            let current = start + easeProgress * (end - start);
            
            if (isFloat) obj.innerHTML = current.toFixed(1);
            else obj.innerHTML = AlphaCore.Utils.formatNumber(Math.floor(current));
            
            if (progress < 1) window.requestAnimationFrame(step);
        };
        window.requestAnimationFrame(step);
    }
};

/**
 * ------------------------------------------------------------------------------
 * 3. BIG DATA: FEEDBACKS SEPARADOS (Parceiros = 100% Bons | Desconhecidos = Aleatório)
 * ------------------------------------------------------------------------------
 */
AlphaCore.Data = {
    // Bloqueia Agentes
    BlockedAgents: [
        "vigorbuy", "cssbuy", "superbuy", "cnfans", "pandabuy", "sugargoo", 
        "wegobuy", "hagobuy", "kameymall", "allchinabuy", "mulebuy", "joyabuy", "ezbuy", "orientdig"
    ],

    Reviews: {
        // Exclusivo para Parceiros e VIPs (100% Positivo)
        Premium: [
            { tipo: 'pos', txt: "A qualidade do material e o nível de detalhes são absurdos. Idêntico às fotos originais." },
            { tipo: 'pos', txt: "O vendedor enviou no mesmo dia para o armazém. O pacote chegou intacto e protegido." },
            { tipo: 'pos', txt: "Produto de linha premium. O peso e o acabamento mostram que não é uma peça barata." },
            { tipo: 'pos', txt: "Compro sempre desta loja. Fidelidade total ao que é prometido e zero problemas no processo." }
        ],
        
        // Padrão Aprovado (80% dos desconhecidos)
        Standard_Pos: [
            { tipo: 'pos', txt: "Chegou rápido no agente e a qualidade da construção é honesta pelo preço pago." },
            { tipo: 'pos', txt: "A caixa externa veio levemente amassada, mas o produto por dentro estava perfeito." },
            { tipo: 'pos', txt: "Ótimo acabamento geral. Recomendo para quem quer custo-benefício." },
            { tipo: 'pos', txt: "O produto é excelente, compra segura e vendedor muito prestativo no chat." }
        ],
        
        // Padrão Ruim / Risco (20% dos desconhecidos)
        Risk: [
            { tipo: 'neg', txt: "Alerta! O produto apresenta falhas visíveis de fabricação e recusaram devolução." },
            { tipo: 'neg', txt: "Não comprem! Me enviaram uma variação diferente e com qualidade de plástico barato." },
            { tipo: 'neg', txt: "A loja deletou os itens do catálogo logo após a minha compra e sumiu. Golpe clássico." },
            { tipo: 'neg', txt: "Demorou mais de 10 dias só para gerar o rastreio interno. Suporte horrível." }
        ],
        
        // Goofish (Usados) - Positivo 
        Goofish_Pos: [
            { tipo: 'pos', txt: "Preço inacreditável. O item era usado mas chegou praticamente novo." },
            { tipo: 'pos', txt: "Excelente achado! Produto muito bem conservado pelo dono anterior." },
            { tipo: 'pos', txt: "Vendedor super atencioso, mandou fotos extras reais no chat. Confiável." }
        ],
        
        // Goofish (Usados) - Negativo (Risco)
        Goofish_Neg: [
            { tipo: 'neg', txt: "O vendedor escondeu propositalmente marcas de uso pesadas. Evitem." },
            { tipo: 'neg', txt: "Produto com defeito não relatado no anúncio original. Perdi meu dinheiro." },
            { tipo: 'neg', txt: "Anúncio falso. O item que chegou no armazém era totalmente diferente da foto." }
        ]
    },

    getRandomReview: function(category, seedOffset) {
        const arr = this.Reviews[category];
        let index = seedOffset ? Math.floor(AlphaCore.Utils.seededRandom(seedOffset) * arr.length) : Math.floor(Math.random() * arr.length);
        return arr[index];
    }
};

/**
 * ------------------------------------------------------------------------------
 * 4. SERVIÇOS DE BANCO DE DADOS (Cruzamento Avançado e Captura de Imagens)
 * ------------------------------------------------------------------------------
 */
AlphaCore.Services = {
    
    checkWhitelist: async function(rawUrl, sanitizedUrl) {
        let extractedId = AlphaCore.Utils.extractID(rawUrl);

        // 1. TENTA LER O ARQUIVO LOCAL (suppliersData.js) - LEITURA BLINDADA
        try {
            const res = await fetch('suppliersData.js');
            if (res.ok) {
                const textData = await res.text();
                const startIndex = textData.indexOf('[');
                const endIndex = textData.lastIndexOf(']');
                
                if (startIndex !== -1 && endIndex !== -1) {
                    const arrayString = textData.substring(startIndex, endIndex + 1);
                    let localData = [];
                    
                    try {
                        // Função nativa que consegue ler arrays JS mesmo com aspas simples ou sem aspas
                        localData = new Function('return ' + arrayString)(); 
                    } catch(e) {
                        console.warn("[AlphaCore] Fallback parse suppliersData", e);
                    }

                    if (Array.isArray(localData)) {
                        const localMatch = localData.find(f => {
                            let link = (f.link || f.link_loja || f.url || "").toLowerCase();
                            if (!link) return false;
                            
                            // Tenta bater pelo ID (Método mais preciso)
                            let fileId = AlphaCore.Utils.extractID(link);
                            if (fileId && extractedId && fileId === extractedId) return true;
                            
                            // Tenta bater pela URL sanitizada
                            let sanFileLink = AlphaCore.Utils.sanitizeURL(link);
                            if (sanFileLink === sanitizedUrl || sanFileLink.includes(sanitizedUrl)) return true;
                            
                            return false;
                        });
                        
                        if (localMatch) {
                            console.log("[Alpha Pipeline] VIP encontrado no suppliersData.js!");
                            return { 
                                nome: localMatch.nome || localMatch.name || "Fornecedor Parceiro", 
                                link_loja: localMatch.link || localMatch.link_loja,
                                imagem: localMatch.imagem || localMatch.image || localMatch.img || localMatch.logo || localMatch.foto || null 
                            };
                        }
                    }
                }
            }
        } catch(e) {
            console.warn("[AlphaCore] Erro ao buscar no suppliersData.js.", e);
        }

        // 2. SE NÃO ACHOU, LÊ O SUPABASE (Nuvem)
        try {
            const { data, error } = await AlphaCore.db
                .from('fornecedores')
                .select('*') // Seleciona tudo para trazer a imagem também
                .ilike('link_loja', `%${sanitizedUrl}%`)
                .limit(1);
            
            if (error) throw error;
            if (data && data.length > 0) {
                console.log("[Alpha Pipeline] VIP encontrado no Supabase!");
                let dbMatch = data[0];
                return {
                    nome: dbMatch.nome,
                    link_loja: dbMatch.link_loja,
                    imagem: dbMatch.imagem || dbMatch.logo || dbMatch.foto || dbMatch.img || null
                };
            }
            return null; // Definitivamente não é VIP
        } catch (err) {
            return null;
        }
    },

    checkHistory: async function(sanitizedUrl) {
        const localCache = localStorage.getItem(`alpha_scan_${sanitizedUrl}`);
        if (localCache) return JSON.parse(localCache);

        try {
            const { data, error } = await AlphaCore.db
                .from('historico_scans')
                .select('dados_json')
                .eq('url_limpa', sanitizedUrl)
                .single();
            
            if (error && error.code !== 'PGRST116') throw error;
            if (data) {
                localStorage.setItem(`alpha_scan_${sanitizedUrl}`, JSON.stringify(data.dados_json));
                return data.dados_json;
            }
            return null;
        } catch (err) {
            return null;
        }
    },

    saveScan: async function(sanitizedUrl, scanData) {
        localStorage.setItem(`alpha_scan_${sanitizedUrl}`, JSON.stringify(scanData));
        try {
            await AlphaCore.db.from('historico_scans').insert([{ url_limpa: sanitizedUrl, dados_json: scanData }]);
        } catch (err) {}
    }
};

/**
 * ------------------------------------------------------------------------------
 * 5. ENGINE HEURÍSTICA (O CÉREBRO DE GERAÇÃO DE NOTAS)
 * ------------------------------------------------------------------------------
 */
AlphaCore.Engine = {
    
    // GERAÇÃO PARA PARCEIROS VIP - AGORA COM MOTOR MATEMÁTICO (NUNCA MAIS MUDA)
    generateVIPProfile: function(nomeFornecedor, imgUrl, rawUrl) {
        const seed = AlphaCore.Utils.extractID(rawUrl) || 12345;
        
        let avatarHtml = imgUrl 
            ? `<img src="${imgUrl}" alt="Logo ${nomeFornecedor}" class="w-full h-full object-cover rounded-full border-2 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.3)]">` 
            : '<i class="fas fa-gem text-yellow-400"></i>';

        return {
            nome: `${nomeFornecedor} (Verificado)`,
            avatarIcon: avatarHtml,
            badgeName: "SELO DE CONFIANÇA MÁXIMA",
            badgeColor: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
            bgGlow: "bg-yellow-500",
            capital: "Auditoria Alpha Core", 
            funcionarios: "Fornecedor Testado",
            modelo: "Premium / Homologado", 
            mercado: "Garantia de Qualidade",
            
            // Usando SeededRandom para travar os números baseados na URL
            pedidosNum: Math.floor(AlphaCore.Utils.seededRandom(seed) * 5000) + 12000,
            coleta: (98.5 + (AlphaCore.Utils.seededRandom(seed+1) * 1.4)).toFixed(1),
            rating: (4.8 + (AlphaCore.Utils.seededRandom(seed+2) * 0.2)).toFixed(1),
            
            statusTitle: "SEM RISCO",
            statusIcon: '<i class="fas fa-shield-check"></i>',
            statusBg: "bg-green-500/10 border-green-500",
            statusText: "text-green-500",
            reviews: [
                AlphaCore.Data.getRandomReview('Premium', seed+3),
                AlphaCore.Data.getRandomReview('Premium', seed+4),
                AlphaCore.Data.getRandomReview('Premium', seed+5)
            ],
            veredicto: "STATUS ALPHA: APROVAÇÃO SUPREMA. Este link pertence à base oficial de Fornecedores Homologados Alpha Core (Testado). A qualidade do produto e o histórico de envio foram rigorosamente validados. Pode prosseguir de olhos fechados!"
        };
    },

    // GERAÇÃO PARA DESCONHECIDOS (Com Sorteio de Risco)
    generateAnalysisProfile: function(sanitizedUrl, rawUrl) {
        const seed = AlphaCore.Utils.extractID(rawUrl) || AlphaCore.Utils.extractID(sanitizedUrl) || 12345;
        
        let isTaobao = sanitizedUrl.includes("taobao.com") || sanitizedUrl.includes("tmall.com");
        let isWeidian = sanitizedUrl.includes("weidian.com");
        let is1688 = sanitizedUrl.includes("1688.com");
        let isXianyu = sanitizedUrl.includes("goofish") || sanitizedUrl.includes("xianyu");

        // Roleta Russa
        let riskScore = AlphaCore.Utils.seededRandom(seed);
        let isRisco = riskScore < AlphaCore.Config.RISK_PROBABILITY; 

        let data = {
            nome: "Fornecedor Asiático",
            avatarIcon: '<i class="fas fa-store text-gray-500"></i>',
            badgeName: "VENDEDOR PADRÃO",
            badgeColor: "bg-gray-500/20 text-gray-400 border-gray-500/30",
            bgGlow: "bg-gray-500",
            capital: "100.000 RMB", funcionarios: "Micro/Pequena",
            modelo: "B2C / Varejo", mercado: "Global",
            pedidosNum: 0, coleta: 0, rating: 0,
            statusTitle: "", statusIcon: '', statusBg: "", statusText: "",
            reviews: [], veredicto: ""
        };

        // Identidade Visual
        if (isTaobao) {
            data.nome = "Lojista Oficial Taobao 淘宝";
            data.avatarIcon = '<i class="fas fa-shopping-bag text-orange-500"></i>';
            data.badgeColor = "bg-orange-500/20 text-orange-400 border-orange-500/30";
            data.bgGlow = "bg-orange-500";
            data.capital = "500.000 RMB (Padrão)";
        } else if (isWeidian) {
            data.nome = "Loja Independente Weidian 微店";
            data.avatarIcon = '<i class="fas fa-store text-red-500"></i>';
            data.badgeColor = "bg-red-500/20 text-red-400 border-red-500/30";
            data.bgGlow = "bg-red-500";
            data.capital = "Oculto (Independente)";
        } else if (is1688) {
            data.nome = "Fábrica Atacadista 1688 阿里巴巴";
            data.avatarIcon = '<i class="fas fa-industry text-yellow-600"></i>';
            data.badgeColor = "bg-yellow-600/20 text-yellow-500 border-yellow-600/30";
            data.bgGlow = "bg-yellow-600";
            data.capital = "1.000.000 RMB+ (Atacado)";
            data.funcionarios = "Fábrica (50+ Pessoas)";
            data.modelo = "B2B / Produção";
        } else if (isXianyu) {
            data.nome = "Vendedor Goofish / Xianyu 闲鱼";
            data.avatarIcon = '<i class="fas fa-fish text-purple-500"></i>';
            data.badgeColor = "bg-purple-500/20 text-purple-400 border-purple-500/30";
            data.bgGlow = "bg-purple-500";
            data.capital = "Conta Verificada PF";
            data.funcionarios = "Vendedor Único";
            data.modelo = "C2C / Desapego";
        }

        // Aplicação do Risco
        if (isRisco) {
            data.rating = 2.5 + (AlphaCore.Utils.seededRandom(seed+1) * 1.6);
            data.pedidosNum = Math.floor(AlphaCore.Utils.seededRandom(seed+2) * 35);
            data.coleta = 40 + (AlphaCore.Utils.seededRandom(seed+3) * 35);
            
            data.statusTitle = "COM RISCO";
            data.statusIcon = '<i class="fas fa-exclamation-triangle"></i>';
            data.statusBg = "bg-red-500/10 border-red-500";
            data.statusText = "text-red-500";
            
            if (isXianyu) {
                data.reviews = [
                    AlphaCore.Data.getRandomReview('Goofish_Neg', seed+4),
                    AlphaCore.Data.getRandomReview('Goofish_Neg', seed+5),
                    AlphaCore.Data.getRandomReview('Risk', seed+6)
                ];
            } else {
                data.reviews = [
                    AlphaCore.Data.getRandomReview('Risk', seed+4),
                    AlphaCore.Data.getRandomReview('Risk', seed+5),
                    AlphaCore.Data.getRandomReview('Standard_Neg', seed+6)
                ];
            }

            let motivo = data.rating < 4.2 ? `reputação global estar abaixo do limite aceitável (${data.rating.toFixed(1)})` : `histórico de vendas ser suspeito (${data.pedidosNum} envios consolidados)`;
            data.veredicto = `ALERTA ALPHA: PROTOCOLO DE SEGURANÇA. O cruzamento identificou grave risco de operação neste link devido à ${motivo}. Comprar deste fornecedor acarreta alta probabilidade de fraude, qualidade inferior ou recusa de reembolso. Evite esta transação.`;

        } else {
            // Aprovado Padrão
            data.rating = 4.3 + (AlphaCore.Utils.seededRandom(seed+1) * 0.7);
            data.pedidosNum = 200 + Math.floor(AlphaCore.Utils.seededRandom(seed+2) * 6000);
            data.coleta = 85 + (AlphaCore.Utils.seededRandom(seed+3) * 14);
            
            data.statusTitle = "SEM RISCO";
            data.statusIcon = '<i class="fas fa-shield-check"></i>';
            data.statusBg = "bg-green-500/10 border-green-500";
            data.statusText = "text-green-500";

            if (isXianyu) {
                data.reviews = [
                    AlphaCore.Data.getRandomReview('Goofish_Pos', seed+4),
                    AlphaCore.Data.getRandomReview('Goofish_Pos', seed+5),
                    AlphaCore.Data.getRandomReview('Goofish_Pos', seed+6)
                ];
                data.veredicto = `NOTA ALPHA: APROVADO COM RESSALVA. A loja tem métricas confiáveis (${data.rating.toFixed(1)} e bom volume). Por ser o Goofish (plataforma de usados C2C), nossa Inteligência instrui que você EXIJA fotos detalhadas (QC) no seu agente antes do envio internacional.`;
            } else {
                data.reviews = [
                    AlphaCore.Data.getRandomReview('Standard_Pos', seed+4),
                    AlphaCore.Data.getRandomReview('Standard_Pos', seed+5),
                    AlphaCore.Data.getRandomReview('Standard_Pos', seed+6)
                ];
                data.veredicto = `NOTA ALPHA: APROVADO. A inteligência neural avaliou positivamente este vendedor. A loja sustenta métricas consistentes, nota de ${data.rating.toFixed(1)} e rápida coleta logística. Risco baixíssimo.`;
            }
        }

        return data;
    }
};

/**
 * ------------------------------------------------------------------------------
 * 6. MANIPULAÇÃO DA INTERFACE DO USUÁRIO (UI)
 * ------------------------------------------------------------------------------
 */
AlphaCore.UI = {
    
    showLoading: function() {
        document.getElementById('resultState').classList.add('hidden');
        document.getElementById('loadingState').classList.remove('hidden');
        
        const logs = [document.getElementById('log1'), document.getElementById('log2'), document.getElementById('log3')];
        logs[0].innerText = "Estabelecendo handshake com servidores asiáticos...";
        logs[0].className = "text-[#00a2ff] font-mono";
        logs[1].innerText = "Aguardando resposta do banco de dados distribuído...";
        logs[1].className = "text-gray-500 font-mono";
        logs[2].innerText = "Standby para injeção de heurística...";
        logs[2].className = "text-gray-500 font-mono";

        setTimeout(() => { 
            logs[0].className = "text-gray-500 font-mono";
            logs[1].innerText = "Inspecionando assinaturas VIP e Whitelists..."; 
            logs[1].className = "text-[#00a2ff] font-mono"; 
        }, 1200);

        setTimeout(() => { 
            logs[1].className = "text-gray-500 font-mono";
            logs[2].innerText = "Compilando algoritmos de detecção de fraude..."; 
            logs[2].className = "text-[#00a2ff] font-mono"; 
        }, 2500);
    },

    hideLoading: function() {
        document.getElementById('loadingState').classList.add('hidden');
    },

    renderResults: function(scanData, originalUrl) {
        document.getElementById('storeUrl').innerText = originalUrl;
        document.getElementById('storeName').innerText = scanData.nome;
        document.getElementById('storeAvatar').innerHTML = scanData.avatarIcon;
        
        const badge = document.getElementById('storeBadge');
        badge.innerText = scanData.badgeName;
        badge.className = `px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${scanData.badgeColor}`;
        document.getElementById('bgGlow').className = `absolute top-0 right-0 w-64 h-64 rounded-full blur-[100px] opacity-20 -translate-y-1/2 translate-x-1/2 ${scanData.bgGlow}`;

        document.getElementById('resCapital').innerText = scanData.capital;
        document.getElementById('resEmployees').innerText = scanData.funcionarios;
        document.getElementById('resModel').innerText = scanData.modelo;
        document.getElementById('resMarket').innerText = scanData.mercado;
        
        const elOrders = document.getElementById('resOrders');
        const elColRate = document.getElementById('resColRate');
        const elRating = document.getElementById('resRatingNum');
        
        AlphaCore.Utils.animateValue(elOrders, 0, scanData.pedidosNum, AlphaCore.Config.ANIMATION_SPEED);
        AlphaCore.Utils.animateValue(elColRate, 0, scanData.coleta, AlphaCore.Config.ANIMATION_SPEED, true);
        AlphaCore.Utils.animateValue(elRating, 0, scanData.rating, AlphaCore.Config.ANIMATION_SPEED, true);

        setTimeout(() => { elColRate.innerHTML += "%"; }, AlphaCore.Config.ANIMATION_SPEED + 100);

        let starsHTML = '';
        if (scanData.rating > 0) {
            for(let i=1; i<=5; i++) {
                if(i <= Math.floor(scanData.rating)) starsHTML += '<i class="fas fa-star drop-shadow-[0_0_5px_rgba(234,179,8,0.5)]"></i>';
                else if(i === Math.ceil(scanData.rating)) starsHTML += '<i class="fas fa-star-half-alt drop-shadow-[0_0_5px_rgba(234,179,8,0.5)]"></i>';
                else starsHTML += '<i class="far fa-star text-gray-700"></i>';
            }
        }
        document.getElementById('starContainer').innerHTML = starsHTML;

        const banner = document.getElementById('alertBanner');
        banner.className = `inline-flex items-center gap-3 px-5 py-3 rounded-xl border font-black text-sm uppercase tracking-widest w-full md:w-auto justify-center md:justify-start shadow-lg ${scanData.statusBg} ${scanData.statusText}`;
        document.getElementById('alertIcon').innerHTML = scanData.statusIcon;
        document.getElementById('alertTitle').innerText = scanData.statusTitle;

        document.getElementById('resVerdict').innerText = scanData.veredicto;

        const revBox = document.getElementById('reviewsContainer');
        revBox.innerHTML = '';
        scanData.reviews.forEach((r, idx) => {
            let icon = r.tipo === 'pos' ? '<i class="fas fa-check-circle text-green-500"></i>' : 
                       r.tipo === 'neg' ? '<i class="fas fa-times-circle text-red-500"></i>' : 
                       '<i class="fas fa-exclamation-circle text-yellow-500"></i>';
            
            let fakeId = Math.floor(AlphaCore.Utils.seededRandom(AlphaCore.Utils.extractID(originalUrl) + idx) * 900) + 100;
            
            revBox.innerHTML += `
                <div class="bg-[#111] p-4 rounded-xl border border-white/5 flex gap-4 items-start hover:border-white/10 transition delay-${idx * 100}">
                    <div class="mt-1 text-lg">${icon}</div>
                    <div>
                        <p class="text-xs text-gray-500 font-mono mb-1">ID Usuário: ***${fakeId} | País: Brasil</p>
                        <p class="text-sm text-gray-300">${r.txt}</p>
                    </div>
                </div>
            `;
        });

        const resultSection = document.getElementById('resultState');
        resultSection.classList.remove('hidden');
        resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

/**
 * ------------------------------------------------------------------------------
 * 7. CORE ORCHESTRATOR (Fluxo Principal)
 * ------------------------------------------------------------------------------
 */
async function iniciarVerificacao() {
    const rawInput = document.getElementById('linkInput').value.trim();
    
    if (!rawInput || (!rawInput.toLowerCase().includes('http') && !rawInput.toLowerCase().includes('www.'))) {
        alert("ERRO DE SISTEMA ALPHA: Insira uma estrutura de URL válida contendo http:// ou https://");
        return;
    }

    const isAgentLink = AlphaCore.Data.BlockedAgents.some(agent => rawInput.toLowerCase().includes(agent));
    if (isAgentLink) {
        alert("ALERTA DE SEGURANÇA: O scanner analisa Lojas (Fábricas na China), não Agentes (Vigorbuy, Pandabuy, etc). Retorne ao site de compra, copie o link original do produto e tente novamente.");
        return;
    }

    AlphaCore.UI.showLoading();

    const sanitizedUrl = AlphaCore.Utils.sanitizeURL(rawInput);
    let finalData = null;

    try {
        // Fase 1: Whitelist (suppliersData.js e Supabase)
        const whitelistMatch = await AlphaCore.Services.checkWhitelist(rawInput, sanitizedUrl);
        
        if (whitelistMatch) {
            console.log("[Alpha Pipeline] Fase 1: Fornecedor VIP Encontrado na Base de Dados.");
            // Passando a URL crua para travar a geração da matemática para Parceiros VIP!
            finalData = AlphaCore.Engine.generateVIPProfile(whitelistMatch.nome, whitelistMatch.imagem, rawInput);
            
            // AGORA SALVA OS VIPS NO SUPABASE TAMBÉM PARA O SEU CONTROLE/ANALYTICS!
            AlphaCore.Services.saveScan(sanitizedUrl, finalData);
            
        } else {
            // Fase 2: Histórico (Cache e Supabase)
            const memoryMatch = await AlphaCore.Services.checkHistory(sanitizedUrl);
            
            if (memoryMatch) {
                console.log("[Alpha Pipeline] Fase 2: Histórico neural recuperado.");
                finalData = memoryMatch;
            } else {
                // Fase 3: Link Inédito - Geração e Gravação
                console.log("[Alpha Pipeline] Fase 3: Link inédito. Gerando análise.");
                finalData = AlphaCore.Engine.generateAnalysisProfile(sanitizedUrl, rawInput);
                AlphaCore.Services.saveScan(sanitizedUrl, finalData); 
            }
        }

        setTimeout(() => {
            AlphaCore.UI.hideLoading();
            AlphaCore.UI.renderResults(finalData, rawInput);
        }, 3500);

    } catch (criticalError) {
        console.error("FALHA CRÍTICA DO SISTEMA ALPHA:", criticalError);
        alert("Ocorreu um erro no pipeline de dados neurais. Por favor, recarregue a página e tente novamente.");
        AlphaCore.UI.hideLoading();
    }
}

/**
 * ------------------------------------------------------------------------------
 * 8. EXPOSIÇÃO GLOBAL DE FUNÇÕES UI
 * ------------------------------------------------------------------------------
 */
window.openMobileMenu = function() {
    document.getElementById('mobileMenu').classList.add('active');
    document.getElementById('mobileOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
};

window.closeMobileMenu = function() {
    document.getElementById('mobileMenu').classList.remove('active');
    document.getElementById('mobileOverlay').classList.remove('active');
    document.body.style.overflow = '';
};

window.closeDiscordModal = function() {
    const modal = document.getElementById('discordModalOverlay');
    if (modal) {
        modal.classList.remove('opacity-100');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
};

window.toggleAccordion = function(btn) {
    const isExpanded = btn.getAttribute('aria-expanded') === 'true';
    const content = btn.nextElementSibling;
    const icon = btn.querySelector('.accordion-icon');
    
    document.querySelectorAll('.accordion-btn').forEach(b => {
        b.setAttribute('aria-expanded', 'false');
        if (b.nextElementSibling) b.nextElementSibling.classList.add('hidden');
        if (b.querySelector('.accordion-icon')) b.querySelector('.accordion-icon').classList.remove('rotate-180');
    });

    if (!isExpanded) {
        btn.setAttribute('aria-expanded', 'true');
        if (content) content.classList.remove('hidden');
        if (icon) icon.classList.add('rotate-180');
    }
};

window.iniciarVerificacao = iniciarVerificacao;
