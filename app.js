const { schedulePromotion: schedulePromotionAdBySubscription } = require('./promoteAdBySubscription');
const { schedulePromotion: schedulePromotionAdByEditing } = require('./promoteAdByEditing');
const logger = require('./logger')

const scheduleAllPromotions = () => {
    schedulePromotionAdBySubscription();
    schedulePromotionAdByEditing();

    logger.info('Post promotions are currently being programmed !' , {status:'success'})
};

scheduleAllPromotions();
