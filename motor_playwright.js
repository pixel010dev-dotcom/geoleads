// Motor de Extração de Leads (Protótipo para o seu SaaS)
// Versão: PRO (Captura dados ricos e simula cobrança de Tokens)

const { chromium } = require('playwright');

async function extractLeads(keyword, location) {
    console.log(`\n🚀 Iniciando robô extrator... Buscando: ${keyword} em ${location}\n`);
    
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    try {
        const query = encodeURIComponent(`${keyword} em ${location}`);
        const searchUrl = `https://www.google.com/maps/search/${query}`;
        
        await page.goto(searchUrl);
        await page.waitForTimeout(5000); 
        
        console.log('✅ Página carregada! Começando a varredura profunda...');
        
        const leads = await page.evaluate(async () => {
            const results = [];
            // Pegamos todos os blocos de resultado
            const items = document.querySelectorAll('div[role="feed"] > div > div');
            
            for (const item of items) {
                try {
                    const nameElement = item.querySelector('div.fontHeadlineSmall');
                    if (!nameElement) continue;
                    const nome = nameElement.innerText;

                    const linkElement = item.querySelector('a');
                    const googleLink = linkElement ? linkElement.href : '';

                    // Extraímos o texto inteiro do card para buscar dados
                    const textContent = item.innerText;
                    
                    // Regex para pegar padrão de telefone brasileiro
                    const telefoneMatch = textContent.match(/\(?\d{2,3}\)?\s?\d{4,5}-?\d{4}/);
                    const telefone = telefoneMatch ? telefoneMatch[0] : 'Não informado';

                    // Avaliação e número de reviews
                    const ratingMatch = textContent.match(/(\d[.,]\d)\s?\(\d+\)/);
                    const avaliacao = ratingMatch ? ratingMatch[1] : 'N/A';
                    
                    results.push({
                        nome: nome,
                        telefone: telefone,
                        avaliacao: avaliacao,
                        link: googleLink
                    });
                } catch (e) {}
            }
            return results;
        });

        console.log(`\n🎉 SUCESSO! Encontramos ${leads.length} leads qualificados.\n`);
        console.table(leads); 
        
        // Lógica de Negócio (Sistema de Tokens)
        console.log(`\n💰 Custo desta operação: -${leads.length} Tokens debitados da conta do usuário.`);
        
        return leads;
        
    } catch (error) {
        console.error("❌ Erro na extração:", error);
    } finally {
        await browser.close();
    }
}

extractLeads('imobiliárias', 'Curitiba');
