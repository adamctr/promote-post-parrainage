require('dotenv').config();
const dailyReportService = require('./dailyReportService');
const reportScheduler = require('./reportScheduler');
const logger = require('./logger');

async function testDailyReport() {
    console.log('🧪 Test du système de rapport quotidien...\n');
    
    // Simuler quelques statistiques
    console.log('📊 Simulation des statistiques...');
    
    // Simuler des données horaires variées pour une journée complète
    const now = new Date();
    const originalHour = now.getHours();
    
    // Simuler l'activité de différentes heures
    const simulateHourlyData = [
        { hour: 8, successes: 2, failures: 0, posts: 8 },
        { hour: 9, successes: 1, failures: 1, posts: 4 },
        { hour: 10, successes: 3, failures: 0, posts: 12 },
        { hour: 14, successes: 1, failures: 0, posts: 6 },
        { hour: 15, successes: 0, failures: 1, posts: 0 },
        { hour: 16, successes: 2, failures: 1, posts: 10 },
        { hour: originalHour, successes: 1, failures: 0, posts: 3 } // Heure actuelle
    ];
    
    // Appliquer les données simulées
    simulateHourlyData.forEach(({ hour, successes, failures, posts }) => {
        // Simuler l'heure en modifiant temporairement getHours()
        const originalGetHours = Date.prototype.getHours;
        Date.prototype.getHours = function() { return hour; };
        
        for (let i = 0; i < successes; i++) {
            dailyReportService.recordExecutionStart();
            dailyReportService.recordExecutionSuccess(posts / successes, posts / successes, 10000 + Math.random() * 10000);
        }
        
        for (let i = 0; i < failures; i++) {
            dailyReportService.recordExecutionStart();
            dailyReportService.recordExecutionFailure(new Error(`Test: Erreur à ${hour}h`), 5000 + Math.random() * 5000);
        }
        
        // Restaurer la méthode originale
        Date.prototype.getHours = originalGetHours;
    });
    
    // Ajouter les données actuelles
    dailyReportService.recordExecutionStart();
    dailyReportService.recordExecutionSuccess(5, 3, 15000);
    
    // Simuler les nouvelles statistiques détaillées
    dailyReportService.recordPostsEdited(8, 7); // 8 posts édités, 7 avec succès
    dailyReportService.recordPostsBoosted(6, 5); // 6 posts boostés, 5 avec succès
    
    // Simuler différents types d'erreurs
    dailyReportService.recordSessionError(new Error('Test: Token CSRF invalide'));
    dailyReportService.recordSessionError(new Error('Test: Connection timeout'));
    dailyReportService.recordBrowserLaunch();
    dailyReportService.recordBrowserLaunch();
    
    console.log('✅ Statistiques simulées générées\n');
    
    // Afficher les statistiques actuelles
    const stats = dailyReportService.getCurrentStats();
    console.log('📈 Statistiques actuelles:');
    console.log(`   • Exécutions: ${stats.scriptExecutions} (${stats.successfulExecutions} succès, ${stats.failedExecutions} échecs)`);
    console.log(`   • Taux de succès: ${stats.successRate}%`);
    console.log(`   • Posts traités: ${stats.postsProcessed}`);
    console.log(`   • Posts promus: ${stats.postsPromoted}`);
    console.log(`   • Posts édités: ${stats.postsEdited} (${stats.editingSuccessRate.toFixed(1)}% succès)`);
    console.log(`   • Posts boostés: ${stats.postsBoosted} (${stats.boostingSuccessRate.toFixed(1)}% succès)`);
    console.log(`   • Interactions totales: ${stats.totalInteractions}`);
    console.log(`   • Erreurs de session: ${stats.sessionErrors} (${stats.csrfErrors} CSRF, ${stats.connectionErrors} connexion)`);
    console.log(`   • Lancements navigateur: ${stats.browserLaunches}`);
    console.log(`   • Temps moyen d'exécution: ${stats.avgExecutionTime}s`);
    console.log(`   • Objectif quotidien: ${stats.postsProcessed}/${stats.dailyGoal} (${((stats.postsProcessed/stats.dailyGoal)*100).toFixed(1)}%)\n`);
    
    // Vérifier la configuration
    console.log('⚙️  Configuration email:');
    console.log(`   • SMTP Host: ${process.env.SMTP_HOST || 'NON CONFIGURÉ'}`);
    console.log(`   • SMTP User: ${process.env.SMTP_USER || 'NON CONFIGURÉ'}`);
    console.log(`   • Email destinataire: ${process.env.DAILY_REPORT_EMAIL || 'NON CONFIGURÉ'}`);
    console.log(`   • Rapport activé: ${process.env.DAILY_REPORT_ENABLED || 'false'}`);
    console.log(`   • Heure programmée: ${process.env.DAILY_REPORT_TIME || '19:30'}\n`);
    
    // Vérifier les prochaines programmations
    const nextSchedules = reportScheduler.getNextSchedules();
    console.log('⏰ Prochaines exécutions programmées (heure de Paris):');
    Object.entries(nextSchedules).forEach(([name, date]) => {
        if (date) {
            const parisTime = new Date(date).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
            console.log(`   • ${name}: ${parisTime} (Paris)`);
        } else {
            console.log(`   • ${name}: Non programmé`);
        }
    });
    console.log(`   • Heure actuelle à Paris: ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}`);
    console.log('');
    
    // Tenter d'envoyer le rapport
    console.log('📧 Tentative d\'envoi du rapport...');
    try {
        await reportScheduler.sendImmediateReport();
        console.log('✅ Rapport envoyé avec succès!');
        console.log(`📮 Email envoyé à: ${process.env.DAILY_REPORT_EMAIL}`);
    } catch (error) {
        console.log('❌ Erreur lors de l\'envoi du rapport:');
        console.log(`   • Message: ${error.message}`);
        
        if (error.message.includes('SMTP')) {
            console.log('\n💡 Conseils de dépannage:');
            console.log('   • Vérifiez les paramètres SMTP dans votre fichier .env');
            console.log('   • Assurez-vous que DAILY_REPORT_ENABLED=true');
            console.log('   • Vérifiez les identifiants SMTP et le mot de passe');
        }
    }
    
    console.log('\n🏁 Test terminé');
    process.exit(0);
}

// Exécuter le test
testDailyReport().catch(error => {
    console.error('❌ Erreur critique durant le test:', error);
    process.exit(1);
});
