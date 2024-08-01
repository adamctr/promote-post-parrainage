const { schedulePromotion: schedulePromotionAdBySubscription } = require('./promoteAdBySubscription');
const { schedulePromotion: schedulePromotionAdByEditing } = require('./promoteAdByEditing');

const scheduleAllPromotions = () => {
    schedulePromotionAdBySubscription();
    schedulePromotionAdByEditing();
};

scheduleAllPromotions();
