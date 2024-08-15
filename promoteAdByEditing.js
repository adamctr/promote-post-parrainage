require('dotenv').config();
const puppeteer = require('puppeteer');
const schedule = require('node-schedule');
const logger = require('./logger.js');
const { connectToAccount, goToParrainagePostsSpace } = require('./utils.js');

// Function to obtain the number of posts
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

// Function to edit a post
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

                // Edit ad

                await page.waitForSelector('iframe.cke_wysiwyg_frame');
                const iframeElementHandle = await page.$('iframe.cke_wysiwyg_frame');
                const iframe = await iframeElementHandle.contentFrame();

                await iframe.waitForSelector('body.cke_editable');

                const currentText = await iframe.evaluate(() => document.body.textContent.trim());
                await iframe.focus('body.cke_editable');

                // Set cursor to end
                
                await iframe.evaluate(() => {

                    const editorBody = document.querySelector('body.cke_editable');
                
                    // Create a text range
                    const range = document.createRange();
                
                    // Select the last node and position the cursor at the end
                    range.selectNodeContents(editorBody);
                    range.collapse(false);
                
                    // Create a selection to move the cursor
                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                });

                // If Point at the end, remove it otherwise add it

                    if (currentText.endsWith('.')) {
                        await iframe.evaluate(() => document.execCommand('delete', false));
                        logger.debug({
                            type: 'edit',
                            status: 'info',
                            message: 'Removed the dot at the end',
                        });
                    } else {
                        await iframe.evaluate(() => document.execCommand('insertText', false, '.'));
                        logger.debug({
                            type: 'edit',
                            status: 'info',
                            message: 'Added a dot',
                        });
                    }

                    await page.waitForSelector('button#edit_message_save');
                    await page.click('button#edit_message_save');
                    await page.waitForNavigation({ waitUntil: 'networkidle0' });
                    logger.debug({
                        type: 'edit',
                        status: 'success',
                        message: `Post ${imageName} edited successfully`,
                    });

                    return true;

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
        throw new Error;
    }
}

// Main function to promote advertisements by edition
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
                    await goToParrainagePostsSpace(page);
                }
            }

            if (numberOfPosts - editPostError === numberOfPosts) {
                logger.info({
                    type: 'promoteByEditing',
                    status: 'success',
                    message: `The ads (${numberOfPosts}) have been successfully up thanks to the modification !`,
                });
            } else if (editPostError > 0 && numberOfPosts < editPostError) {
                logger.warn({
                    type: 'promoteByEditing',
                    message: `${numberOfPosts - editPostError} posts have been edited successfully but ${editPostError} posts editing failed`,
                });
            } else {
                logger.error({
                    type: 'promoteByEditing',
                    message: `All posts editing failed (${numberOfPosts})`,
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

// Promotion planning
const schedulePromotion = () => {
    // Schedule at 2 PM and 4 PM every day
    schedule.scheduleJob('5 14 * * *', promoteAdByEditing);
    schedule.scheduleJob('5 16 * * *', promoteAdByEditing);
};

module.exports = { schedulePromotion };
