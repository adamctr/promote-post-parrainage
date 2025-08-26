require('dotenv').config();
const fs = require('fs')
const logger = require('./logger'); 
const puppeteer = require('puppeteer-extra')
const { DEFAULT_INTERCEPT_RESOLUTION_PRIORITY } = require('puppeteer')
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker')
puppeteer.use(
  AdblockerPlugin({
    // Optionally enable Cooperative Mode for several request interceptors
    interceptResolutionPriority: DEFAULT_INTERCEPT_RESOLUTION_PRIORITY
  })
)
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
        logger.error('setupGoogleVignetteRemoval: Failed to setup Google Vignette protection', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            errorObject: error
        });
    }
}

async function connectToAccount() {
    let browser = null;
    let page = null;
  
    try {
    const launchOptions = {
        headless: process.env.ENV === 'production' ? 'new' : false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-dev-shm-usage'
        ]
    };
        
    // Ajouter executablePath uniquement en production
    if (process.env.ENV === 'production') {
        console.log('production mode, setting executablePath to /snap/bin/chromium');
    launchOptions.executablePath = '/snap/bin/chromium';
    }
        
    try {
        browser = await puppeteer.launch(launchOptions);
        logger.debug('Browser launched successfully');
    } catch (launchError) {
        logger.error('connectToAccount: Failed to launch browser', {
            message: launchError.message,
            stack: launchError.stack,
            name: launchError.name,
            launchOptions: launchOptions,
            errorObject: launchError
        });
        throw launchError;
    }

    try {
        page = await browser.newPage();
        logger.debug('New page created successfully');
    } catch (pageError) {
        logger.error('connectToAccount: Failed to create new page', {
            message: pageError.message,
            stack: pageError.stack,
            name: pageError.name,
            errorObject: pageError
        });
        throw pageError;
    }
  
      // Ajouter la protection contre #google_vignette
      try {
          await setupGoogleVignetteRemoval(page);
          logger.debug('Google Vignette protection setup completed');
      } catch (vignetteError) {
          logger.error('connectToAccount: Failed to setup Google Vignette protection', {
              message: vignetteError.message,
              stack: vignetteError.stack,
              name: vignetteError.name,
              errorObject: vignetteError
          });
          // Continue même si la protection anti-vignette échoue
      }
  
      try {
          await page.goto('https://www.1parrainage.com/login', { waitUntil: 'networkidle0' });
          logger.debug('Successfully navigated to login page');
      } catch (navigationError) {
          logger.error('connectToAccount: Failed to navigate to login page', {
              message: navigationError.message,
              stack: navigationError.stack,
              name: navigationError.name,
              targetUrl: 'https://www.1parrainage.com/login',
              currentUrl: page.url(),
              errorObject: navigationError
          });
          throw navigationError;
      }
  
      logger.debug({
        type: 'connection',
        status: 'success',
        message: 'Page de login chargée avec succès'
      });
  
      // Gestion des cookies
      try {
        await page.waitForFunction(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          return buttons.some(button => button.textContent.includes('Tout accepter'));
        }, { timeout: 5000 }).catch(() => {});
  
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const acceptButton = buttons.find(button => button.textContent.includes('Tout accepter'));
          if (acceptButton) acceptButton.click();
        });
  
        await new Promise(resolve => setTimeout(resolve, 1000)); // Attendre que la modal disparaisse
      } catch (error) {
        logger.error('connectToAccount: Failed to handle cookies banner', {
          message: error.message,
          stack: error.stack,
          name: error.name,
          errorObject: error
        });
      }
  
      // Saisie des identifiants
      try {
          await page.waitForSelector('input[name="_username"]');
          logger.debug('Username input field found');
          
          await page.type('input[name="_username"]', process.env.EMAIL);
          logger.debug('Email typed successfully');
          
          await page.type('input[name="_password"]', process.env.PASSWORD);
          logger.debug('Password typed successfully');
      } catch (inputError) {
          logger.error('connectToAccount: Failed to fill login credentials', {
              message: inputError.message,
              stack: inputError.stack,
              name: inputError.name,
              currentUrl: page.url(),
              emailProvided: !!process.env.EMAIL,
              passwordProvided: !!process.env.PASSWORD,
              errorObject: inputError
          });
          throw inputError;
      }
  
      try {
          await page.waitForSelector('input[type="submit"][value="Je me connecte"]', { visible: true });
          logger.debug('Login button found');
          
          await page.click('input[type="submit"][value="Je me connecte"]');
          logger.debug('Login button clicked');
      } catch (submitError) {
          logger.error('connectToAccount: Failed to click login button', {
              message: submitError.message,
              stack: submitError.stack,
              name: submitError.name,
              currentUrl: page.url(),
              errorObject: submitError
          });
          throw submitError;
      }
  
      logger.debug({
        type: 'connection',
        status: 'success',
        message: 'Connexion réussie'
      });
  
      return { page, browser };
  
    } catch (error) {
      // Log complet de l'erreur
      logger.error('connectToAccount: Failed to initialize browser or login', {
        message: error.message,
        stack: error.stack,
        errorObject: error
      });
  
      // Fermer le navigateur si il a été lancé
      if (browser) {
        try { 
            await browser.close(); 
            logger.debug('Browser closed during error cleanup');
        } catch (closeError) {
            logger.error('connectToAccount: Failed to close browser during cleanup', {
                message: closeError.message,
                stack: closeError.stack,
                name: closeError.name,
                errorObject: closeError
            });
        }
      }
  
      return { page: null, browser: null };
    }
  }
  

  async function goToParrainagePostsSpace(page) {
    try {
        if (!page) {
            throw new Error('Page object is null or undefined');
        }

        logger.debug('Starting navigation to parrainage posts space');
        
        try {
            await page.goto('https://www.1parrainage.com/espace_parrain/parrainages/', { 
                waitUntil: 'networkidle0',
                timeout: 30000
            });
            logger.debug('Navigation completed successfully');
        } catch (navigationError) {
            logger.error('goToParrainagePostsSpace: Failed to navigate to URL', {
                message: navigationError.message,
                stack: navigationError.stack,
                name: navigationError.name,
                targetUrl: 'https://www.1parrainage.com/espace_parrain/parrainages/',
                currentUrl: page.url(),
                errorObject: navigationError
            });
            throw navigationError;
        }

        const currentUrl = page.url();
        if (currentUrl && currentUrl.includes('/espace_parrain/parrainages')) {
            logger.debug({
                status:'success',
                message: 'Successfully navigated to parrainage posts page',
                currentUrl: currentUrl
            });
        } else {
            // Lève une erreur pour que le catch la capture
            const urlError = new Error(`Failed to navigate to the user post page. Expected URL pattern '/espace_parrain/parrainages' but got '${currentUrl}'`);
            logger.error('goToParrainagePostsSpace: URL validation failed', {
                message: urlError.message,
                expectedPattern: '/espace_parrain/parrainages',
                actualUrl: currentUrl,
                targetUrl: 'https://www.1parrainage.com/espace_parrain/parrainages/',
                errorObject: urlError
            });
            throw urlError;
        }
    } catch (error) {
        logger.error('goToParrainagePostsSpace: Failed to navigate to parrainage posts space', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            currentUrl: page ? page.url() : 'unknown',
            targetUrl: 'https://www.1parrainage.com/espace_parrain/parrainages/',
            errorObject: error
        });
        throw error; // Re-throw pour que l'appelant puisse gérer l'erreur
    }
}

module.exports = { goToParrainagePostsSpace, connectToAccount, setupGoogleVignetteRemoval };
