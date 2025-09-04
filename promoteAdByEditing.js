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

// Function to edit text in textarea
async function editTextInTextarea(page) {
    try {
        logger.debug({
            type: 'edit_textarea',
            status: 'info',
            message: 'Tentative d\'édition du textarea directement'
        });

        // Vérifier si le textarea existe
        const textareaExists = await page.$('textarea#edit_parrainage_presentation') !== null;
        if (!textareaExists) {
            logger.debug({
                type: 'edit_textarea',
                status: 'info',
                message: 'Textarea non trouvé, fallback vers iframe'
            });
            return false;
        }

        // Obtenir le texte actuel du textarea (peut être du HTML encodé)
        const currentText = await page.$eval('textarea#edit_parrainage_presentation', el => el.value);
        logger.debug({
            type: 'edit_textarea',
            status: 'info',
            message: `Texte actuel du textarea: ${currentText.substring(0, 100)}...`
        });

        // Décoder le HTML si nécessaire (pour les entités comme &gt;, &lt;, etc.)
        const decodedText = currentText.replace(/&lt;/g, '<')
                                      .replace(/&gt;/g, '>')
                                      .replace(/&amp;/g, '&')
                                      .replace(/&quot;/g, '"')
                                      .replace(/&#39;/g, "'");

        // Vérifier si on travaille avec du HTML ou du texte brut
        const isHtmlContent = decodedText.includes('<') && decodedText.includes('>');
        logger.debug({
            type: 'edit_textarea',
            status: 'info',
            message: `Contenu HTML détecté: ${isHtmlContent}, texte décodé: ${decodedText.substring(0, 50)}...`
        });

        // Déterminer la nouvelle valeur
        let newText;
        let newDecodedText;

        if (isHtmlContent) {
            // Pour le contenu HTML, on modifie le texte décodé
            if (decodedText.trim().endsWith('.')) {
                newDecodedText = decodedText.trim().slice(0, -1);
                logger.debug({
                    type: 'edit_textarea',
                    status: 'info',
                    message: 'Point supprimé du contenu HTML'
                });
            } else {
                newDecodedText = decodedText.trim() + '.';
                logger.debug({
                    type: 'edit_textarea',
                    status: 'info',
                    message: 'Point ajouté au contenu HTML'
                });
            }

            // Re-encoder en HTML pour le textarea
            newText = newDecodedText.replace(/&/g, '&amp;')
                                   .replace(/</g, '&lt;')
                                   .replace(/>/g, '&gt;')
                                   .replace(/"/g, '&quot;')
                                   .replace(/'/g, '&#39;');
        } else {
            // Pour le texte brut
            if (currentText.endsWith('.')) {
                newText = currentText.slice(0, -1);
                logger.debug({
                    type: 'edit_textarea',
                    status: 'info',
                    message: 'Point supprimé du texte brut'
                });
            } else {
                newText = currentText + '.';
                logger.debug({
                    type: 'edit_textarea',
                    status: 'info',
                    message: 'Point ajouté au texte brut'
                });
            }
        }

        // Mettre à jour le textarea
        await page.$eval('textarea#edit_parrainage_presentation', (el, text) => {
            el.value = text;
            // Déclencher plusieurs événements pour s'assurer que CKEditor détecte le changement
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('keyup', { bubbles: true }));
            // Focus temporaire pour forcer la mise à jour
            el.focus();
            el.blur();
        }, newText);

        // Petite pause pour laisser CKEditor traiter le changement
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));

        logger.debug({
            type: 'edit_textarea',
            status: 'success',
            message: 'Textarea modifié avec succès'
        });

        return true;
    } catch (error) {
        logger.error({
            type: 'edit_textarea',
            status: 'error',
            message: `Erreur lors de l'édition du textarea: ${error.message}`
        });
        return false;
    }
}

