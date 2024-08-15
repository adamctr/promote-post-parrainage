require('dotenv').config();
const puppeteer = require('puppeteer');
const schedule = require('node-schedule');
const logger = require('./logger.js');
const { connectToAccount, goToParrainagePostsSpace } = require('./utils.js');

// Fonction pour obtenir le nombre de posts
async function getNumberOfPosts(page) {
    try {
        await page.waitForSelector('a.parrainage_bt.edit');
        const posts = await page.$$('a.parrainage_bt.edit');
        logger.debug({
            type: 'posts',
            status: 'success',
            message: `Found ${posts.length} elements to interact with.`,
        });
        return posts.length;
    } catch (error) {
        logger.error({
            type: 'posts',
            status: 'error',
            error: error.message,
            message: error.message
        });
    }
}

// Fonction pour éditer un post
async function editPost(page, postIndex) {
    try {
        await page.waitForSelector('.coupon-list.list-wrapper');
        const couponElements = await page.$$('[class="coupon-list list-wrapper"]');

        if (postIndex < couponElements.length) {
            const coupon = couponElements[postIndex];
            const imageUrl = await coupon.evaluate((coupon) => {
                const imgElement = coupon.querySelector('img');
                return imgElement.src;
            });

            const imageNameWithExtension = imageUrl.split('/leslogos/')[1];
            const imageName = imageNameWithExtension.split('.')[0];

            logger.debug({
                type: 'edit',
                status: 'info',
                message: `In ${imageName} AD`,
            });

            await page.waitForSelector('a.parrainage_bt.edit');
            const editButton = await coupon.$('a.parrainage_bt.edit');
            
            if (editButton) {
                await editButton.click();
                logger.debug({
                    type: 'edit',
                    status: 'success',
                    message: `Clicked on Edit button for post index ${postIndex}`,
                });
                
                await page.waitForNavigation({ waitUntil: 'networkidle0' });

                // Edit de l'annonce

                await page.waitForSelector('iframe.cke_wysiwyg_frame');
                const iframeElementHandle = await page.$('iframe.cke_wysiwyg_frame');
                const iframe = await iframeElementHandle.contentFrame();

                await iframe.waitForSelector('body.cke_editable');

                const currentText = await iframe.evaluate(() => document.body.textContent.trim());
                await iframe.focus('body.cke_editable');

                // Mettre le curseur à la fin
                
                await iframe.evaluate(() => {

                    const editorBody = document.querySelector('body.cke_editable');
                
                    // Créer une plage de texte
                    const range = document.createRange();
                
                    // Sélectionner le dernier nœud et positionner le curseur à la fin
                    range.selectNodeContents(editorBody);
                    range.collapse(false);
                
                    // Créer une sélection pour déplacer le curseur
                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                });

                // Si Point à la fin, l'enlever sinon le rajouter

                if (currentText.endsWith('.')) {
                    //await iframe.evaluate(() => document.execCommand('delete', false));
                    logger.debug({
                        type: 'edit',
                        status: 'info',
                        message: 'Removed the dot at the end',
                    });
                } else {
                    //await iframe.evaluate(() => document.execCommand('insertText', false, '.'));
                    logger.debug({
                        type: 'edit',
                        status: 'info',
                        message: 'Added a dot',
                    });
                }

                try {
                    await page.waitForSelector('button#edit_message_save');
                    await page.click('button#edit_message_save');
                    await page.waitForNavigation({ waitUntil: 'networkidle0' });
                    logger.debug({
                        type: 'edit',
                        status: 'success',
                        message: `Post ${imageName} edited successfully`,
                    });

                    return true;
                } catch (error) {
                    logger.error({
                        type: 'edit',
                        status: 'failed',
                        reason: `Failed to save ${imageName} post`,
                        message: error.message,
                        error: error,
                    });
                }
            } else {
                logger.error({
                    type: 'edit',
                    status: 'info',
                    message: `Edit button not found for ${imageName}`,
                });
            }
        } else {
            logger.debug({
                type: 'edit',
                status: 'info',
                message: `Post index ${postIndex} out of bounds`,
            });
        }
    } catch (error) {
        logger.error({
            type: 'edit',
            status: 'error',
            error: error,
            message: error.message,
        });
    }
}

// Fonction principale pour promouvoir les annonces par édition
async function promoteAdByEditing() {
    const { page, browser } = await connectToAccount();

    if (page && browser) {
        try {
            await goToParrainagePostsSpace(page);

            const numberOfPosts = await getNumberOfPosts(page);
            let editPostError = 0;
            for (let i = 0; i < numberOfPosts; i++) {
                try {
                    await editPost(page, i);
                } catch(err) {
                    editPostError++;
                }
            }

            if (numberOfPosts - editPostError === numberOfPosts) {
                logger.info({
                    type: 'promoteByEditing',
                    status: 'success',
                    message: `${numberOfPosts} posts have been edited successfully`,
                });
            } else if (editPostError > 0 && numberOfPosts < editPostError) {
                logger.warn({
                    type: 'promoteByEditing',
                    message: `${numberOfPosts - editPostError} posts have been edited successfully but ${editPostError} posts editing failed`,
                });
            } else {
                logger.error({
                    type: 'promoteByEditing',
                    message: `All posts editing failed ${numberOfPosts}`,
                });
            }

        } catch (error) {
            logger.error({
                type: 'promoteByEditing',
                status: 'error',
                error: error,
                message: error.message,
            });
        } finally {
            await browser.close();
        }
    } else {
        logger.error({
            type: 'promoteByEditing',
            status: 'error',
            message: error.message,
            reason: 'Failed to connect to account',
        });
    }
}

promoteAdByEditing();

// Planification des promotions
const schedulePromotion = () => {
    // Schedule at 2 PM and 4 PM every day
    schedule.scheduleJob('5 14 * * *', promoteAdByEditing);
    schedule.scheduleJob('5 16 * * *', promoteAdByEditing);
};

module.exports = { schedulePromotion };
