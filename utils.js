require('dotenv').config();
const puppeteer = require('puppeteer');
const fs = require('fs')
const logger = require('./logger'); 


async function connectToAccount() {
    let browser = null; 
    let page = null; 
   
    try {
        browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], headless:true, });
        page = await browser.newPage();
    
        // await page.setViewport({ width: 400, height: 400 });
        await page.goto('https://www.1parrainage.com/login',{ waitUntil: 'networkidle0' });

        logger.debug({
            status:'success',
            message: 'Page loaded successfully',
        })

        try {
          // Wait for the "Accept all" cookies button and click
          await page.waitForSelector('span.sd-cmp-2jmDj.sd-cmp-TOv77');
          await page.click('span.sd-cmp-2jmDj.sd-cmp-TOv77', { timeout: 5000 });
      } catch (error) {
          logger.error({
            type:'connection',
            status:'error',
            reason: 'Error handling cookies banner',
            message: error.message,
          })
      }

        // Inputs of connections entered
        await page.type('#_username', process.env.EMAIL);
        await page.type('#_password', process.env.PASSWORD);
        await page.click('input.btn.btn-custom[value="Me connecter"]');
        await page.waitForSelector('a[href="/espace_parrain/parrainages/"]');
        
        return { page, browser };

    } catch (error) {
        logger.error({
            type: 'connection',
            status: 'error',
            error: error.message,
            message: error.message,
        });
        return { page : null, browser : null};
    } finally {
        // Close the browser only if an error occurred
        if (page.url() && page.url().includes('/espace_parrain') === false) {
            await browser.close();
            return { page : null, browser : null};

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