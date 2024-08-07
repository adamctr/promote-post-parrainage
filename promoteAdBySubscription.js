const puppeteer = require('puppeteer');
const schedule = require('node-schedule');

const { connectToAccount } = require('./utils.js');

// Will promote ad at 8 AM, 12 AM and 16 AM (Works with subscription)

async function promoteAdBySubscription() {

  const page = await connectToAccount();

  if (page) {
    try {
      await page.waitForSelector('a[href="/espace_parrain/profile/annonces/125780/remonter"]');

      // Ensure we are on the user space page
      if (page.url().includes('/espace_parrain')) {
      console.log('Confirmed we are on the user space page');
      } else {
      throw new Error('Failed to navigate to the user space page');
      }
  
      // Click to promote the ad 
      await page.click('a[href="/espace_parrain/profile/annonces/125780/remonter"]');
      console.log(`Tous les posts ont été promus grâce à l'abonnement avec succès à ${new Date().toLocaleString()}.`);
  
    } catch (error) {
      console.error('Une erreur est survenue:', error), 'à', new Date().toLocaleString();
    } finally {
      await browser.close();
    }
  }
}

promoteAdBySubscription();

const schedulePromotion = () => {
    // Schedule for 8 AM
    schedule.scheduleJob('5 10 * * *', promoteAd);

    // Schedule for 12 PM
    schedule.scheduleJob('5 12 * * *', promoteAd);
  
    // Schedule for 4 PM
    schedule.scheduleJob('5 18 * * *', promoteAd);
  };

module.exports = { schedulePromotion };