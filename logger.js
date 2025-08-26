const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const { combine, timestamp, json, colorize, simple, printf, splat } = format;
const path = require('path');

// Niveau de log par défaut (debug pour un maximum de détails, peut être overridé par la variable d'environnement)
const consoleloggerLevel = process.env.WINSTON_LOGGER_LEVEL || "debug";

// Custom format for console logs with colorization and pretty printing
const consoleFormat = combine(
    colorize(),
    splat(),
    simple(),
    printf(({ level, message, timestamp }) => {
        if (typeof message === 'object') {
            message = JSON.stringify(message, null, 4);
        }
        return `${timestamp} ${level}: ${message}`;
    })
);

// Custom timestamp format for all log entries (timezone Paris)
const customTimestamp = timestamp({
    format: () => {
        return new Date().toLocaleString('fr-FR', { 
            timeZone: 'Europe/Paris',
            year: 'numeric',
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).replace(/(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2})/, '$3-$2-$1 $4:$5');
    }
});

// Configuration de rotation : 48h maximum
const rotateConfig = {
    maxFiles: '2d',  // Garder seulement 2 jours (48h)
    maxSize: '50m',  // Taille maximum par fichier : 50MB
    datePattern: 'YYYY-MM-DD-HH', // Rotation toutes les heures
    zippedArchive: true, // Comprimer les anciens logs
    auditFile: path.join('logs', 'audit.json') // Fichier d'audit pour tracking
};

// Create a logger instance
const logger = createLogger({
    level: consoleloggerLevel, // Minimum log level
    format: combine(
        customTimestamp,  // Apply the custom timestamp format
    ),
    transports: [
        // Console transport - pas de rotation nécessaire
        new transports.Console({
            level: consoleloggerLevel,
            format: consoleFormat
        }),
        
        // Transport avec rotation - LOGS COMBINÉS (48h max)
        new DailyRotateFile({
            filename: path.join('logs', 'combined-%DATE%.log'),
            level: 'debug',
            format: combine(customTimestamp, json()),
            ...rotateConfig
        }),
        
        // Transport avec rotation - ERREURS SEULEMENT (48h max)
        new DailyRotateFile({
            filename: path.join('logs', 'error-%DATE%.log'),
            level: 'error',
            format: combine(customTimestamp, json()),
            ...rotateConfig
        }),
        
        // Transport avec rotation - STATISTIQUES QUOTIDIENNES (48h max)
        new DailyRotateFile({
            filename: path.join('logs', 'stats-%DATE%.log'),
            level: 'info',
            format: combine(customTimestamp, json()),
            handleExceptions: false,
            ...rotateConfig
        })
    ]
});

// Événements de rotation automatique pour monitoring
logger.transports.forEach(transport => {
    if (transport instanceof DailyRotateFile) {
        transport.on('rotate', (oldFilename, newFilename) => {
            console.log(`📁 Log rotated: ${oldFilename} → ${newFilename}`);
        });
        
        transport.on('archive', (zipFilename) => {
            console.log(`🗜️ Log archived: ${zipFilename}`);
        });
        
        transport.on('logRemoved', (removedFilename) => {
            console.log(`🗑️ Old log removed: ${removedFilename}`);
        });
    }
});

// Nettoyage automatique au démarrage (sécurité)
const fs = require('fs');
const cleanOldLogs = () => {
    const logsDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logsDir)) return;
    
    const now = new Date();
    const maxAge = 48 * 60 * 60 * 1000; // 48 heures en millisecondes
    
    try {
        const files = fs.readdirSync(logsDir);
        let cleanedCount = 0;
        
        files.forEach(file => {
            const filePath = path.join(logsDir, file);
            const stats = fs.statSync(filePath);
            
            // Supprimer les fichiers de plus de 48h (sauf audit.json)
            if (file !== 'audit.json' && (now - stats.mtime) > maxAge) {
                try {
                    fs.unlinkSync(filePath);
                    cleanedCount++;
                    console.log(`🧹 Ancien log supprimé: ${file}`);
                } catch (err) {
                    console.error(`❌ Erreur suppression ${file}:`, err.message);
                }
            }
        });
        
        if (cleanedCount > 0) {
            console.log(`✅ Nettoyage terminé: ${cleanedCount} anciens logs supprimés`);
        }
    } catch (error) {
        console.error('❌ Erreur lors du nettoyage des logs:', error.message);
    }
};

// Lancer le nettoyage au démarrage
cleanOldLogs();

// Programmer un nettoyage automatique toutes les 6 heures
setInterval(cleanOldLogs, 6 * 60 * 60 * 1000);

module.exports = logger;
