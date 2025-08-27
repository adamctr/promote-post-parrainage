const puppeteer = require('puppeteer');
const schedule = require('node-schedule');
const logger = require('./logger');  // Importer le logger configuré
const { connectToAccount, setupGoogleVignetteRemoval, ensureValidSession } = require('./utils.js');

// Function to get the profile ID
async function getProfileId(page) {
    try {
        await page.waitForSelector('a[title="MON PROFIL"]');
        const profileId = await page.evaluate(() => {
            const profileLink = document.querySelector('a[title="MON PROFIL"]');
            const match = profileLink.href.match(/\/profile\/edit\/(\d+)/);
            return match ? match[1] : null;
        });
        
        if (!profileId) {
            throw new Error("Impossible de récupérer l'ID du profil");
        }

        logger.debug({
            type: 'profile',
            status: 'success',
            message: `ID du profil récupéré: ${profileId}`
        });

        return profileId;
    } catch (error) {
        logger.error({
            type: 'profile',
            status: 'error',
            message: `Erreur lors de la récupération de l'ID du profil: ${error.message}`
        });
        throw error;
    }
}

// Will promote ad at 8 AM, 12 AM and 16 AM (Works with subscription)
async function promoteAdBySubscription(page, browser = null) {
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
                    type: 'promoteBySubscription',
                    status: 'session_failed',
                    message: `Failed to ensure valid session: ${sessionError.message}`
                });
                throw sessionError;
            }

            // Ensure we are on the user space page
            if (page.url().includes('/espace_parrain')) {
                // Récupérer l'ID du profil
                const profileId = await getProfileId(page);
                logger.debug({
                    type: 'promoteBySubscription',
                    status: 'info',
                    message: `Tentative de promotion des annonces pour le profil ${profileId}`
                });

                // Wait for "up" button with dynamic profile ID (with retry mechanism)
                let buttonFound = false;
                let retryCount = 0;
                const maxRetries = 3;
                
                while (!buttonFound && retryCount <= maxRetries) {
                    try {
                        await page.waitForSelector(`a[href="/espace_parrain/profile/annonces/${profileId}/remonter"]`, { timeout: 10000 });
                        buttonFound = true;
                    } catch (error) {
                        retryCount++;
                        
                        if (retryCount <= maxRetries) {
                            logger.warn({
                                type: 'promoteBySubscription',
                                status: 'retry',
                                message: `Button not found, attempt ${retryCount}/${maxRetries + 1}. Checking session and retrying...`
                            });
                            
                            // Check if session expired and reconnect if needed
                            try {
                                const validSession = await ensureValidSession(page, browser);
                                page = validSession.page;
                                browser = validSession.browser;
                                
                                // Navigate to user space and get profile ID again
                                await page.goto('https://www.1parrainage.com/espace_parrain/', { waitUntil: 'networkidle0' });
                                const newProfileId = await getProfileId(page);
                                if (newProfileId !== profileId) {
                                    logger.debug(`Profile ID changed from ${profileId} to ${newProfileId} after reconnection`);
                                    profileId = newProfileId;
                                }
                            } catch (sessionError) {
                                logger.error({
                                    type: 'promoteBySubscription',
                                    status: 'session_retry_failed',
                                    message: `Failed to restore session during button retry: ${sessionError.message}`
                                });
                                throw sessionError;
                            }
                        } else {
                            logger.error({
                                type: 'promoteBySubscription',
                                status: 'failed',
                                reason: 'button not available after retries',
                                message: `Promote button not found after ${maxRetries + 1} attempts: ${error.message}`,
                            });
                            throw error;
                        }
                    }
                }

                // Click to promote the ads with dynamic profile ID
                try {
                    await page.click(`a[href="/espace_parrain/profile/annonces/${profileId}/remonter"]`);
                    logger.info({
                        type: 'promoteBySubscription',
                        status: 'success',
                        message: `Les annonces ont été remontées avec succès pour le profil ${profileId} !`
                    });
                } catch (clickError) {
                    logger.error({
                        type: 'promoteBySubscription',
                        status: 'failed',
                        reason: 'click failed',
                        message: `Failed to click promote button: ${clickError.message}`
                    });
                    throw clickError;
                }

            } else {
                logger.error({
                    type: 'promoteBySubscription',
                    status: 'failed',
                    message: "Page de l'espace parrain non trouvée"
                });
            }
        } catch (error) {
            logger.error({
                type: 'promoteBySubscription',
                status: 'failed',
                error: error.message,
                message: `Erreur lors de la promotion des annonces: ${error.message}`,
            });
        }
    } else {
        logger.error({
            type: 'promoteBySubscription',
            status: 'failed',
            message: "Instance de page non fournie"
        });
    }
}

const schedulePromotion = (page, browser) => {
    // Schedule for 8 AM
    const job1 = schedule.scheduleJob('5 9 * * *', async () => {
        await promoteAdBySubscription(page, browser);
    });

    // Schedule for 12 PM
    const job2 = schedule.scheduleJob('5 20 * * *', async () => {
        await promoteAdBySubscription(page, browser);
    });

    // Schedule for 4 PM
    const job3 = schedule.scheduleJob('5 18 * * *', async () => {
        await promoteAdBySubscription(page, browser);
    });
};

module.exports = { schedulePromotion, promoteAdBySubscription };