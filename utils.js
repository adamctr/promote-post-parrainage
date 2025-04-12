require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs')
const logger = require('./logger'); 


async function connectToAccount() {
    let browser = null; 
    let page = null; 
   
    try {
        browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: process.env.ENVIRONMENT === 'production' });
        page = await browser.newPage();
    
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

        // Attendre la redirection vers l'espace parrain
        await page.waitForSelector('a[href="/espace_parrain/parrainages/"]', { timeout: 30000 });
        
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

module.exports = { goToParrainagePostsSpace, connectToAccount };