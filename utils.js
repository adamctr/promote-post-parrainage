require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs')
const logger = require('./logger'); 

/**
 * Ferme automatiquement la pop-up Google Vignette
 * @param {Page} page - L'instance de page Puppeteer
 */
async function setupGoogleVignetteRemoval(page) {
    if (!page) return;
    
    try {
        // Injecter un script qui détectera et fermera la popup Google Vignette
        await page.evaluateOnNewDocument(() => {
            // Observer les changements dans le DOM
            const observer = new MutationObserver(() => {
                // Vérifier si l'URL contient #google_vignette
                if (window.location.hash === '#google_vignette') {
                    // Rechercher le bouton de fermeture
                    const dismissButton = document.querySelector('#dismiss-button');
                    if (dismissButton) {
                        console.log('[Utils] Bouton de fermeture Google Vignette trouvé, clic en cours...');
                        dismissButton.click();
                        console.log('[Utils] Clic sur le bouton de fermeture effectué');
                        
                        // Nettoyer l'URL
                        if (window.location.hash === '#google_vignette') {
                            history.replaceState(null, '', window.location.pathname + window.location.search);
                            console.log('[Utils] Fragment #google_vignette supprimé de l\'URL');
                        }
                    } else {
                        console.log('[Utils] Bouton de fermeture non trouvé, nouvelle tentative dans 500ms');
                        // Réessayer après un court délai car le bouton peut ne pas être immédiatement disponible
                        setTimeout(() => {
                            const retryDismissButton = document.querySelector('#dismiss-button');
                            if (retryDismissButton) {
                                retryDismissButton.click();
                                console.log('[Utils] Clic sur le bouton de fermeture effectué (2ème tentative)');
                                
                                // Nettoyer l'URL
                                if (window.location.hash === '#google_vignette') {
                                    history.replaceState(null, '', window.location.pathname + window.location.search);
                                    console.log('[Utils] Fragment #google_vignette supprimé de l\'URL (2ème tentative)');
                                }
                            }
                        }, 500);
                    }
                }
            });
            
            // Observer tous les changements dans le DOM
            observer.observe(document, { childList: true, subtree: true });
            
            // Vérifier si la popup est déjà présente lors du chargement initial
            if (window.location.hash === '#google_vignette') {
                console.log('[Utils] Fragment #google_vignette détecté dans l\'URL initiale');
                setTimeout(() => {
                    const dismissButton = document.querySelector('#dismiss-button');
                    if (dismissButton) {
                        dismissButton.click();
                        console.log('[Utils] Clic sur le bouton de fermeture effectué (chargement initial)');
                        
                        // Nettoyer l'URL
                        history.replaceState(null, '', window.location.pathname + window.location.search);
                        console.log('[Utils] Fragment #google_vignette supprimé de l\'URL initiale');
                    }
                }, 1000);
            }
        });
        
        logger.debug({
            type: 'navigation',
            status: 'success',
            message: 'Protection contre Google Vignette activée'
        });
    } catch (error) {
        logger.error({
            type: 'navigation',
            status: 'error',
            message: `Erreur lors de la configuration anti-vignette: ${error.message}`
        });
    }
}

async function connectToAccount() {
    let browser = null; 
    let page = null; 
   
    try {
        browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: process.env.ENVIRONMENT === 'production' });
        page = await browser.newPage();
    
        // Ajouter la protection contre #google_vignette
        await setupGoogleVignetteRemoval(page);
        
        await page.goto('https://www.1parrainage.com/login', { waitUntil: 'networkidle0' });

        logger.debug({
            type: 'connection',
            status: 'success',
            message: 'Page de login chargée avec succès'
        });

        try {
            // Gestion des cookies en utilisant le texte du bouton plutôt que des classes
            await page.waitForFunction(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                return buttons.some(button => button.textContent.includes('Tout accepter'));
            }, { timeout: 5000 }).catch(() => {});
            
            await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const acceptButton = buttons.find(button => button.textContent.includes('Tout accepter'));
                if (acceptButton) acceptButton.click();
            });
            
            await page.waitForTimeout(1000); // Attendre que la modal disparaisse
        } catch (error) {
            logger.debug({
                type: 'cookies',
                status: 'info',
                message: 'Pas de bannière de cookies ou erreur: ' + error.message
            });
        }

        // Saisie des identifiants
        await page.waitForSelector('input[name="_username"]');
        await page.type('input[name="_username"]', process.env.EMAIL);
        await page.type('input[name="_password"]', process.env.PASSWORD);

        // Attendre que le bouton de connexion soit visible et cliquable
        await page.waitForSelector('input[type="submit"][value="Je me connecte"]', { visible: true });
        await page.click('input[type="submit"][value="Je me connecte"]');

        
        logger.debug({
            type: 'connection',
            status: 'success',
            message: 'Connexion réussie'
        });

        return { page, browser };

    } catch (error) {
        logger.error({
            type: 'connection',
            status: 'error',
            error: error.message,
            message: `Erreur lors de la connexion: ${error.message}`,
        });
        return { page: null, browser: null };
    } finally {
        // Fermer le navigateur uniquement en cas d'erreur de connexion
        if (page && page.url() && !page.url().includes('/espace_parrain')) {
            await browser.close();
            return { page: null, browser: null };
        }
    }
}

async function goToParrainagePostsSpace(page) {
    try {
        await page.goto('https://www.1parrainage.com/espace_parrain/parrainages/');
 
        if (page.url() && page.url().includes('/espace_parrain/parrainages')) {
            logger.debug({
                status:'success',
                message: 'Navigated to user post page',
              })
        } else {
            logger.error({
                status:'error',
                message: 'Failed to navigate to the user post page',
              })
        }
    } catch (error) {
        logger.error({
            status:'error',
            reason: 'Error in goToParrainagePostsSpace',
            error: error.message,
            message: error.message,
          })
    }
}

module.exports = { goToParrainagePostsSpace, connectToAccount, setupGoogleVignetteRemoval };