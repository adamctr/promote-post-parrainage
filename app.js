const { schedulePromotion: schedulePromotionAdBySubscription, promoteAdBySubscription } = require('./promoteAdBySubscription');
const { schedulePromotion: schedulePromotionAdByEditing, promoteAdByEditing } = require('./promoteAdByEditing');
const { connectToAccount, setupGoogleVignetteRemoval } = require('./utils');
const logger = require('./logger')
require('dotenv').config();

let globalBrowser = null;
let globalPage = null;

const initBrowser = async () => {
    const { page, browser } = await connectToAccount();
    globalBrowser = browser;
    globalPage = page;
    return { page, browser };
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
    }
};

const scheduleAllPromotions = async () => {
    const { page, browser } = await initBrowser();
    if (page && browser) {
        schedulePromotionAdBySubscription(page, browser);
        schedulePromotionAdByEditing(page, browser);
        logger.info('Post promotions are currently being programmed !', { status: 'success' });
    }
};

if (process.env.ENV === 'production') {
    scheduleAllPromotions();
} else {
    instantPromote();
}