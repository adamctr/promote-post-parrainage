require('dotenv').config();
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class DailyReportService {
    constructor() {
        this.stats = {
            date: new Date().toISOString().split('T')[0],
            scriptExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            postsProcessed: 0,
            postsPromoted: 0,
            postsEdited: 0,
            postsBoosted: 0,
            editingSuccessRate: 0,
            boostingSuccessRate: 0,
            totalInteractions: 0,
            averageProcessingTime: 0,
            errors: [],
            executionTimes: [],
            browserLaunches: 0,
            sessionErrors: 0,
            csrfErrors: 0,
            connectionErrors: 0,
            lastExecutionTime: null,
            startTime: new Date(),
            dailyGoal: 20, // Objectif quotidien de posts à traiter
            weeklyStats: {
                totalPosts: 0,
                totalPromotions: 0
            },
            hourlyActivity: this.initializeHourlyActivity()
        };
        
        this.setupTransporter();
    }

    // Initialiser l'activité horaire (24 heures)
    initializeHourlyActivity() {
        const activity = {};
        for (let hour = 0; hour < 24; hour++) {
            activity[hour] = {
                executions: 0,
                successes: 0,
                failures: 0,
                postsProcessed: 0,
                postsPromoted: 0,
                lastActivity: null,
                status: 'inactive' // inactive, success, failure, mixed
            };
        }
        return activity;
    }

    setupTransporter() {
        if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
            logger.warn('SMTP configuration incomplete - daily reports disabled');
            return;
        }

        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT) || 465,
            secure: true, // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD
            }
        });

        logger.info('Daily report service initialized with SMTP configuration');
    }

    // Enregistrer le début d'une exécution
    recordExecutionStart() {
        this.stats.scriptExecutions++;
        this.stats.lastExecutionTime = new Date();
        
        // Tracking horaire
        const currentHour = new Date().getHours();
        this.stats.hourlyActivity[currentHour].executions++;
        this.stats.hourlyActivity[currentHour].lastActivity = new Date();
        
        logger.info('DAILY_STATS', { 
            action: 'execution_start', 
            timestamp: this.stats.lastExecutionTime,
            hour: currentHour,
            totalExecutions: this.stats.scriptExecutions 
        });
    }

    // Mettre à jour le statut d'une heure
    updateHourlyStatus(hour) {
        const hourData = this.stats.hourlyActivity[hour];
        if (hourData.failures > 0 && hourData.successes > 0) {
            hourData.status = 'mixed';
        } else if (hourData.failures > 0) {
            hourData.status = 'failure';
        } else if (hourData.successes > 0) {
            hourData.status = 'success';
        } else if (hourData.executions > 0) {
            hourData.status = 'running';
        } else {
            hourData.status = 'inactive';
        }
    }

    // Enregistrer le succès d'une exécution
    recordExecutionSuccess(postsProcessed = 0, postsPromoted = 0, duration = 0) {
        this.stats.successfulExecutions++;
        this.stats.postsProcessed += postsProcessed;
        this.stats.postsPromoted += postsPromoted;
        this.stats.executionTimes.push(duration);
        
        // Tracking horaire
        const currentHour = new Date().getHours();
        this.stats.hourlyActivity[currentHour].successes++;
        this.stats.hourlyActivity[currentHour].postsProcessed += postsProcessed;
        this.stats.hourlyActivity[currentHour].postsPromoted += postsPromoted;
        this.stats.hourlyActivity[currentHour].lastActivity = new Date();
        this.updateHourlyStatus(currentHour);
        
        logger.info('DAILY_STATS', { 
            action: 'execution_success', 
            postsProcessed,
            postsPromoted,
            duration,
            hour: currentHour,
            totalSuccessful: this.stats.successfulExecutions 
        });
    }

    // Enregistrer l'échec d'une exécution
    recordExecutionFailure(error, duration = 0) {
        this.stats.failedExecutions++;
        this.stats.executionTimes.push(duration);
        this.stats.errors.push({
            timestamp: new Date(),
            error: error.message || error,
            stack: error.stack || null
        });
        
        // Tracking horaire
        const currentHour = new Date().getHours();
        this.stats.hourlyActivity[currentHour].failures++;
        this.stats.hourlyActivity[currentHour].lastActivity = new Date();
        this.updateHourlyStatus(currentHour);
        
        logger.error('DAILY_STATS', { 
            action: 'execution_failure', 
            error: error.message || error,
            duration,
            hour: currentHour,
            totalFailed: this.stats.failedExecutions 
        });
    }

    // Enregistrer un lancement de navigateur
    recordBrowserLaunch() {
        this.stats.browserLaunches++;
        logger.info('DAILY_STATS', { 
            action: 'browser_launch', 
            totalLaunches: this.stats.browserLaunches 
        });
    }

    // Enregistrer une erreur de session
    recordSessionError(error) {
        this.stats.sessionErrors++;
        
        // Catégoriser les erreurs
        const errorMsg = error.message || error;
        if (errorMsg.toLowerCase().includes('csrf')) {
            this.stats.csrfErrors++;
        } else if (errorMsg.toLowerCase().includes('connection') || errorMsg.toLowerCase().includes('network')) {
            this.stats.connectionErrors++;
        }
        
        logger.warn('DAILY_STATS', { 
            action: 'session_error', 
            error: errorMsg,
            totalSessionErrors: this.stats.sessionErrors,
            csrfErrors: this.stats.csrfErrors,
            connectionErrors: this.stats.connectionErrors
        });
    }

    // Enregistrer les posts édités
    recordPostsEdited(count, successCount = count) {
        this.stats.postsEdited += count;
        this.stats.totalInteractions += count;
        this.stats.editingSuccessRate = this.stats.postsEdited > 0 ? 
            (successCount / this.stats.postsEdited * 100) : 0;
        
        logger.info('DAILY_STATS', { 
            action: 'posts_edited', 
            count,
            successCount,
            totalEdited: this.stats.postsEdited,
            editingSuccessRate: this.stats.editingSuccessRate.toFixed(2)
        });
    }

    // Enregistrer les posts boostés
    recordPostsBoosted(count, successCount = count) {
        this.stats.postsBoosted += count;
        this.stats.totalInteractions += count;
        this.stats.boostingSuccessRate = this.stats.postsBoosted > 0 ? 
            (successCount / this.stats.postsBoosted * 100) : 0;
        
        logger.info('DAILY_STATS', { 
            action: 'posts_boosted', 
            count,
            successCount,
            totalBoosted: this.stats.postsBoosted,
            boostingSuccessRate: this.stats.boostingSuccessRate.toFixed(2)
        });
    }

    // Calculer les statistiques pour le rapport
    calculateStats() {
        const totalExecutions = this.stats.scriptExecutions;
        const successRate = totalExecutions > 0 ? (this.stats.successfulExecutions / totalExecutions * 100).toFixed(2) : 0;
        const avgExecutionTime = this.stats.executionTimes.length > 0 
            ? (this.stats.executionTimes.reduce((a, b) => a + b, 0) / this.stats.executionTimes.length / 1000).toFixed(2)
            : 0;
        
        const uptime = Date.now() - this.stats.startTime.getTime();
        const uptimeHours = (uptime / (1000 * 60 * 60)).toFixed(2);

        return {
            ...this.stats,
            successRate,
            avgExecutionTime,
            uptimeHours,
            recentErrors: this.stats.errors.slice(-5) // Dernières 5 erreurs
        };
    }

    // Générer le HTML du rapport avec design moderne
    generateReportHTML(stats) {
        const statusIcon = stats.successRate >= 80 ? '🟢' : stats.successRate >= 50 ? '🟡' : '🔴';
        const statusText = stats.successRate >= 80 ? 'OPTIMAL' : stats.successRate >= 50 ? 'ATTENTION' : 'CRITIQUE';
        const statusColor = stats.successRate >= 80 ? '#10B981' : stats.successRate >= 50 ? '#F59E0B' : '#EF4444';
        
        const goalProgress = ((stats.postsProcessed / stats.dailyGoal) * 100).toFixed(1);
        const goalColor = goalProgress >= 100 ? '#10B981' : goalProgress >= 75 ? '#F59E0B' : '#EF4444';

        return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rapport Quotidien - Promote Post Parrainage</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6; 
            color: #1F2937; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
        }
        
        .container { 
            max-width: 900px; 
            margin: 0 auto; 
            background: #ffffff; 
            border-radius: 16px; 
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }
        
        .header { 
            background: linear-gradient(135deg, #1F2937 0%, #374151 100%);
            color: white; 
            padding: 40px 30px;
            text-align: center;
            position: relative;
        }
        
        .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="50" cy="50" r="1" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
        }
        
        .header-content { position: relative; z-index: 1; }
        .header h1 { font-size: 2.5rem; font-weight: 800; margin-bottom: 8px; }
        .header h2 { font-size: 1.25rem; font-weight: 400; opacity: 0.9; margin-bottom: 16px; }
        .header-date { 
            background: rgba(255,255,255,0.2); 
            padding: 8px 16px; 
            border-radius: 50px; 
            display: inline-block;
            font-weight: 500;
        }
        
        .status-banner { 
            background: ${statusColor};
            color: white; 
            text-align: center; 
            padding: 24px;
            position: relative;
        }
        
        .status-content { position: relative; z-index: 1; }
        .status-icon { font-size: 3rem; margin-bottom: 8px; }
        .status-text { font-size: 1.5rem; font-weight: 700; margin-bottom: 4px; }
        .status-rate { font-size: 1.125rem; opacity: 0.9; }
        
        .content { padding: 40px 30px; }
        
        .goal-section {
            background: linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%);
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 32px;
            text-align: center;
        }
        
        .goal-title { font-size: 1.25rem; font-weight: 600; margin-bottom: 16px; color: #374151; }
        
        .progress-bar {
            background: #E5E7EB;
            height: 12px;
            border-radius: 6px;
            overflow: hidden;
            position: relative;
            margin-bottom: 12px;
        }
        
        .progress-fill {
            background: ${goalColor};
            height: 100%;
            width: ${Math.min(goalProgress, 100)}%;
            border-radius: 6px;
            transition: width 0.3s ease;
        }
        
        .progress-text { 
            font-weight: 600; 
            color: #374151;
        }
        
        .metrics-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); 
            gap: 20px; 
            margin: 32px 0; 
        }
        
        .metric-card { 
            background: #ffffff;
            border: 1px solid #E5E7EB;
            border-radius: 12px; 
            padding: 24px; 
            text-align: center;
            transition: all 0.2s ease;
            position: relative;
            overflow: hidden;
        }
        
        .metric-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
        }
        
        .metric-icon { 
            font-size: 2rem; 
            margin-bottom: 12px;
            display: block;
        }
        
        .metric-number { 
            font-size: 2.5rem; 
            font-weight: 800; 
            margin-bottom: 8px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .metric-label { 
            color: #6B7280; 
            font-size: 0.875rem; 
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        
        .metric-sublabel {
            color: #9CA3AF;
            font-size: 0.75rem;
            margin-top: 4px;
        }
        
        .section { 
            margin: 40px 0; 
        }
        
        .section-title { 
            font-size: 1.5rem; 
            font-weight: 700; 
            margin-bottom: 20px; 
            color: #1F2937;
            border-bottom: 2px solid #E5E7EB;
            padding-bottom: 8px;
        }
        
        .error-list { 
            background: #FEF2F2; 
            border: 1px solid #FECACA; 
            border-radius: 12px; 
            padding: 20px;
        }
        
        .error-item { 
            background: #ffffff;
            border-left: 4px solid #EF4444;
            padding: 16px; 
            margin: 8px 0; 
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        
        .error-time { 
            font-weight: 600; 
            color: #DC2626; 
            font-size: 0.875rem;
            margin-bottom: 4px;
        }
        
        .error-message { 
            color: #374151; 
            font-size: 0.875rem;
        }
        
        .success-message {
            background: #F0FDF4;
            border: 1px solid #BBF7D0;
            color: #166534;
            padding: 24px;
            border-radius: 12px;
            text-align: center;
            font-size: 1.125rem;
            font-weight: 600;
        }
        
        .footer { 
            background: #F9FAFB;
            text-align: center; 
            padding: 24px;
            border-top: 1px solid #E5E7EB;
            color: #6B7280; 
            font-size: 0.875rem;
        }
        
        .footer-stats {
            display: flex;
            justify-content: center;
            gap: 24px;
            margin-bottom: 12px;
            flex-wrap: wrap;
        }
        
        .footer-stat {
            background: #ffffff;
            padding: 8px 16px;
            border-radius: 8px;
            border: 1px solid #E5E7EB;
            font-weight: 500;
        }
        
        .hourly-timeline {
            background: #ffffff;
            border-radius: 12px;
            padding: 24px;
            border: 1px solid #E5E7EB;
            margin-bottom: 20px;
        }
        
        .timeline-grid {
            display: grid;
            grid-template-columns: repeat(24, 1fr);
            gap: 4px;
            margin-bottom: 16px;
        }
        
        .hour-block {
            text-align: center;
            position: relative;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .hour-dot {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            margin: 0 auto 4px;
            position: relative;
            transition: all 0.2s ease;
        }
        
        .hour-dot.success { background: #10B981; box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2); }
        .hour-dot.failure { background: #EF4444; box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2); }
        .hour-dot.mixed { 
            background: linear-gradient(45deg, #10B981 50%, #EF4444 50%); 
            box-shadow: 0 0 0 2px rgba(251, 191, 36, 0.2); 
        }
        .hour-dot.running { background: #3B82F6; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2); }
        .hour-dot.inactive { background: #E5E7EB; }
        
        .hour-dot.active {
            transform: scale(1.3);
            box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3);
        }
        
        .hour-label {
            font-size: 0.7rem;
            color: #6B7280;
            font-weight: 500;
        }
        
        .hour-block:hover .hour-dot {
            transform: scale(1.2);
        }
        
        .hour-tooltip {
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            background: #1F2937;
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 0.75rem;
            white-space: nowrap;
            z-index: 1000;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s ease;
            margin-bottom: 8px;
        }
        
        .hour-tooltip::after {
            content: '';
            position: absolute;
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 4px solid transparent;
            border-right: 4px solid transparent;
            border-top: 4px solid #1F2937;
        }
        
        .hour-block:hover .hour-tooltip {
            opacity: 1;
        }
        
        .timeline-legend {
            display: flex;
            justify-content: center;
            gap: 24px;
            flex-wrap: wrap;
            margin-top: 16px;
        }
        
        .legend-item {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 0.875rem;
            color: #374151;
        }
        
        .legend-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
        }
        
        .legend-dot.success { background: #10B981; }
        .legend-dot.failure { background: #EF4444; }
        .legend-dot.mixed { background: linear-gradient(45deg, #10B981 50%, #EF4444 50%); }
        .legend-dot.running { background: #3B82F6; }
        .legend-dot.inactive { background: #E5E7EB; }
        
        .timeline-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 12px;
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid #E5E7EB;
        }
        
        .timeline-stat {
            text-align: center;
        }
        
        .timeline-stat-number {
            font-size: 1.25rem;
            font-weight: 700;
            color: #1F2937;
        }
        
        .timeline-stat-label {
            font-size: 0.75rem;
            color: #6B7280;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        
        @media (max-width: 600px) {
            .metrics-grid { grid-template-columns: 1fr; }
            .header h1 { font-size: 2rem; }
            .content { padding: 24px 20px; }
            .footer-stats { flex-direction: column; gap: 8px; }
            .timeline-grid { gap: 2px; }
            .hour-dot { width: 16px; height: 16px; }
            .hour-label { font-size: 0.6rem; }
            .timeline-legend { gap: 16px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-content">
                <h1>📊 Rapport Quotidien</h1>
                <h2>Promote Post Parrainage</h2>
                <div class="header-date">${new Date(stats.date).toLocaleDateString('fr-FR', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                })}</div>
            </div>
        </div>

        <div class="status-banner">
            <div class="status-content">
                <div class="status-icon">${statusIcon}</div>
                <div class="status-text">SYSTÈME ${statusText}</div>
                <div class="status-rate">Taux de succès: ${stats.successRate}%</div>
            </div>
        </div>

        <div class="content">
            <div class="goal-section">
                <div class="goal-title">Objectif Quotidien</div>
                <div class="progress-bar">
                    <div class="progress-fill"></div>
                </div>
                <div class="progress-text">
                    ${stats.postsProcessed} / ${stats.dailyGoal} posts traités (${goalProgress}%)
                </div>
            </div>

            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-icon">🚀</div>
                    <div class="metric-number">${stats.scriptExecutions}</div>
                    <div class="metric-label">Exécutions</div>
                    <div class="metric-sublabel">${stats.successfulExecutions} succès, ${stats.failedExecutions} échecs</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-icon">📝</div>
                    <div class="metric-number">${stats.postsEdited}</div>
                    <div class="metric-label">Posts Édités</div>
                    <div class="metric-sublabel">Taux de succès: ${stats.editingSuccessRate.toFixed(1)}%</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-icon">⚡</div>
                    <div class="metric-number">${stats.postsBoosted}</div>
                    <div class="metric-label">Posts Boostés</div>
                    <div class="metric-sublabel">Taux de succès: ${stats.boostingSuccessRate.toFixed(1)}%</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-icon">🎯</div>
                    <div class="metric-number">${stats.postsPromoted}</div>
                    <div class="metric-label">Total Promus</div>
                    <div class="metric-sublabel">${stats.totalInteractions} interactions</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-icon">⏱️</div>
                    <div class="metric-number">${stats.avgExecutionTime}s</div>
                    <div class="metric-label">Temps Moyen</div>
                    <div class="metric-sublabel">Performance globale</div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-icon">🌐</div>
                    <div class="metric-number">${stats.browserLaunches}</div>
                    <div class="metric-label">Navigateur</div>
                    <div class="metric-sublabel">${stats.sessionErrors} erreurs session</div>
                </div>
            </div>

            <div class="section">
                <div class="section-title">⏰ Activité par Heure</div>
                <div class="hourly-timeline">
                    ${this.generateHourlyTimeline(stats.hourlyActivity)}
                </div>
                <div class="timeline-legend">
                    <div class="legend-item">
                        <div class="legend-dot success"></div>
                        <span>Succès</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-dot failure"></div>
                        <span>Échec</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-dot mixed"></div>
                        <span>Mixte</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-dot running"></div>
                        <span>En cours</span>
                    </div>
                    <div class="legend-item">
                        <div class="legend-dot inactive"></div>
                        <span>Inactif</span>
                    </div>
                </div>
            </div>

            ${stats.recentErrors.length > 0 ? `
            <div class="section">
                <div class="section-title">🚨 Incidents Récents</div>
                <div class="error-list">
                    ${stats.recentErrors.map(error => `
                        <div class="error-item">
                            <div class="error-time">${new Date(error.timestamp).toLocaleString('fr-FR')}</div>
                            <div class="error-message">${error.error}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : `
            <div class="section">
                <div class="success-message">
                    ✅ Aucun incident récent - Système fonctionnel
                </div>
            </div>
            `}
        </div>

        <div class="footer">
            <div class="footer-stats">
                <div class="footer-stat">Temps d'activité: ${stats.uptimeHours}h</div>
                <div class="footer-stat">CSRF Errors: ${stats.csrfErrors}</div>
                <div class="footer-stat">Connection Errors: ${stats.connectionErrors}</div>
            </div>
            <div>
                Dernière exécution: ${stats.lastExecutionTime ? new Date(stats.lastExecutionTime).toLocaleString('fr-FR') : 'Aucune'}<br>
                Rapport généré automatiquement • Promote Post Parrainage v2.0
            </div>
        </div>
    </div>
</body>
</html>`;
    }

    // Générer le timeline horaire
    generateHourlyTimeline(hourlyActivity) {
        const currentHour = new Date().getHours();
        let timelineHTML = '<div class="timeline-grid">';
        
        for (let hour = 0; hour < 24; hour++) {
            const hourData = hourlyActivity[hour];
            const isCurrentHour = hour === currentHour;
            const hourDisplay = hour.toString().padStart(2, '0');
            
            // Créer le tooltip avec les détails
            const tooltip = `
                <div class="hour-tooltip">
                    ${hourDisplay}h: ${hourData.executions} exec, 
                    ${hourData.successes} ✓, ${hourData.failures} ✗
                    ${hourData.postsProcessed > 0 ? `<br>${hourData.postsProcessed} posts traités` : ''}
                </div>
            `;
            
            timelineHTML += `
                <div class="hour-block">
                    <div class="hour-dot ${hourData.status} ${isCurrentHour ? 'active' : ''}"></div>
                    <div class="hour-label">${hourDisplay}</div>
                    ${tooltip}
                </div>
            `;
        }
        
        timelineHTML += '</div>';
        
        // Ajouter les statistiques du timeline
        const totalActiveHours = Object.values(hourlyActivity).filter(h => h.status !== 'inactive').length;
        const successHours = Object.values(hourlyActivity).filter(h => h.status === 'success').length;
        const failureHours = Object.values(hourlyActivity).filter(h => h.status === 'failure').length;
        const mixedHours = Object.values(hourlyActivity).filter(h => h.status === 'mixed').length;
        
        timelineHTML += `
            <div class="timeline-stats">
                <div class="timeline-stat">
                    <div class="timeline-stat-number">${totalActiveHours}</div>
                    <div class="timeline-stat-label">Heures actives</div>
                </div>
                <div class="timeline-stat">
                    <div class="timeline-stat-number" style="color: #10B981;">${successHours}</div>
                    <div class="timeline-stat-label">Succès</div>
                </div>
                <div class="timeline-stat">
                    <div class="timeline-stat-number" style="color: #EF4444;">${failureHours}</div>
                    <div class="timeline-stat-label">Échecs</div>
                </div>
                <div class="timeline-stat">
                    <div class="timeline-stat-number" style="color: #F59E0B;">${mixedHours}</div>
                    <div class="timeline-stat-label">Mixtes</div>
                </div>
            </div>
        `;
        
        return timelineHTML;
    }

    // Envoyer le rapport quotidien
    async sendDailyReport() {
        if (!this.transporter) {
            logger.warn('Cannot send daily report - SMTP not configured');
            return;
        }

        if (process.env.DAILY_REPORT_ENABLED !== 'true') {
            logger.debug('Daily report disabled in configuration');
            return;
        }

        try {
            const stats = this.calculateStats();
            const htmlContent = this.generateReportHTML(stats);
            
            const mailOptions = {
                from: `"Promote Post Parrainage" <${process.env.SMTP_USER}>`,
                to: process.env.DAILY_REPORT_EMAIL,
                subject: `📊 Rapport Quotidien - ${stats.date} - Statut: ${stats.successRate >= 80 ? 'OK' : 'ATTENTION'}`,
                html: htmlContent,
                attachments: [
                    {
                        filename: `stats-${stats.date}.json`,
                        content: JSON.stringify(stats, null, 2),
                        contentType: 'application/json'
                    }
                ]
            };

            const info = await this.transporter.sendMail(mailOptions);
            logger.info('Daily report sent successfully', { messageId: info.messageId, to: process.env.DAILY_REPORT_EMAIL });
            
            // Réinitialiser les statistiques pour le jour suivant
            this.resetDailyStats();
            
        } catch (error) {
            logger.error('Failed to send daily report', { error: error.message, stack: error.stack });
        }
    }

    // Réinitialiser les statistiques quotidiennes
    resetDailyStats() {
        const previousStats = { ...this.stats };
        
        this.stats = {
            date: new Date().toISOString().split('T')[0],
            scriptExecutions: 0,
            successfulExecutions: 0,
            failedExecutions: 0,
            postsProcessed: 0,
            postsPromoted: 0,
            errors: [],
            executionTimes: [],
            browserLaunches: 0,
            sessionErrors: 0,
            lastExecutionTime: null,
            startTime: new Date()
        };

        logger.info('Daily stats reset', { previousStats: this.calculateStats() });
    }

    // Obtenir les statistiques actuelles
    getCurrentStats() {
        return this.calculateStats();
    }
}

// Instance singleton
const dailyReportService = new DailyReportService();

module.exports = dailyReportService;
