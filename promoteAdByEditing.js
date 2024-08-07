const puppeteer = require('puppeteer');
const schedule = require('node-schedule');

const { connectToAccount } = require('./utils.js');
const { goToParrainagePostsSpace } = require('./utils.js');

async function getNumberOfPosts(page) {
    try {
        await page.waitForSelector('a.parrainage_bt.edit');
        const posts = await page.$$('a.parrainage_bt.edit');
        console.log(`----------------------- Found ${posts.length} elements to interact with. --------------------------------------`);
        return posts.length;
    } catch (error) {
        console.error(`Error in getNumberOfPosts: ${error}`);
        throw error;
    }
}

async function editPost(page, postIndex) {
  try {
    // Attendre que la liste des coupons soit visible
    await page.waitForSelector('.coupon-list.list-wrapper');

    // Sélectionner tous les éléments de coupon dans la liste
    const couponElements = await page.$$('[class="coupon-list list-wrapper"]');

    // Vérifier que l'index du post est dans les limites
    if (postIndex < couponElements.length) {
        const coupon = couponElements[postIndex];

        // Récupérer le nom de l'annonce via l'image
        // ------------- Récupération URL
        const imageUrl = await coupon.evaluate((coupon) => {
          const imgElement = coupon.querySelector('img');
          return imgElement.src;
        })

        // ------------- Extract the part after '/leslogos/'
         const imageNameWithExtension = imageUrl.split('/leslogos/')[1];
         const imageName = imageNameWithExtension.split('.')[0];
         console.log(`Image name: ${imageName}`);

        // Trouver le bouton "Edit" à l'intérieur de cet élément de coupon
        await page.waitForSelector('a.parrainage_bt.edit');
        const editButton = await coupon.$('a.parrainage_bt.edit');
        
        if (editButton) {
            // Cliquez sur le bouton "Edit"
            await editButton.click();
            console.log(`Clicked on Edit button for post index ${postIndex}`);
            
            // Attendre la navigation après le clic
            await page.waitForNavigation({ waitUntil: 'networkidle0' });

            // Modifications à l'intérieur du post (comme dans l'exemple précédent)
            await page.waitForSelector('iframe.cke_wysiwyg_frame');
            const iframeElementHandle = await page.$('iframe.cke_wysiwyg_frame');
            const iframe = await iframeElementHandle.contentFrame();

            await iframe.waitForSelector('body.cke_editable');
            await iframe.focus('body.cke_editable');

            const currentText = await iframe.evaluate(() => document.body.textContent.trim());

            if (currentText.endsWith('.')) {
                await iframe.evaluate(() => {
                    document.execCommand('delete', false);
                });
                console.log('Removed the dot at the end');
            } else {
                await iframe.evaluate(() => {
                    document.execCommand('insertText', false, '.');
                });
                console.log('Added a dot');
            }

            try {
              await page.waitForSelector('button#edit_message_save');
              await page.click('button#edit_message_save');
              await page.waitForNavigation({ waitUntil: 'networkidle0' });
              console.log(`Post ${imageName} edited successfully at ${new Date().toLocaleString()}`);
          } catch (error) {
              console.error(`Failed to save ${imageName} post, retrying from the post list page:`, error);
              await page.goto('https://www.1parrainage.com/espace_parrain/parrainages/', { waitUntil: 'networkidle0' });
          }
        } else {
            console.log(`Edit button not found for post index ${postIndex}`);
        }
    } else {
        console.log(`Post index ${postIndex} out of bounds`);
    }
} catch (error) {
    console.error(`Error in editPost: ${error}`);
}
}

async function promoteAdByEditing() {
    const page = await connectToAccount();

    if (page) {
        try {
            await goToParrainagePostsSpace(page);
            const numberOfPosts = await getNumberOfPosts(page);
            console.log(`Number of posts: ${numberOfPosts}`);

            for (let i = 0; i < numberOfPosts; i++) {
                await editPost(page, i);
            }
        } catch (error) {
            console.error(`Error in promoteAdByEditing: ${error}`);
        } finally {
            await page.browser().close();
        }
    }
}

const schedulePromotion = () => {
    // Schedule at 10 AM and 6 PM every day
    schedule.scheduleJob('5 14 * * *', promoteAdByEditing);

    schedule.scheduleJob('5 16 * * *', promoteAdByEditing);
};

module.exports = { schedulePromotion };
