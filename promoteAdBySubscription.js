const puppeteer = require('puppeteer');
const schedule = require('node-schedule');
const logger = require('./logger');  // Importer le logger configuré
const { connectToAccount, setupGoogleVignetteRemoval } = require('./utils.js');

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
async function promoteAdBySubscription(page) {
    if (page) {
        try {
            // Ensure we are on the user space page
            if (page.url().includes('/espace_parrain')) {
                // Récupérer l'ID du profil
                const profileId = await getProfileId(page);
                logger.debug({
                    type: 'promoteBySubscription',
                    status: 'info',
                    message: `Tentative de promotion des annonces pour le profil ${profileId}`
                });

                // Wait for "up" button with dynamic profile ID
                try {
                    await page.waitForSelector(`a[href="/espace_parrain/profile/annonces/${profileId}/remonter"]`);
                } catch (error) {
                    logger.error({
                        type: 'promoteBySubscription',
                        status: 'failed',
                        reason: 'button not available',
                        message: error.message,
                    });
                    throw error;
                }

                // Click to promote the ads with dynamic profile ID
                await page.click(`a[href="/espace_parrain/profile/annonces/${profileId}/remonter"]`);
                logger.info({
                    type: 'promoteBySubscription',
                    status: 'success',
                    message: `Les annonces ont été remontées avec succès pour le profil ${profileId} !`
                });

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
        await promoteAdBySubscription(page);
    });

    // Schedule for 12 PM
    const job2 = schedule.scheduleJob('5 20 * * *', async () => {
        await promoteAdBySubscription(page);
    });

    // Schedule for 4 PM
    const job3 = schedule.scheduleJob('5 18 * * *', async () => {
        await promoteAdBySubscription(page);
    });
};

module.exports = { schedulePromotion, promoteAdBySubscription };