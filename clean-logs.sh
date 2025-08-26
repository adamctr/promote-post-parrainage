#!/bin/bash

# Script de nettoyage des logs optimisé (48h maximum)
echo "🧹 Nettoyage optimisé des logs (48h max)..."

# Vérifier si Node.js est disponible pour le nettoyage avancé
if command -v node >/dev/null 2>&1; then
    echo "🚀 Utilisation du nettoyage avancé Node.js..."
    node clean-logs-advanced.js
    exit $?
fi

# Fallback : nettoyage basique si Node.js non disponible
echo "⚠️ Node.js non disponible, nettoyage basique..."

if [ ! -d "logs" ]; then
    echo "📁 Création du dossier logs..."
    mkdir -p logs
    exit 0
fi

# Supprimer les logs de plus de 2 jours (48h)
echo "🗑️ Suppression des logs > 48h..."
find logs/ -name "*.log" -type f -mtime +2 -delete
find logs/ -name "*.gz" -type f -mtime +2 -delete

# Conserver audit.json
find logs/ -name "audit.json" -type f -mtime +2 -exec touch {} \;

echo "✅ Nettoyage basique terminé."
