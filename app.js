const { schedulePromotion: schedulePromotionAdBySubscription, promoteAdBySubscription } = require('./promoteAdBySubscription');
const { schedulePromotion: schedulePromotionAdByEditing, promoteAdByEditing } = require('./promoteAdByEditing');
const { connectToAccount, setupGoogleVignetteRemoval } = require('./utils');
const logger = require('./logger');
const dailyReportService = require('./dailyReportService');
const reportScheduler = require('./reportScheduler');
require('dotenv').config();

let globalBrowser = null;
let globalPage = null;

const initBrowser = async () => {
    try {
      dailyReportService.recordBrowserLaunch();
      const { page, browser } = await connectToAccount();
      globalBrowser = browser;
      globalPage = page;
  
      if (!page || !browser) {
        logger.error('initBrowser: Puppeteer returned undefined page or browser', {
          page,
          browser
        });
        dailyReportService.recordSessionError(new Error('Puppeteer returned undefined page or browser'));
        return { page: undefined, browser: undefined };
      }
  
      return { page, browser };
    } catch (err) {
      // Log complet pour PM2 : message + stack + toute l'erreur
      logger.error('initBrowser: Failed to initialize browser', {
        message: err.message,
        stack: err.stack,
        errorObject: err
      });
      
      dailyReportService.recordSessionError(err);
      return { page: undefined, browser: undefined };
    }
  };
  

const instantPromote = async () => {
    const startTime = Date.now();
    dailyReportService.recordExecutionStart();
    
    const { page, browser } = await initBrowser();
    if (page && browser) {
        try {
            logger.info('Instant promotion... !', { status: 'success' });
            
            let postsProcessed = 0;
            let postsPromoted = 0;
            
            // Exécuter les promotions et compter les résultats
            const editingResult = await promoteAdByEditing(page, browser);
            const subscriptionResult = await promoteAdBySubscription(page, browser);
            
            // Calculer les totaux (à adapter selon la structure de retour de vos fonctions)
            postsProcessed = (editingResult?.processed || 0) + (subscriptionResult?.processed || 0);
            postsPromoted = (editingResult?.promoted || 0) + (subscriptionResult?.promoted || 0);
            
            const duration = Date.now() - startTime;
            dailyReportService.recordExecutionSuccess(postsProcessed, postsPromoted, duration);
            
        } catch (error) {
            const duration = Date.now() - startTime;
            dailyReportService.recordExecutionFailure(error, duration);
            throw error;
        } finally {
            await browser.close();
        }
    } else {
        const duration = Date.now() - startTime;
        const error = new Error('Failed to initialize browser for instant promotion');
        logger.error(error.message, { status: 'error' });
        dailyReportService.recordExecutionFailure(error, duration);
    }
};

const scheduleAllPromotions = async () => {
    try {
      const { page, browser } = await initBrowser();
  
      if (page && browser) {
        schedulePromotionAdBySubscription(page, browser);
        schedulePromotionAdByEditing(page, browser);
        logger.info('Post promotions are currently being programmed !', { status: 'success' });
      } else {
        logger.error('Failed to initialize browser for scheduling promotions.', { status: 'error' });
      }
    } catch (err) {
      // Ici tu captures toutes les erreurs d'init, même si page/browser n'existent pas
      logger.error('Error initializing browser: ' + err.message, { status: 'error', stack: err.stack });
    }
  };

console.log('Process env IS_SCHEDULED:', process.env.IS_SCHEDULED);
console.log('ENV is ', process.env.ENV)

if (process.env.IS_SCHEDULED === 'true') {
    scheduleAllPromotions();
} else {
    instantPromote();
}