// Function to edit text in CKEditor iframe (fallback)
async function editTextInIframe(page) {
    try {
        logger.debug({
            type: 'edit_iframe',
            status: 'info',
            message: 'Tentative d\'édition de l\'iframe CKEditor'
        });

        // Lister toutes les iframes sur la page
        const allIframes = await page.$$('iframe');
        logger.debug({
            type: 'edit_iframe',
            status: 'info',
            message: `Nombre total d'iframes sur la page: ${allIframes.length}`
        });

        // Pour chaque iframe, récupérer son title et src
        for (let i = 0; i < allIframes.length; i++) {
            const title = await allIframes[i].evaluate(el => el.title);
            const src = await allIframes[i].evaluate(el => el.src);
            logger.debug({
                type: 'edit_iframe',
                status: 'info',
                message: `Iframe #${i} détectée`,
                title,
                src
            });
        }

        // Attendre l'iframe CKEditor spécifique
        try {
            await page.waitForSelector('iframe[title^="Éditeur de texte enrichi"]', { timeout: 30000 });
            logger.debug({
                type: 'edit_iframe',
                status: 'success',
                message: 'Iframe CKEditor trouvée'
            });
        } catch (err) {
            logger.warn({
                type: 'edit_iframe',
                status: 'warn',
                message: 'Iframe CKEditor non trouvée dans les 30s',
                error: err.message
            });
            return false;
        }

        const iframeElementHandle = await page.$('iframe[title^="Éditeur de texte enrichi"]');
        if (!iframeElementHandle) {
            logger.error({
                type: 'edit_iframe',
                status: 'error',
                message: 'Impossible de trouver l\'iframe'
            });
            return false;
        }
        logger.debug({
            type: 'edit_iframe',
            status: 'success',
            message: 'Handle de l\'iframe obtenu'
        });

        const iframe = await iframeElementHandle.contentFrame();
        if (!iframe) {
            logger.error({
                type: 'edit_iframe',
                status: 'error',
                message: 'Impossible d\'accéder au contenu de l\'iframe'
            });
            return false;
        }
        logger.debug({
            type: 'edit_iframe',
            status: 'success',
            message: 'Accès au contenu de l\'iframe réussi'
        });

        // Attendre que le contenu de l'éditeur soit chargé
        await iframe.waitForSelector('body.cke_editable', { timeout: 30000 });
        logger.debug({
            type: 'edit_iframe',
            status: 'success',
            message: 'Corps de l\'éditeur chargé'
        });

        const currentText = await iframe.evaluate(() => document.body.textContent.trim());
        logger.debug({
            type: 'edit_iframe',
            status: 'info',
            message: `Texte actuel: ${currentText.substring(0, 50)}...`
        });

        await iframe.focus('body.cke_editable');
        logger.debug({
            type: 'edit_iframe',
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
            type: 'edit_iframe',
            status: 'success',
            message: 'Curseur positionné à la fin'
        });

        // Ajouter ou supprimer le point
        if (currentText.endsWith('.')) {
            await iframe.evaluate(() => document.execCommand('delete', false));
            logger.debug({
                type: 'edit_iframe',
                status: 'success',
                message: 'Point supprimé avec succès'
            });
        } else {
            await iframe.evaluate(() => document.execCommand('insertText', false, '.'));
            logger.debug({
                type: 'edit_iframe',
                status: 'success',
                message: 'Point ajouté avec succès'
            });
        }

        return true;
    } catch (error) {
        logger.error({
            type: 'edit_iframe',
            status: 'error',
            message: `Erreur lors de la modification dans l'iframe: ${error.message}`
        });
        return false;
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
        
       // Obtenir tous les boutons d'édition
        const editButtons = await page.$$('a.parrainage_bt.edit[href*="/edit/"]');
        logger.debug({
            type: 'edit',
            status: 'info',
            message: `Nombre de boutons d'édition trouvés: ${editButtons.length}`
        });

        if (postIndex < editButtons.length) {
            // Récupérer tous les liens
            const links = await Promise.all(
                editButtons.map(btn => btn.evaluate(el => el.href))
            );
            logger.debug({ type: 'edit', status: 'info', message: `Links: ${links}` });

            const editUrl = links[postIndex];
            logger.debug({ type: 'edit', status: 'info', message: `URL d'édition: ${editUrl}` });

            let navigated = false;

            // Essayer d'aller directement sur le lien
            try {
                await page.goto(editUrl, { waitUntil: 'networkidle0', timeout: 60000 });
                navigated = true;
                logger.debug({ type: 'edit', status: 'success', message: 'Navigation directe réussie via href' });
            } catch (err) {
                logger.warn({ type: 'edit', status: 'warn', message: `Navigation directe échouée, fallback sur click: ${err.message}` });
            }

            // Fallback si navigation directe échoue
            if (!navigated) {
                logger.debug({ type: 'edit', status: 'info', message: `Tentative de clic sur bouton index=${postIndex}` });

                const box = await editButtons[postIndex].boundingBox();
                if (!box) {
                    logger.error({ type: 'edit', status: 'error', message: `Le bouton index=${postIndex} est invisible ou hors viewport` });
                } else {
                    logger.debug({ type: 'edit', status: 'info', message: `BoundingBox bouton index=${postIndex}:`, box });
                }

                const oldUrl = page.url();
                try {
                    await editButtons[postIndex].scrollIntoViewIfNeeded();
                    await editButtons[postIndex].click({ delay: 50 });
                    logger.debug({ type: 'edit', status: 'info', message: `Clic exécuté sur bouton index=${postIndex}` });

                    // Attendre que le formulaire ou iframe CKEditor apparaisse
                    await page.waitForSelector(
                        'textarea#edit_parrainage_presentation, iframe[title^="Éditeur de texte enrichi"]',
                        { timeout: 60000 }
                    );
                    const newUrl = page.url();
                    logger.debug({ type: 'edit', status: 'success', message: `Formulaire chargé (oldUrl=${oldUrl}, newUrl=${newUrl})` });
                } catch (err) {
                    const newUrl = page.url();
                    logger.error({ type: 'edit', status: 'error', message: `Impossible d'accéder à la page d'édition via click (oldUrl=${oldUrl}, newUrl=${newUrl})`, error: err.message });
                }
            }

            // URL finale
            const currentUrl = page.url();
            logger.debug({ type: 'edit', status: 'info', message: `URL actuelle: ${currentUrl}` });

            // Essayer d'éditer le textarea d'abord, puis fallback vers iframe
            let editSuccess = false;
            
            // Tentative 1: Édition directe du textarea
            logger.debug({
                type: 'edit',
                status: 'info',
                message: 'Tentative d\'édition via textarea...'
            });
            
            editSuccess = await editTextInTextarea(page);
            
            // Tentative 2: Fallback vers iframe CKEditor si textarea échoue
            if (!editSuccess) {
                logger.debug({
                    type: 'edit',
                    status: 'info',
                    message: 'Textarea failed, trying iframe fallback...'
                });
                
                editSuccess = await editTextInIframe(page);
            }
            
            if (!editSuccess) {
                logger.error({
                    type: 'edit',
                    status: 'error',
                    message: 'Aucune méthode d\'édition n\'a fonctionné (textarea ni iframe)'
                });
                throw new Error('Could not edit text with either textarea or iframe method');
            }
            
            logger.debug({
                type: 'edit',
                status: 'success',
                message: 'Édition du texte réussie'
            });

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

// Function to process a single post with proper navigation
async function processSinglePost(page, browser, postIndex, maxRetries = 2) {
    let retryCount = 0;
    let lastError = null;

    while (retryCount <= maxRetries) {
        try {
            // Assurer qu'on est toujours sur la page de liste des posts
            await goToParrainagePostsSpace(page);
            logger.debug({
                type: 'processSinglePost',
                status: 'info',
                message: `Traitement du post ${postIndex}, tentative ${retryCount + 1}/${maxRetries + 1}`
            });

            // Vérifier que les posts sont toujours disponibles
            const currentNumberOfPosts = await getNumberOfPosts(page);
            if (postIndex >= currentNumberOfPosts) {
                logger.warn({
                    type: 'processSinglePost',
                    status: 'warn',
                    message: `Post ${postIndex} non disponible (seulement ${currentNumberOfPosts} posts trouvés)`
                });
                return false;
            }

            // Traiter le post
            const success = await editPost(page, postIndex);
            if (success) {
                logger.info({
                    type: 'processSinglePost',
                    status: 'success',
                    message: `Post ${postIndex} traité avec succès`
                });
                return true;
            } else {
                throw new Error(`Échec du traitement du post ${postIndex}`);
            }

        } catch(err) {
            lastError = err;
            retryCount++;

            if (retryCount <= maxRetries) {
                logger.warn({
                    type: 'processSinglePost',
                    status: 'retry',
                    message: `Erreur post ${postIndex}, tentative ${retryCount}/${maxRetries + 1}: ${err.message}`
                });

                // Vérifier et restaurer la session si nécessaire
                try {
                    const validSession = await ensureValidSession(page, browser);
                    page = validSession.page;
                    browser = validSession.browser;
                } catch (sessionError) {
                    logger.error({
                        type: 'processSinglePost',
                        status: 'session_failed',
                        message: `Impossible de restaurer la session: ${sessionError.message}`
                    });
                    return false;
                }
            } else {
                logger.error({
                    type: 'processSinglePost',
                    status: 'max_retries_exceeded',
                    message: `Échec définitif du post ${postIndex} après ${maxRetries + 1} tentatives: ${err.message}`
                });
                return false;
            }
        }
    }

    return false;
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

            // Aller à la page des posts
            await goToParrainagePostsSpace(page);

            // Obtenir le nombre initial de posts
            const initialNumberOfPosts = await getNumberOfPosts(page);
            logger.info({
                type: 'promoteByEditing',
                status: 'info',
                message: `Début du traitement de ${initialNumberOfPosts} posts`
            });

            let successCount = 0;
            let errorCount = 0;

            // Traiter chaque post individuellement
            for (let i = 0; i < initialNumberOfPosts; i++) {
                const success = await processSinglePost(page, browser, i);
                if (success) {
                    successCount++;
                } else {
                    errorCount++;
                }

                // Petite pause entre les posts pour éviter la surcharge
                await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 1000)));
            }

            // Afficher le résumé final
            if (successCount === initialNumberOfPosts) {
                logger.info({
                    type: 'promoteByEditing',
                    status: 'success',
                    message: `Tous les posts (${successCount}) ont été modifiés avec succès !`,
                });
            } else if (successCount > 0) {
                logger.warn({
                    type: 'promoteByEditing',
                    status: 'partial_success',
                    message: `${successCount} posts modifiés avec succès, ${errorCount} posts en échec sur ${initialNumberOfPosts} total`,
                });
            } else {
                logger.error({
                    type: 'promoteByEditing',
                    status: 'complete_failure',
                    message: `Aucun post n'a pu être modifié (${errorCount} erreurs sur ${initialNumberOfPosts})`,
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
