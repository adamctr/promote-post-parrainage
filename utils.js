require('dotenv').config();
const puppeteer = require('puppeteer');

async function connectToAccount() {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], headless:false, });
    const page = await browser.newPage();

    try {
        await page.setViewport({ width: 1080, height: 1024 });
        await page.goto('https://www.1parrainage.com/login',{ waitUntil: 'networkidle0' });

        console.log('Page loaded successfully');

        try {
          // Attendre la présence du bouton "Tout accepter"
          await page.waitForSelector('span.sd-cmp-2jmDj.sd-cmp-TOv77');
          await page.click('span.sd-cmp-2jmDj.sd-cmp-TOv77', { timeout: 5000 });
      } catch (error) {
          console.log('Error handling cookies banner:', error);
      }

        await page.type('#_username', process.env.EMAIL);
        await page.type('#_password', process.env.PASSWORD);
        await page.click('input.btn.btn-custom[value="Me connecter"]');
        // await page.waitForNavigation({ waitUntil: 'networkidle0' });

        if (page.url().includes('/espace_parrain')) {
            console.log('Login successful');
            return page;
        } else {
            throw new Error('Failed to log in');
        }
    } catch (error) {
        console.error(`Error in connectToAccount: ${error}`);
        await browser.close();
        return null;
    }
}

async function goToParrainagePostsSpace(page) {
    try {
        await page.waitForSelector('a[href="/espace_parrain/parrainages/"]');
        await page.click('a[href="/espace_parrain/parrainages/"]');
 
        if (page.url().includes('/espace_parrain/parrainages')) {
            console.log('Navigated to user post page');
        } else {
            throw new Error('Failed to navigate to the user post page');
        }
    } catch (error) {
        console.error(`Error in goToParrainagePostsSpace: ${error}`);
        throw error;
    }
}

module.exports = { goToParrainagePostsSpace, connectToAccount  };