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
        logger.info({
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

            logger.info({
                type: 'edit',
                status: 'info',
                message: `In ${imageName} AD`,
            });

            await page.waitForSelector('a.parrainage_bt.edit');
            const editButton = await coupon.$('a.parrainage_bt.edit');
            
            if (editButton) {
                await editButton.click();
                logger.info({
                    type: 'edit',
                    status: 'success',
                    message: `Clicked on Edit button for post index ${postIndex}`,
                });
                
                await page.waitForNavigation({ waitUntil: 'networkidle0' });

                await page.waitForSelector('iframe.cke_wysiwyg_frame');
                const iframeElementHandle = await page.$('iframe.cke_wysiwyg_frame');
                const iframe = await iframeElementHandle.contentFrame();

                await iframe.waitForSelector('body.cke_editable');
                await iframe.focus('body.cke_editable');

                const currentText = await iframe.evaluate(() => document.body.textContent.trim());

                if (currentText.endsWith('.')) {
                    await iframe.evaluate(() => document.execCommand('delete', false));
                    logger.info({
                        type: 'edit',
                        status: 'info',
                        message: 'Removed the dot at the end',
                    });
                } else {
                    await iframe.evaluate(() => document.execCommand('insertText', false, '.'));
                    logger.info({
                        type: 'edit',
                        status: 'info',
                        message: 'Added a dot',
                    });
                }

                try {
                    await page.waitForSelector('button#edit_message_save');
                    await page.click('button#edit_message_save');
                    await page.waitForNavigation({ waitUntil: 'networkidle0' });
                    logger.info({
                        type: 'edit',
                        status: 'success',
                        message: `Post ${imageName} edited successfully`,
                    });
                } catch (error) {
                    logger.error({
                        type: 'edit',
                        status: 'failed',
                        reason: `Failed to save ${imageName} post`,
                        message: error.message,
                        error: error,
                    });
                    await page.goto('https://www.1parrainage.com/espace_parrain/parrainages/', { waitUntil: 'networkidle0' });
                }
            } else {
                logger.info({
                    type: 'edit',
                    status: 'info',
                    message: `Edit button not found for ${imageName}`,
                });
            }
        } else {
            logger.info({
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
            for (let i = 0; i < numberOfPosts; i++) {
                await editPost(page, i);
            }

            logger.info({
                type: 'promoteByEditing',
                status: 'success',
                message: `${numberOfPosts} posts have been edited successfully !`,
            });

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

// Planification des promotions
const schedulePromotion = () => {
    // Schedule at 2 PM and 4 PM every day
    schedule.scheduleJob('5 14 * * *', promoteAdByEditing);
    schedule.scheduleJob('5 16 * * *', promoteAdByEditing);
};

module.exports = { schedulePromotion };
