require('dotenv').config();
const dailyReportService = require('./dailyReportService');
const reportScheduler = require('./reportScheduler');
const logger = require('./logger');

async function testDailyReport() {
    console.log('🧪 Test du système de rapport quotidien...\n');
    
    // Simuler quelques statistiques
    console.log('📊 Simulation des statistiques...');
    
    // Simuler des exécutions
    dailyReportService.recordExecutionStart();
    dailyReportService.recordExecutionSuccess(5, 3, 15000); // 5 posts traités, 3 promus, 15s
    
    dailyReportService.recordExecutionStart();
    dailyReportService.recordExecutionSuccess(7, 5, 12000); // 7 posts traités, 5 promus, 12s
    
    dailyReportService.recordExecutionStart();
    dailyReportService.recordExecutionFailure(new Error('Test: Connexion échouée'), 8000); // Échec après 8s
    
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
    console.log('⏰ Prochaines exécutions programmées:');
    Object.entries(nextSchedules).forEach(([name, date]) => {
        console.log(`   • ${name}: ${date ? new Date(date).toLocaleString('fr-FR') : 'Non programmé'}`);
    });
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
