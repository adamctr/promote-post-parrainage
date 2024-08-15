const puppeteer = require('puppeteer');
const schedule = require('node-schedule');
const logger = require('./logger');  // Importer le logger configuré
const { connectToAccount } = require('./utils.js');

// Will promote ad at 8 AM, 12 AM and 16 AM (Works with subscription)

async function promoteAdBySubscription() {

  const {page, browser} = await connectToAccount();

  if (page && browser) {
    try {

      // Ensure we are on the user space page
      if (page.url().includes('/espace_parrain')) {
        } else {
        logger.error('Failed to navigate to the user space page');
        }

      // Wait for "up"  button

      try {
        await page.waitForSelector('a[href="/espace_parrain/profile/annonces/125780/remonter"]');
      } catch (error) {
        logger.error({
          type: 'promoteBySubscription',
          status: 'failed',
          reason: 'button not available',
          message: error.message,

        });
      }
  
      // Click to promote the ads 
      await page.click('a[href="/espace_parrain/profile/annonces/125780/remonter"]');
      logger.info({
        type: 'promoteBySubscription',
        status: 'success',
        message: 'The ads were successfully up using the button !'
      });
  
    } catch (error) {
      logger.error({
        type: 'promoteBySubscription',
        status: 'failed',
        error: error.message,
        message: error.message,
      });    
    } finally {
      await browser.close();
    }
  }
}

const schedulePromotion = () => {
    // Schedule for 8 AM
    schedule.scheduleJob('5 10 * * *', promoteAdBySubscription);

    // Schedule for 12 PM
    schedule.scheduleJob('5 12 * * *', promoteAdBySubscription);
  
    // Schedule for 4 PM
    schedule.scheduleJob('5 18 * * *', promoteAdBySubscription);
  };
  
module.exports = { schedulePromotion };