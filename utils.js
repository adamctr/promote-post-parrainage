require('dotenv').config();
const fs = require('fs')
const logger = require('./logger'); 
const puppeteer = require('puppeteer-extra')
const { DEFAULT_INTERCEPT_RESOLUTION_PRIORITY } = require('puppeteer')
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
// Utiliser le plugin stealth avec configuration optimisée
puppeteer.use(StealthPlugin({
  // Configuration optimisée pour éviter les timeouts
  enabledEvasions: new Set([
    'chrome.app',
    'chrome.csi', 
    'chrome.loadTimes',
    'chrome.runtime',
    'defaultArgs',
    'iframe.contentWindow',
    'media.codecs',
    'navigator.hardwareConcurrency',
    'navigator.languages',
    'navigator.permissions',
    'navigator.plugins',
    'navigator.webdriver',
    'window.outerdimensions',
    'webgl.vendor'
    // Exclure 'sourceurl' et autres qui peuvent causer des timeouts
  ])
}))

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
        headless: process.env.HEADLESS, // process.env.ENV === 'production' ? 'new' : false
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
        await page.setViewport({ width: 1280, height: 800 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36');
        await page.setJavaScriptEnabled(true);
        await page.setRequestInterception(true);

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

    // Intercept Console Logs

    page.on('console', async (msg) => {
        try {
          const args = await Promise.all(msg.args().map(arg => arg.jsonValue()));
          logger.debug({ type: 'console', level: msg.type(), args });
        } catch (err) {
          logger.error({ type: 'console', message: 'Error parsing console log', error: err });
        }
      });
      
  
      try {
          await page.goto('https://www.1parrainage.com/login', { waitUntil: 'networkidle0' });
          logger.debug('Successfully navigated to login page', { 
              url: page.url(),
              platform: process.platform,
              env: process.env.ENV 
          });
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
          
          // Vérifier l'état du formulaire avant soumission - analyser TOUS les formulaires + CSRF
          const formState = await page.evaluate(() => {
              const allForms = Array.from(document.querySelectorAll('form'));
              const submitButton = document.querySelector('input[type="submit"][value="Je me connecte"]');
              const usernameField = document.querySelector('input[name="_username"]');
              const passwordField = document.querySelector('input[name="_password"]');
              const csrfField = document.querySelector('input[name="_csrf_token"]');
              
              // Trouver le formulaire qui contient les champs de connexion
              const loginForm = allForms.find(form => 
                  form.contains(usernameField) && form.contains(passwordField)
              );
              
              return {
                  totalForms: allForms.length,
                  allFormsActions: allForms.map(f => ({ action: f.action, method: f.method })),
                  loginFormExists: !!loginForm,
                  loginFormAction: loginForm ? loginForm.action : null,
                  loginFormMethod: loginForm ? loginForm.method : null,
                  submitButtonExists: !!submitButton,
                  submitButtonDisabled: submitButton ? submitButton.disabled : null,
                  usernameValue: usernameField ? usernameField.value.length : 0,
                  passwordValue: passwordField ? passwordField.value.length : 0,
                  csrfTokenExists: !!csrfField,
                  csrfTokenValue: csrfField ? csrfField.value.substring(0, 20) + '...' : null,
                  csrfTokenLength: csrfField ? csrfField.value.length : 0
              };
          });
          
          logger.debug(`Form state before submission: ${JSON.stringify(formState, null, 2)}`);
          
          // Vérifier la validité du token CSRF avant soumission
          if (!formState.csrfTokenExists || formState.csrfTokenLength === 0) {
              logger.debug('No CSRF token found, refreshing page to get token');
              await page.reload({ waitUntil: 'networkidle0' });
              
              // Ressaisir les identifiants après actualisation
              await page.waitForSelector('input[name="_username"]');
              await page.type('input[name="_username"]', process.env.EMAIL);
              await page.type('input[name="_password"]', process.env.PASSWORD);
              
              logger.debug('Page refreshed and credentials re-entered');
          }
          
          // Vérifier que nous allons soumettre le bon formulaire
          if (formState.loginFormExists && formState.loginFormAction && 
              !formState.loginFormAction.includes('texte_results.php')) {
              // Essayer d'abord un clic normal sur le bouton
              await page.click('input[type="submit"][value="Je me connecte"]');
              logger.debug('Login button clicked');
          } else {
              // Le bouton est dans le mauvais formulaire, utiliser la méthode alternative directement
              logger.debug('Wrong form detected, using alternative submission method');
              await page.evaluate(() => {
                  const usernameField = document.querySelector('input[name="_username"]');
                  const passwordField = document.querySelector('input[name="_password"]');
                  
                  if (usernameField && passwordField) {
                      const loginForm = usernameField.closest('form');
                      if (loginForm) {
                          console.log('Submitting correct login form:', loginForm.action);
                          
                          try {
                              // Méthode 1: submit() standard
                              if (typeof loginForm.submit === 'function') {
                                  loginForm.submit();
                              } else {
                                  // Méthode 2: requestSubmit() moderne
                                  if (typeof loginForm.requestSubmit === 'function') {
                                      loginForm.requestSubmit();
                                  } else {
                                      // Méthode 3: déclencher l'événement submit
                                      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                                      loginForm.dispatchEvent(submitEvent);
                                  }
                              }
                          } catch (error) {
                              console.error('Error submitting form:', error);
                              // Méthode 4: créer et cliquer sur un bouton de soumission temporaire
                              const tempSubmit = document.createElement('input');
                              tempSubmit.type = 'submit';
                              tempSubmit.style.display = 'none';
                              loginForm.appendChild(tempSubmit);
                              tempSubmit.click();
                              loginForm.removeChild(tempSubmit);
                          }
                      }
                  }
              });
          }
          
          // Attendre un peu pour voir si quelque chose se passe
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Vérifier si le formulaire a été soumis en regardant l'URL
          const urlAfterClick = page.url();
          logger.debug(`URL after button click: ${urlAfterClick}`);
          
          // Vérifier les cookies après la tentative de connexion
          const cookies = await page.cookies();
          const sessionCookies = cookies.filter(cookie => 
              cookie.name.toLowerCase().includes('session') || 
              cookie.name.toLowerCase().includes('auth') ||
              cookie.name.toLowerCase().includes('login') ||
              cookie.name.toLowerCase().includes('token') ||
              cookie.name.includes('PHPSESSID')
          );
          logger.debug(`Session cookies after login attempt: 
Total cookies: ${cookies.length}
Session cookies: ${JSON.stringify(sessionCookies.map(c => ({ name: c.name, domain: c.domain, secure: c.secure, httpOnly: c.httpOnly })), null, 2)}`);
          
          // Si nous sommes toujours sur la même page, essayer une soumission alternative
          if (urlAfterClick.includes('/login')) {
              logger.debug('Still on login page, trying alternative form submission methods');
              
              // Méthode alternative 1: soumettre le BON formulaire avec gestion d'erreur
              await page.evaluate(() => {
                  const usernameField = document.querySelector('input[name="_username"]');
                  const passwordField = document.querySelector('input[name="_password"]');
                  
                  if (usernameField && passwordField) {
                      // Trouver le formulaire parent qui contient ces champs
                      const loginForm = usernameField.closest('form');
                      if (loginForm) {
                          console.log('Submitting correct login form:', loginForm.action);
                          
                          try {
                              // Méthode 1: submit() standard
                              if (typeof loginForm.submit === 'function') {
                                  loginForm.submit();
                              } else {
                                  // Méthode 2: requestSubmit() moderne
                                  if (typeof loginForm.requestSubmit === 'function') {
                                      loginForm.requestSubmit();
                                  } else {
                                      // Méthode 3: déclencher l'événement submit
                                      const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                                      loginForm.dispatchEvent(submitEvent);
                                  }
                              }
                          } catch (error) {
                              console.error('Error submitting form:', error);
                              // Méthode 4: créer et cliquer sur un bouton de soumission temporaire
                              const tempSubmit = document.createElement('input');
                              tempSubmit.type = 'submit';
                              tempSubmit.style.display = 'none';
                              loginForm.appendChild(tempSubmit);
                              tempSubmit.click();
                              loginForm.removeChild(tempSubmit);
                          }
                      }
                  }
              });
              
              logger.debug('Alternative form submission attempted');
              
              // Attendre un peu
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // Si toujours sur login, essayer d'appuyer sur Entrée
              if (page.url().includes('/login')) {
                  logger.debug('Still on login, trying Enter key');
                  await page.focus('input[name="_password"]');
                  await page.keyboard.press('Enter');
                  logger.debug('Enter key pressed');
              }
          }
          
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

      // Attendre la redirection après connexion et vérifier que nous ne sommes plus sur la page de login
      // Possibilité de désactiver la vérification avec SKIP_LOGIN_VERIFICATION=true
      const skipVerification = process.env.SKIP_LOGIN_VERIFICATION === 'true';
      
      if (skipVerification) {
          logger.debug('Skipping login verification (SKIP_LOGIN_VERIFICATION=true)');
      } else {
          try {
              logger.debug('Waiting for login to complete...');
          
          // Attendre un peu pour que la soumission du formulaire se lance
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          let currentUrl = page.url();
          logger.debug(`URL after initial wait: ${currentUrl}`);
          
          // Vérifier s'il y a des erreurs JavaScript sur la page
          const consoleMessages = [];
          page.on('console', msg => {
              if (msg.type() === 'error') {
                  consoleMessages.push(msg.text());
              }
          });
          
          // Vérifier les erreurs de réseau
          const networkErrors = [];
          page.on('requestfailed', request => {
              networkErrors.push(`${request.url()}: ${request.failure().errorText}`);
          });
          
          // Attendre soit une redirection, soit un changement d'URL avec timeout plus long pour Linux
          const timeoutMs = 30000; // 30 secondes pour Linux
          
          try {
              await Promise.race([
                  // Option 1: Attendre que l'URL change (plus sur /login)
                  page.waitForFunction(() => !window.location.href.includes('/login'), { timeout: timeoutMs }),
                  // Option 2: Attendre la navigation
                  page.waitForNavigation({ waitUntil: 'networkidle0', timeout: timeoutMs })
              ]);
          } catch (waitError) {
              logger.debug('Wait timeout reached, checking current state', {
                  currentUrl: page.url(),
                  waitError: waitError.message
              });
              
              // Vérifier s'il y a des erreurs sur la page
              const pageContent = await page.content();
              const hasError = pageContent.includes('error') || pageContent.includes('erreur') || pageContent.includes('invalid');
              
              logger.debug('Page analysis after timeout', {
                  currentUrl: page.url(),
                  hasError,
                  contentLength: pageContent.length,
                  title: await page.title().catch(() => 'unknown'),
                  consoleErrors: consoleMessages,
                  networkErrors: networkErrors
              });
          }
          
          const currentUrlAfterLogin = page.url();
          logger.debug(`Post-login URL check: ${currentUrlAfterLogin}`);
          
          // Vérifier si nous sommes toujours sur la page de login
          if (currentUrlAfterLogin.includes('/login')) {
              // Essayer de voir s'il y a un message d'erreur sur la page
              const errorMessage = await page.evaluate(() => {
                  const errorElements = document.querySelectorAll('.error, .alert, .message, [class*="error"], [class*="alert"], .text-danger, .invalid-feedback');
                  return Array.from(errorElements).map(el => el.textContent.trim()).filter(text => text).join(' | ');
              }).catch(() => 'Unable to check for error messages');
              
              // Vérifier spécifiquement les erreurs CSRF
              const csrfError = errorMessage.toLowerCase().includes('csrf') || 
                               errorMessage.toLowerCase().includes('token') ||
                               errorMessage.toLowerCase().includes('expired') ||
                               errorMessage.toLowerCase().includes('invalid');
              
              if (csrfError) {
                  logger.debug('CSRF token error detected, refreshing page to get new token');
                  
                  // Actualiser la page pour obtenir un nouveau token CSRF
                  await page.reload({ waitUntil: 'networkidle0' });
                  
                  // Ressaisir les identifiants
                  await page.waitForSelector('input[name="_username"]');
                  await page.evaluate(() => {
                      document.querySelector('input[name="_username"]').value = '';
                      document.querySelector('input[name="_password"]').value = '';
                  });
                  await page.type('input[name="_username"]', process.env.EMAIL);
                  await page.type('input[name="_password"]', process.env.PASSWORD);
                  
                  // Vérifier le nouveau token CSRF
                  const newCsrfInfo = await page.evaluate(() => {
                      const csrfField = document.querySelector('input[name="_csrf_token"]');
                      return {
                          exists: !!csrfField,
                          value: csrfField ? csrfField.value.substring(0, 20) + '...' : null,
                          length: csrfField ? csrfField.value.length : 0
                      };
                  });
                  
                  logger.debug(`New CSRF token after refresh: ${JSON.stringify(newCsrfInfo, null, 2)}`);
                  
                  // Essayer de soumettre à nouveau avec le nouveau token
                  const submitButton = await page.$('input[type="submit"][value="Je me connecte"]');
                  if (submitButton) {
                      await submitButton.click();
                      
                      // Attendre et vérifier le résultat
                      await new Promise(resolve => setTimeout(resolve, 3000));
                      const finalUrl = page.url();
                      
                      if (!finalUrl.includes('/login')) {
                          logger.debug('Login successful after CSRF token refresh');
                          return; // Succès après actualisation
                      }
                  }
              }
              
              throw new Error(`Login failed - still on login page: ${currentUrlAfterLogin}. Page errors: ${errorMessage}. CSRF error: ${csrfError}`);
          }
          
          logger.debug(`Login completed successfully - New URL: ${currentUrlAfterLogin}`);
          
          // Analyser l'état de la session après connexion réussie
          const postLoginCookies = await page.cookies();
          const postLoginSessionCookies = postLoginCookies.filter(cookie => 
              cookie.name.toLowerCase().includes('session') || 
              cookie.name.toLowerCase().includes('auth') ||
              cookie.name.toLowerCase().includes('login') ||
              cookie.name.toLowerCase().includes('token') ||
              cookie.name.includes('PHPSESSID')
          );
          
          logger.debug(`Session state after successful login:
URL: ${currentUrlAfterLogin}
Total cookies: ${postLoginCookies.length}
Session cookies: ${JSON.stringify(postLoginSessionCookies.map(c => ({ 
    name: c.name, 
    domain: c.domain, 
    secure: c.secure, 
    httpOnly: c.httpOnly,
    sameSite: c.sameSite,
    expires: c.expires 
})), null, 2)}`);
          
      } catch (loginVerificationError) {
          logger.error('connectToAccount: Login verification failed', {
              message: loginVerificationError.message,
              stack: loginVerificationError.stack,
              name: loginVerificationError.name,
              currentUrl: page.url(),
              platform: process.platform,
              env: process.env.ENV,
              errorObject: loginVerificationError
          });
          throw loginVerificationError;
      }
      }
  
      logger.debug({
        type: 'connection',
        status: 'success',
        message: 'Connexion réussie et vérifiée'
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
  

  // Function to validate if the user is still logged in
  async function isSessionValid(page) {
    try {
        if (!page) {
            return false;
        }
        
        const currentUrl = page.url();
        
        // If we're on the login page, session has expired
        if (currentUrl.includes('/login')) {
            logger.debug('Session validation: Currently on login page - session expired');
            return false;
        }
        
        // If we're on the user space page, session is likely valid
        if (currentUrl.includes('/espace_parrain')) {
            logger.debug('Session validation: Currently on user space - session appears valid');
            return true;
        }
        
        // Try to navigate to the user space to test session validity
        logger.debug('Session validation: Testing session by navigating to user space');
        
        try {
            await page.goto('https://www.1parrainage.com/espace_parrain/', { 
                waitUntil: 'networkidle0',
                timeout: 10000
            });
            
            const testUrl = page.url();
            const isValid = !testUrl.includes('/login');
            
            logger.debug(`Session validation result: ${isValid ? 'VALID' : 'EXPIRED'}`, {
                testUrl,
                redirectedToLogin: testUrl.includes('/login')
            });
            
            return isValid;
        } catch (error) {
            logger.debug('Session validation: Navigation test failed', { error: error.message });
            return false;
        }
    } catch (error) {
        logger.error('Session validation: Error during validation', { 
            error: error.message,
            stack: error.stack 
        });
        return false;
    }
}

// Function to ensure session is valid, reconnect if needed
async function ensureValidSession(page, browser) {
    try {
        const isValid = await isSessionValid(page);
        
        if (isValid) {
            logger.debug('Session is valid, continuing with current session');
            return { page, browser };
        }
        
        logger.info('Session expired, attempting to reconnect...');
        
        // Close current browser if it exists
        if (browser) {
            try {
                await browser.close();
                logger.debug('Closed expired browser session');
            } catch (closeError) {
                logger.debug('Error closing expired browser', { error: closeError.message });
            }
        }
        
        // Reconnect to account
        const { page: newPage, browser: newBrowser } = await connectToAccount();
        
        if (newPage && newBrowser) {
            logger.info('Successfully reconnected to account with new session');
            return { page: newPage, browser: newBrowser };
        } else {
            throw new Error('Failed to establish new session');
        }
        
    } catch (error) {
        logger.error('Failed to ensure valid session', {
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

  async function goToParrainagePostsSpace(page) {
    try {
        if (!page) {
            throw new Error('Page object is null or undefined');
        }

        logger.debug('Starting navigation to parrainage posts space');
        
        // Vérifier d'abord si nous sommes toujours connectés en regardant l'URL actuelle
        const initialUrl = page.url();
        logger.debug(`Current URL before navigation: ${initialUrl}`);
        
        // Attendre un peu après la connexion pour s'assurer que la session est établie
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Analyser l'état des cookies avant la navigation
        const preNavCookies = await page.cookies();
        const preNavSessionCookies = preNavCookies.filter(cookie => 
            cookie.name.toLowerCase().includes('session') || 
            cookie.name.toLowerCase().includes('auth') ||
            cookie.name.toLowerCase().includes('login') ||
            cookie.name.toLowerCase().includes('token') ||
            cookie.name.includes('PHPSESSID')
        );
        
        logger.debug(`Session state before navigation to parrainage space:
Current URL: ${page.url()}
Total cookies: ${preNavCookies.length}
Session cookies: ${JSON.stringify(preNavSessionCookies.map(c => ({ 
    name: c.name, 
    domain: c.domain, 
    secure: c.secure, 
    httpOnly: c.httpOnly,
    sameSite: c.sameSite,
    expires: c.expires,
    value: c.value ? c.value.substring(0, 20) + '...' : null
})), null, 2)}`);
        
        // Enhanced HTTP response monitoring for session expiration detection
        const responses = [];
        const sessionExpiredHandler = (response) => {
            if (response.url().includes('1parrainage.com')) {
                const responseData = {
                    url: response.url(),
                    status: response.status(),
                    statusText: response.statusText(),
                    headers: response.headers()
                };
                responses.push(responseData);
                
                // Detect 302 redirects to login page (session expiration indicator)
                if (response.status() === 302) {
                    const location = response.headers()['location'];
                    if (location && location.includes('/login')) {
                        logger.warn('Session expiration detected: 302 redirect to login page', {
                            originalUrl: response.url(),
                            redirectLocation: location,
                            status: response.status()
                        });
                    }
                }
                
                // Detect when we land on login page unexpectedly
                if (response.url().includes('/login') && response.status() === 200) {
                    logger.warn('Unexpected navigation to login page detected', {
                        url: response.url(),
                        status: response.status(),
                        previousUrl: page.url()
                    });
                }
            }
        };
        
        // Add the session monitoring handler
        page.on('response', sessionExpiredHandler);
        
        try {
            await page.goto('https://www.1parrainage.com/espace_parrain/parrainages/', { 
                waitUntil: 'networkidle0',
                timeout: 30000
            });
            logger.debug(`Navigation completed successfully - HTTP responses: ${JSON.stringify(responses.map(r => ({ url: r.url, status: r.status, statusText: r.statusText })), null, 2)}`);
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
        logger.debug(`URL after navigation attempt: ${currentUrl}`);
        
        if (currentUrl && currentUrl.includes('/espace_parrain/parrainages')) {
            logger.debug({
                status:'success',
                message: 'Successfully navigated to parrainage posts page',
                currentUrl: currentUrl
            });
        } else if (currentUrl.includes('/login')) {
            // Si nous sommes redirigés vers login, la session a expiré
            logger.debug('Redirected to login - session may have expired, trying alternative approach');
            
            // Essayer d'abord de naviguer vers l'espace parrain général
            try {
                await page.goto('https://www.1parrainage.com/espace_parrain/', { 
                    waitUntil: 'networkidle0',
                    timeout: 15000
                });
                
                const intermediateUrl = page.url();
                logger.debug(`Intermediate navigation result: ${intermediateUrl}`);
                
                if (!intermediateUrl.includes('/login')) {
                    // Si nous sommes dans l'espace parrain, essayer de naviguer vers parrainages
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    await page.goto('https://www.1parrainage.com/espace_parrain/parrainages/', { 
                        waitUntil: 'networkidle0',
                        timeout: 15000
                    });
                    
                    const finalUrl = page.url();
                    logger.debug(`Final navigation result: ${finalUrl}`);
                    
                    if (finalUrl.includes('/espace_parrain/parrainages')) {
                        logger.debug('Successfully navigated via alternative route');
                        return; // Succès via route alternative
                    }
                }
            } catch (alternativeError) {
                logger.debug('Alternative navigation failed', { 
                    error: alternativeError.message 
                });
            }
            
            // Si tout échoue, lever l'erreur
            const urlError = new Error(`Failed to navigate to the user post page. Redirected to login page: ${currentUrl}`);
            logger.error('goToParrainagePostsSpace: Session expired or login required', {
                message: urlError.message,
                expectedPattern: '/espace_parrain/parrainages',
                actualUrl: currentUrl,
                targetUrl: 'https://www.1parrainage.com/espace_parrain/parrainages/',
                errorObject: urlError
            });
            throw urlError;
        } else {
            // Autre erreur inattendue
            const urlError = new Error(`Failed to navigate to the user post page. Unexpected URL: ${currentUrl}`);
            logger.error('goToParrainagePostsSpace: Unexpected navigation result', {
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

module.exports = { goToParrainagePostsSpace, connectToAccount, setupGoogleVignetteRemoval, isSessionValid, ensureValidSession };
