const puppeteer = require('puppeteer');
const schedule = require('node-schedule');

require('dotenv').config();

// Will promote ad at 8 AM, 12 AM and 16 AM (Works with subscription)

async function promoteAd() {
  const browser = await puppeteer.launch({ headless: false }); // Mettez headless: true pour exécution en arrière-plan
  const page = await browser.newPage();
  
  try {
    // Set screen size.
    await page.setViewport({width: 1080, height: 1024});

    // Naviguer vers le site
    await page.goto('https://www.1parrainage.com/login', {
        waitUntil: 'networkidle0' // Attend que le réseau soit inactif
    });

    console.log('Page chargée ave succès')

    // Accept cookies 

    // Accept cookies (adjust the selector if necessary)
    try {
        await page.click('span.sd-cmp-2jmDj.sd-cmp-TOv77', { timeout: 5000 });
        console.log('Cookies accepted');
      } catch (error) {
        console.log('Cookies banner not found or already accepted');
      }

    // Se connecter (à adapter selon le site)
    await page.type('#_username', process.env.EMAIL);
    await page.type('#_password', process.env.PASSWORD);
    await page.click('input.btn.btn-custom[value="Me connecter"]');

    // L'utilisateur se trouve dans son espace parrain https://www.1parrainage.com/espace_parrain/

    // Wait for navigation to the user space page
    await page.waitForSelector('a[href="/espace_parrain/profile/annonces/125780/remonter"]');
    console.log('Login successful, user space page loaded');

    // Ensure we are on the user space page
    if (page.url().includes('/espace_parrain')) {
    console.log('Confirmed we are on the user space page');
    } else {
    throw new Error('Failed to navigate to the user space page');
    }

    // Click to promote the ad (adjust the selector if necessary)
    await page.click('a[href="/espace_parrain/profile/annonces/125780/remonter"]');
    console.log(`Post promu grâce à l'abonnement avec succès à ${new Date().toLocaleString()}.`);


    // Attendre une interaction de l'utilisateur pour fermer le navigateur
    console.log('Appuyez sur une touche pour fermer le navigateur...');
    await new Promise(resolve => process.stdin.once('data', resolve));

  } catch (error) {
    console.error('Une erreur est survenue:', error);
  } finally {
    await browser.close();
  }
}

const schedulePromotion = () => {
    // Schedule for 8 AM
    schedule.scheduleJob('0 8 * * *', promoteAd);

    // Schedule for 12 PM
    schedule.scheduleJob('0 12 * * *', promoteAd);
  
    // Schedule for 4 PM
    schedule.scheduleJob('0 16 * * *', promoteAd);
  };

schedulePromotion();

module.exports = { schedulePromotion };