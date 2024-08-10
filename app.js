const { schedulePromotion: schedulePromotionAdBySubscription } = require('./promoteAdBySubscription');
const { schedulePromotion: schedulePromotionAdByEditing } = require('./promoteAdByEditing');
const logger = require('./logger')

const scheduleAllPromotions = () => {
    schedulePromotionAdBySubscription();
    schedulePromotionAdByEditing();

    logger.info('La programmation des promotions de posts est en cours !' , {status:'success'})
};

scheduleAllPromotions();
