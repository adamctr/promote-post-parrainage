const puppeteer = require('puppeteer');
const schedule = require('node-schedule');

require('dotenv').config();

// Will promote ad at 10 AM and 18 AM by editing a post.

async function promoteAdByEditing() {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox']}); // Mettez headless: true pour exécution en arrière-plan
  const page = await browser.newPage();
  
  try {
    // Set screen size.
    await page.setViewport({width: 1080, height: 1024});

    // Naviguer vers le site
    await page.goto('https://www.1parrainage.com/login', {
        waitUntil: 'networkidle0' // Attend que le réseau soit inactif
    });

    console.log('Page chargée avec succès')

    // Accept cookies 

    try {
        await page.click('span.sd-cmp-2jmDj.sd-cmp-TOv77', { timeout: 5000 });
        console.log('Cookies accepted');
      } catch (error) {
        console.log('Cookies banner not found or already accepted');
      }

    // Se connecter (à adapter selon le site)
      console.log(process.env.EMAIL);

    await page.type('#_username', process.env.EMAIL);
    await page.type('#_password', process.env.PASSWORD);
    await page.click('input.btn.btn-custom[value="Me connecter"]');

    // L'utilisateur se trouve dans son espace parrain https://www.1parrainage.com/espace_parrain/

    // Wait for navigation to the user space page
    await page.waitForSelector('a[href="/espace_parrain/parrainages/');
    console.log('Login successful, user space page loaded');

    // Ensure we are on the user space page
    if (page.url().includes('/espace_parrain')) {
    console.log('Confirmed we are on the user space page');
    } else {
    throw new Error('Failed to navigate to the user space page');
    }

    // Go to post page

    await page.click('a[href="/espace_parrain/parrainages/"]');

    // Ensure we are on the post page

    if (page.url().includes('/espace_parrain/parrainages')) {
    console.log('Confirmed we are on the user post page');
    } else {
    throw new Error('Failed to navigate to the user post page');
    }

    // Edit the post

    await page.waitForSelector('a.parrainage_bt.edit');

    // Get all elements with class .parrainage_bt.edit
    const posts = await page.$$('a.parrainage_bt.edit');
    console.log(`Found ${posts.length} elements to interact with.`);
    
    // Modifier chaque post
    // for (const post of posts) {
        await posts[0].click();

        await page.waitForSelector('iframe.cke_wysiwyg_frame');

        const iframeSelector = 'iframe.cke_wysiwyg_frame';
        const iframeElementHandle = await page.$(iframeSelector);

        const iframe = await iframeElementHandle.contentFrame();

        // Assurez-vous que le contenu est prêt avant d'écrire dans l'iframe
        await iframe.waitForSelector('body.cke_editable');
        await iframe.focus('body.cke_editable');

        // Placer le curseur à la fin du contenu
        await iframe.evaluate(() => {
            const body = document.querySelector('body.cke_editable');
            const range = document.createRange();
            const selection = window.getSelection();
            
            range.selectNodeContents(body);
            range.collapse(false); // False pour déplacer le curseur à la fin
            selection.removeAllRanges();
            selection.addRange(range);
        });

        // Récupérer le texte actuel
        const currentText = await iframe.evaluate(() => {
          const body = document.querySelector('body.cke_editable');
          return body.textContent || '';
        });
  
        // Texte à ajouter
        const textToInsert = '.qzdqz';
  
        // Vérifiez si le texte se termine par un point
        if (currentText.endsWith('.')) {
          // Supprimer le point à la fin
          await iframe.evaluate(() => {
            const body = document.querySelector('body.cke_editable');
            body.focus(); // Assurez-vous que l'élément est focalisé
            document.execCommand('delete'); // Efface le caractère à la position du curseur
          });
          console.log('Suppression du point');
        } else {
          // Ajouter un point avant d'insérer le nouveau texte
          await iframe.evaluate((textToInsert) => {
            const body = document.querySelector('body.cke_editable');
            body.focus(); // Assurez-vous que l'élément est focalisé
            document.execCommand('insertText', false, '.'); // Ajoute un point
          });
          console.log('Ajout du point');
        }

        // Appuyer sur le bouton confirmer
        try {
          // 
          await page.waitForSelector('button#edit_message_save');
          await page.click('button#edit_message_save');
          
        } catch (error) {
          throw new Error('L\'élément #edit_message_save n\'a pas été trouvé dans le délai imparti');
        }
        
        console.log(`Post modifié avec succès à ${new Date().toLocaleString()}.`);


    //   }

  } catch (error) {
    console.error('Une erreur est survenue:', error);
  } finally {
    await browser.close();
  }
}

const schedulePromotion = () => {
    // Schedule for 10 AM
    schedule.scheduleJob('5 10 * * *', promoteAdByEditing);
  
    // Schedule for 18 PM
    schedule.scheduleJob('5 18 * * *', promoteAdByEditing);

  };

module.exports = { schedulePromotion };
