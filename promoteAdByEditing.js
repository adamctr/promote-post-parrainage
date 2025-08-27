require('dotenv').config();
const puppeteer = require('puppeteer');
const schedule = require('node-schedule');
const logger = require('./logger.js');
const { connectToAccount, goToParrainagePostsSpace, setupGoogleVignetteRemoval, ensureValidSession } = require('./utils.js');

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
        logger.debug({
            type: 'edit',
            status: 'info',
            message: 'Début de la fonction editPost'
        });

        // Attendre 3 secondes de manière plus robuste
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 3000)));
        logger.debug({
            type: 'edit',
            status: 'success',
            message: 'Attente de 3 secondes terminée'
        });
        
        // Attendre que les éléments de la liste soient chargés
        await page.waitForSelector('.coupon-list.list-wrapper-table .coupon-wrapper');
        logger.debug({
            type: 'edit',
            status: 'success',
            message: 'Éléments de la liste chargés avec succès'
        });
        
        // Obtenir tous les boutons d'édition directement
        const editButtons = await page.$$('a.parrainage_bt.edit[href*="/edit/"]');
        logger.debug({
            type: 'edit',
            status: 'info',
            message: `Nombre de boutons d'édition trouvés: ${editButtons.length}`
        });
        
        if (postIndex < editButtons.length) {
            // Obtenir l'URL du bouton avant de cliquer
            const editUrl = await editButtons[postIndex].evaluate(button => button.href);
            logger.debug({
                type: 'edit',
                status: 'info',
                message: `URL d'édition: ${editUrl}`
            });
            
            // Cliquer sur le bouton d'édition
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 }),
                editButtons[postIndex].click()
            ]);
            logger.debug({
                type: 'edit',
                status: 'success',
                message: "Navigation vers la page d'édition réussie"
            });

            // Vérifier que nous sommes bien sur la page d'édition
            const currentUrl = page.url();
            logger.debug({
                type: 'edit',
                status: 'info',
                message: `URL actuelle: ${currentUrl}`
            });

            // Attendre que l'iframe soit chargée
            await page.waitForSelector('iframe[title^="Éditeur de texte enrichi"]', { timeout: 30000 });
            logger.debug({
                type: 'edit',
                status: 'success',
                message: 'Iframe trouvée'
            });

            const iframeElementHandle = await page.$('iframe[title^="Éditeur de texte enrichi"]');
            if (!iframeElementHandle) {
                logger.error({
                    type: 'edit',
                    status: 'error',
                    message: 'Impossible de trouver l\'iframe'
                });
                throw new Error('Editor iframe not found');
            }
            logger.debug({
                type: 'edit',
                status: 'success',
                message: 'Handle de l\'iframe obtenu'
            });

            const iframe = await iframeElementHandle.contentFrame();
            if (!iframe) {
                logger.error({
                    type: 'edit',
                    status: 'error',
                    message: 'Impossible d\'accéder au contenu de l\'iframe'
                });
                throw new Error('Could not access iframe content');
            }
            logger.debug({
                type: 'edit',
                status: 'success',
                message: 'Accès au contenu de l\'iframe réussi'
            });

            // Attendre que le contenu de l'éditeur soit chargé
            await iframe.waitForSelector('body.cke_editable', { timeout: 30000 });
            logger.debug({
                type: 'edit',
                status: 'success',
                message: 'Corps de l\'éditeur chargé'
            });

            const currentText = await iframe.evaluate(() => document.body.textContent.trim());
            logger.debug({
                type: 'edit',
                status: 'info',
                message: `Texte actuel: ${currentText.substring(0, 50)}...`
            });

            await iframe.focus('body.cke_editable');
            logger.debug({
                type: 'edit',
                status: 'success',
                message: 'Focus sur l\'éditeur réussi'
            });

            // Positionner le curseur à la fin
            await iframe.evaluate(() => {
                const editorBody = document.querySelector('body.cke_editable');
                const range = document.createRange();
                range.selectNodeContents(editorBody);
                range.collapse(false);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            });
            logger.debug({
                type: 'edit',
                status: 'success',
                message: 'Curseur positionné à la fin'
            });

            // Ajouter ou supprimer le point
            try {
                if (currentText.endsWith('.')) {
                    await iframe.evaluate(() => document.execCommand('delete', false));
                    logger.debug({
                        type: 'edit',
                        status: 'success',
                        message: 'Point supprimé avec succès'
                    });
                } else {
                    await iframe.evaluate(() => document.execCommand('insertText', false, '.'));
                    logger.debug({
                        type: 'edit',
                        status: 'success',
                        message: 'Point ajouté avec succès'
                    });
                }
            } catch (error) {
                logger.error({
                    type: 'edit',
                    status: 'error',
                    message: `Erreur lors de la modification du texte: ${error.message}`
                });
                throw error;
            }

            // Sauvegarder les modifications
            try {
                await page.waitForSelector('button#edit_message_save', { timeout: 30000 });
                await page.click('button#edit_message_save');
                await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 60000 });
                logger.debug({
                    type: 'edit',
                    status: 'success',
                    message: 'Modifications sauvegardées avec succès'
                });
            } catch (error) {
                logger.error({
                    type: 'edit',
                    status: 'error',
                    message: `Erreur lors de la sauvegarde: ${error.message}`
                });
                throw error;
            }

            return true;
        } else {
            logger.debug({
                type: 'edit',
                status: 'info',
                message: `Post index ${postIndex} hors limites`
            });
            return false;
        }
    } catch (error) {
        logger.error({
            type: 'edit',
            status: 'error',
            error: error,
            stack: error.stack,
            message: `Erreur complète dans editPost: ${error.message}`
        });
        throw error;
    }
}

