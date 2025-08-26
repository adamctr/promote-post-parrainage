#!/usr/bin/env node

/**
 * Script de nettoyage avancé des logs
 * - Supprime tous les logs de plus de 48h
 * - Compresse les logs récents volumineux
 * - Nettoie les fichiers temporaires
 * - Affiche des statistiques détaillées
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LOGS_DIR = path.join(__dirname, 'logs');
const MAX_AGE_HOURS = 48;
const MAX_FILE_SIZE_MB = 10; // Comprimer les fichiers > 10MB
const MAX_AGE_MS = MAX_AGE_HOURS * 60 * 60 * 1000;

class LogCleaner {
    constructor() {
        this.stats = {
            filesScanned: 0,
            filesDeleted: 0,
            filesCompressed: 0,
            spaceCleaned: 0,
            errors: 0
        };
    }

    formatSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    formatAge(ageMs) {
        const hours = Math.floor(ageMs / (1000 * 60 * 60));
        const minutes = Math.floor((ageMs % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m`;
    }

    async compressFile(filePath) {
        try {
            const compressedPath = `${filePath}.gz`;
            if (fs.existsSync(compressedPath)) {
                return false; // Déjà compressé
            }

            if (process.platform === 'win32') {
                // Windows: utiliser PowerShell pour compression
                execSync(`powershell -Command "& {gzip '${filePath}'}"`, { stdio: 'pipe' });
            } else {
                // Linux/Mac: utiliser gzip
                execSync(`gzip "${filePath}"`, { stdio: 'pipe' });
            }
            
            return true;
        } catch (error) {
            console.error(`❌ Erreur compression ${path.basename(filePath)}:`, error.message);
            this.stats.errors++;
            return false;
        }
    }

    async cleanLogs() {
        console.log('🧹 Démarrage du nettoyage avancé des logs...\n');
        
        if (!fs.existsSync(LOGS_DIR)) {
            console.log('📁 Dossier logs inexistant, création...');
            fs.mkdirSync(LOGS_DIR, { recursive: true });
            return;
        }

        const now = new Date();
        const files = fs.readdirSync(LOGS_DIR);
        
        console.log(`📊 Analyse de ${files.length} fichiers dans ${LOGS_DIR}\n`);

        for (const file of files) {
            try {
                const filePath = path.join(LOGS_DIR, file);
                const stats = fs.statSync(filePath);
                
                this.stats.filesScanned++;
                
                // Ignorer les dossiers et fichiers système
                if (stats.isDirectory() || file === 'audit.json' || file === '.gitkeep') {
                    continue;
                }

                const age = now - stats.mtime;
                const sizeBytes = stats.size;
                const sizeMB = sizeBytes / (1024 * 1024);
                
                console.log(`📄 ${file}:`);
                console.log(`   📅 Âge: ${this.formatAge(age)}`);
                console.log(`   📏 Taille: ${this.formatSize(sizeBytes)}`);

                // Supprimer si trop ancien (> 48h)
                if (age > MAX_AGE_MS) {
                    try {
                        fs.unlinkSync(filePath);
                        this.stats.filesDeleted++;
                        this.stats.spaceCleaned += sizeBytes;
                        console.log(`   🗑️ SUPPRIMÉ (trop ancien)`);
                    } catch (err) {
                        console.log(`   ❌ ERREUR SUPPRESSION: ${err.message}`);
                        this.stats.errors++;
                    }
                }
                // Comprimer si gros et récent (< 48h mais > 10MB)
                else if (sizeMB > MAX_FILE_SIZE_MB && !file.endsWith('.gz')) {
                    const compressed = await this.compressFile(filePath);
                    if (compressed) {
                        this.stats.filesCompressed++;
                        console.log(`   🗜️ COMPRESSÉ`);
                    } else {
                        console.log(`   ⚠️ Compression ignorée`);
                    }
                }
                else {
                    console.log(`   ✅ CONSERVÉ`);
                }
                
                console.log('');
                
            } catch (error) {
                console.error(`❌ Erreur traitement ${file}:`, error.message);
                this.stats.errors++;
            }
        }

        this.displaySummary();
    }

    displaySummary() {
        console.log('=' * 50);
        console.log('📈 RAPPORT DE NETTOYAGE');
        console.log('=' * 50);
        console.log(`📁 Fichiers analysés: ${this.stats.filesScanned}`);
        console.log(`🗑️ Fichiers supprimés: ${this.stats.filesDeleted}`);
        console.log(`🗜️ Fichiers compressés: ${this.stats.filesCompressed}`);
        console.log(`💾 Espace libéré: ${this.formatSize(this.stats.spaceCleaned)}`);
        console.log(`❌ Erreurs: ${this.stats.errors}`);
        console.log(`⏰ Politique: Garder ${MAX_AGE_HOURS}h maximum`);
        console.log(`📏 Compression: Fichiers > ${MAX_FILE_SIZE_MB}MB`);
        
        if (this.stats.errors === 0) {
            console.log('\n✅ Nettoyage terminé avec succès!');
        } else {
            console.log(`\n⚠️ Nettoyage terminé avec ${this.stats.errors} erreur(s)`);
        }
    }
}

// Exécution si appelé directement
if (require.main === module) {
    const cleaner = new LogCleaner();
    cleaner.cleanLogs().catch(error => {
        console.error('💥 Erreur fatale:', error);
        process.exit(1);
    });
}

module.exports = LogCleaner;
