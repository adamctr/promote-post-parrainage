require('dotenv').config();
const schedule = require('node-schedule');
const dailyReportService = require('./dailyReportService');
const logger = require('./logger');

class ReportScheduler {
    constructor() {
        this.scheduledJobs = new Map();
        this.setupSchedules();
    }

    setupSchedules() {
        // Programmer le rapport quotidien
        if (process.env.DAILY_REPORT_ENABLED === 'true') {
            this.scheduleDailyReport();
        }

        // Programmer le rapport hebdomadaire (optionnel)
        if (process.env.WEEKLY_REPORT_ENABLED === 'true') {
            this.scheduleWeeklyReport();
        }

        logger.info('Report scheduler initialized', {
            dailyEnabled: process.env.DAILY_REPORT_ENABLED === 'true',
            weeklyEnabled: process.env.WEEKLY_REPORT_ENABLED === 'true',
            dailyTime: process.env.DAILY_REPORT_TIME,
            weeklyTime: process.env.WEEKLY_REPORT_TIME
        });
    }

    scheduleDailyReport() {
        const reportTime = process.env.DAILY_REPORT_TIME || '19:30';
        const [hour, minute] = reportTime.split(':').map(Number);

        if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            logger.error('Invalid DAILY_REPORT_TIME format. Use HH:MM format', { reportTime });
            return;
        }

        // Programmer l'envoi quotidien à l'heure spécifiée
        const dailyJob = schedule.scheduleJob('daily-report', `${minute} ${hour} * * *`, async () => {
            logger.info('Starting scheduled daily report generation');
            try {
                await dailyReportService.sendDailyReport();
                logger.info('Scheduled daily report completed successfully');
            } catch (error) {
                logger.error('Scheduled daily report failed', { error: error.message, stack: error.stack });
            }
        });

        this.scheduledJobs.set('daily-report', dailyJob);
        
        logger.info('Daily report scheduled', { 
            time: reportTime, 
            nextRun: dailyJob.nextInvocation()?.toISOString() 
        });
    }

    scheduleWeeklyReport() {
        const reportTime = process.env.WEEKLY_REPORT_TIME || '20:00';
        const reportDay = parseInt(process.env.WEEKLY_REPORT_DAY) || 1; // 1 = Lundi
        const [hour, minute] = reportTime.split(':').map(Number);

        if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            logger.error('Invalid WEEKLY_REPORT_TIME format. Use HH:MM format', { reportTime });
            return;
        }

        if (reportDay < 0 || reportDay > 6) {
            logger.error('Invalid WEEKLY_REPORT_DAY. Use 0-6 (0=Sunday, 1=Monday, etc.)', { reportDay });
            return;
        }

        // Programmer l'envoi hebdomadaire
        const weeklyJob = schedule.scheduleJob('weekly-report', `${minute} ${hour} * * ${reportDay}`, async () => {
            logger.info('Starting scheduled weekly report generation');
            try {
                await this.generateWeeklyReport();
                logger.info('Scheduled weekly report completed successfully');
            } catch (error) {
                logger.error('Scheduled weekly report failed', { error: error.message, stack: error.stack });
            }
        });

        this.scheduledJobs.set('weekly-report', weeklyJob);
        
        logger.info('Weekly report scheduled', { 
            time: reportTime, 
            day: reportDay,
            nextRun: weeklyJob.nextInvocation()?.toISOString() 
        });
    }

    async generateWeeklyReport() {
        // TODO: Implémenter le rapport hebdomadaire si nécessaire
        logger.info('Weekly report generation not yet implemented');
    }

    // Envoyer un rapport immédiatement (pour test)
    async sendImmediateReport() {
        logger.info('Sending immediate daily report');
        try {
            await dailyReportService.sendDailyReport();
            logger.info('Immediate daily report sent successfully');
        } catch (error) {
            logger.error('Immediate daily report failed', { error: error.message, stack: error.stack });
            throw error;
        }
    }

    // Obtenir les prochaines exécutions programmées
    getNextSchedules() {
        const schedules = {};
        for (const [name, job] of this.scheduledJobs) {
            schedules[name] = job.nextInvocation()?.toISOString() || null;
        }
        return schedules;
    }

    // Annuler tous les jobs programmés
    cancelAllJobs() {
        for (const [name, job] of this.scheduledJobs) {
            job.cancel();
            logger.info('Cancelled scheduled job', { jobName: name });
        }
        this.scheduledJobs.clear();
    }

    // Redémarrer les programmations
    restart() {
        this.cancelAllJobs();
        this.setupSchedules();
        logger.info('Report scheduler restarted');
    }
}

// Instance singleton
const reportScheduler = new ReportScheduler();

module.exports = reportScheduler;