// Main function to promote advertisements by edition
async function promoteAdByEditing(page, browser = null) {
    if (page) {
        try {
            // Validate session and reconnect if needed
            let validSession;
            try {
                validSession = await ensureValidSession(page, browser);
                page = validSession.page;
                browser = validSession.browser;
            } catch (sessionError) {
                logger.error({
                    type: 'promoteByEditing',
                    status: 'session_failed',
                    message: `Failed to ensure valid session: ${sessionError.message}`
                });
                throw sessionError;
            }

            await goToParrainagePostsSpace(page);

            const numberOfPosts = await getNumberOfPosts(page);
            let editPostError = 0;
            for (let i = 0; i < numberOfPosts; i++) {
                let retryCount = 0;
                const maxRetries = 2;
                
                while (retryCount <= maxRetries) {
                    try {
                        await editPost(page, i);
                        break; // Success, exit retry loop
                    } catch(err) {
                        retryCount++;
                        
                        if (retryCount <= maxRetries) {
                            logger.warn({
                                type: 'promoteByEditing',
                                status: 'retry',
                                message: `Error editing post ${i}, attempt ${retryCount}/${maxRetries + 1}: ${err.message}`
                            });
                            
                            // Check if session expired and reconnect if needed
                            try {
                                const validSession = await ensureValidSession(page, browser);
                                page = validSession.page;
                                browser = validSession.browser;
                                await goToParrainagePostsSpace(page);
                            } catch (sessionError) {
                                logger.error({
                                    type: 'promoteByEditing',
                                    status: 'session_retry_failed',
                                    message: `Failed to restore session during retry: ${sessionError.message}`
                                });
                                editPostError++;
                                break; // Exit retry loop if session can't be restored
                            }
                        } else {
                            // Max retries exceeded
                            logger.error({
                                type: 'promoteByEditing',
                                status: 'max_retries_exceeded',
                                message: `Failed to edit post ${i} after ${maxRetries + 1} attempts: ${err.message}`
                            });
                            editPostError++;
                        }
                    }
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
        }
    } else {
        logger.error({
            type: 'promoteByEditing',
            status: 'error',
            message: 'Page instance not provided',
            reason: 'Failed to connect to account',
        });
    }
}

// Promotion planning
const schedulePromotion = (page, browser) => {
    // Schedule at 2 PM and 4 PM every day
    const job1 = schedule.scheduleJob('5 22 * * *', async () => {
        await promoteAdByEditing(page, browser);
    });
    const job2 = schedule.scheduleJob('5 16 * * *', async () => {
        await promoteAdByEditing(page, browser);
    });
};

module.exports = { schedulePromotion, promoteAdByEditing };
