// Arquivo: navegacao.js
// Este arquivo gerencia automaticamente o destaque azul (efeito neon) da aba ativa em todas as páginas.

document.addEventListener("DOMContentLoaded", function() {
    document.body.classList.add("alpha-page-ready");
    // 1. Descobre em qual página o usuário está no momento
    let currentPage = window.location.pathname.split("/").pop();

    // Se estiver na raiz do site (ex: github.io/teste/), entende que é o index
    if (currentPage === "" || currentPage === undefined) {
        currentPage = "index.html";
    }

    // 2. Seleciona todos os links do menu que têm a classe 'nav-link'
    const navLinks = document.querySelectorAll(".nav-link");

    // 3. Define as classes visuais (Ativo com Neon vs Inativo Cinza)
    const classeAtiva = "nav-link px-6 py-2.5 rounded-xl text-[11px] font-black uppercase bg-[#00a2ff]/10 text-[#00a2ff] border border-[#00a2ff]/30 shadow-[0_0_15px_rgba(0,162,255,0.15)] transition";
    const classeInativa = "nav-link px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition";

    navLinks.forEach(link => {
        const pageTarget = link.getAttribute("data-page");

        // Por padrão, garante que todos comecem inativos (cinza)
        link.className = classeInativa;

        // Se o data-page do botão for igual à URL atual, acende o botão (Azul Neon)
        if (currentPage === pageTarget) {
            link.className = classeAtiva;
        } 
        // Regra especial: Se clicar na FAQ, acende a aba FAQ e apaga a aba Fornecedores
        else if (window.location.hash === "#faq-alfandega" && pageTarget === "faq") {
            link.className = classeAtiva;
            
            const fornecedoresBtn = document.querySelector('[data-page="fornecedores.html"]');
            if (fornecedoresBtn) {
                fornecedoresBtn.className = classeInativa;
            }
        }
    });
});

(function() {
    const TRANSITION_DELAY = 220;
    let isLeaving = false;

    function normalizePath(pathname) {
        const last = pathname.split("/").pop();
        return last || "index.html";
    }

    function isInternalPage(url) {
        if (url.origin !== window.location.origin) return false;

        const allowedPages = new Set([
            "index.html",
            "index",
            "planilha.html",
            "planilha",
            "fornecedores.html",
            "fornecedores",
            "fretes.html",
            "fretes",
            "ferramentas1.html",
            "ferramentas1",
            "ferramentas",
            "anti-golpe.html",
            "anti-golpe"
        ]);

        return allowedPages.has(normalizePath(url.pathname));
    }

    function sameLocation(url) {
        return url.pathname === window.location.pathname &&
            url.search === window.location.search &&
            url.hash === window.location.hash;
    }

    function sameDocument(url) {
        return url.pathname === window.location.pathname &&
            url.search === window.location.search;
    }

    function goWithTransition(href) {
        if (isLeaving) return;

        const url = new URL(href, window.location.href);
        if (!isInternalPage(url) || sameLocation(url) || sameDocument(url)) return;

        isLeaving = true;
        document.body.classList.add("alpha-page-leaving");

        window.setTimeout(function() {
            window.location.href = url.href;
        }, TRANSITION_DELAY);
    }

    function getInlineNavigationTarget(element) {
        const inlineHandler = element.getAttribute("onclick") || "";
        const match = inlineHandler.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/);
        return match ? match[1] : null;
    }

    document.addEventListener("click", function(event) {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }

        const anchor = event.target.closest("a[href]");
        if (anchor) {
            const href = anchor.getAttribute("href");
            if (!href || href.startsWith("#") || anchor.target === "_blank" || anchor.hasAttribute("download")) {
                return;
            }

            const url = new URL(href, window.location.href);
            if (isInternalPage(url) && !sameLocation(url) && !sameDocument(url)) {
                event.preventDefault();
                goWithTransition(url.href);
            }
            return;
        }

        const button = event.target.closest("button[onclick]");
        if (!button) return;

        const target = getInlineNavigationTarget(button);
        if (!target) return;

        const url = new URL(target, window.location.href);
        if (isInternalPage(url) && !sameLocation(url) && !sameDocument(url)) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            goWithTransition(url.href);
        }
    }, true);

    window.addEventListener("pageshow", function() {
        isLeaving = false;
        document.body.classList.remove("alpha-page-leaving");
        document.body.classList.add("alpha-page-ready");
    });
})();
