#!/usr/bin/env node

/**
 * Affiche des informations sur les logs actuels
 */

const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, 'logs');

function formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function formatAge(ageMs) {
    const hours = Math.floor(ageMs / (1000 * 60 * 60));
    const minutes = Math.floor((ageMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
}

console.log('📊 ÉTAT DES LOGS SYSTÈME\n');

if (!fs.existsSync(LOGS_DIR)) {
    console.log('❌ Aucun dossier logs trouvé');
    console.log('💡 Les logs seront créés au premier démarrage de l\'application\n');
    return;
}

try {
    const files = fs.readdirSync(LOGS_DIR);
    
    if (files.length === 0) {
        console.log('📁 Dossier logs vide\n');
        return;
    }
    
    console.log(`📁 Dossier: ${LOGS_DIR}`);
    console.log(`📊 Nombre de fichiers: ${files.length}\n`);
    
    let totalSize = 0;
    let oldFiles = 0;
    const MAX_AGE = 48 * 60 * 60 * 1000; // 48h en ms
    
    console.log('📄 Détails des fichiers:');
    console.log('   Nom                    | Taille  | Âge     | État');
    console.log('   -'.repeat(55));
    
    files.forEach(file => {
        try {
            const filePath = path.join(LOGS_DIR, file);
            const stats = fs.statSync(filePath);
            const size = stats.size;
            const age = Date.now() - stats.mtime;
            
            totalSize += size;
            
            let status = '✅ OK';
            if (age > MAX_AGE) {
                status = '🕐 Ancien (>48h)';
                oldFiles++;
            } else if (size > 10 * 1024 * 1024) { // >10MB
                status = '📏 Volumineux';
            }
            
            const fileName = file.padEnd(22, ' ');
            const fileSize = formatSize(size).padEnd(7, ' ');
            const fileAge = formatAge(age).padEnd(7, ' ');
            
            console.log(`   ${fileName} | ${fileSize} | ${fileAge} | ${status}`);
            
        } catch (error) {
            console.log(`   ${file.padEnd(22, ' ')} | ERROR   | ERROR   | ❌ Inaccessible`);
        }
    });
    
    console.log('   -'.repeat(55));
    console.log(`📈 Taille totale: ${formatSize(totalSize)}`);
    console.log(`⏰ Politique de rétention: 48 heures maximum`);
    
    if (oldFiles > 0) {
        console.log(`⚠️ ${oldFiles} fichier(s) ancien(s) détecté(s)`);
        console.log('💡 Exécutez "npm run clean-logs" pour nettoyer');
    } else {
        console.log('✅ Tous les logs respectent la politique de rétention');
    }
    
} catch (error) {
    console.error('❌ Erreur lors de l\'analyse:', error.message);
}

console.log('');
