const { schedulePromotion: schedulePromotionAdBySubscription, promoteAdBySubscription } = require('./promoteAdBySubscription');
const { schedulePromotion: schedulePromotionAdByEditing, promoteAdByEditing } = require('./promoteAdByEditing');
const { connectToAccount, setupGoogleVignetteRemoval } = require('./utils');
const logger = require('./logger')
require('dotenv').config();

let globalBrowser = null;
let globalPage = null;

const initBrowser = async () => {
    try {
      const { page, browser } = await connectToAccount();
      globalBrowser = browser;
      globalPage = page;
  
      if (!page || !browser) {
        logger.error('initBrowser: Puppeteer returned undefined page or browser', {
          page,
          browser
        });
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
  
      return { page: undefined, browser: undefined };
    }
  };
  

const instantPromote = async () => {
    const { page, browser } = await initBrowser();
    if (page && browser) {
        try {
            logger.info('Instant promotion... !', { status: 'success' });
            await promoteAdByEditing(page);
            await promoteAdBySubscription(page);
        } finally {
            await browser.close();
        }
    } else {
        logger.error('Failed to initialize browser for instant promotion.', { status: 'error' });
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

if (process.env.ENV === 'production') {
    scheduleAllPromotions();
} else {
    instantPromote();
}