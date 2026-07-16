#!/bin/bash
# Script de construcción para Vercel (OAFForos)

# Crear la carpeta de salida 'dist'
echo "Creando carpeta dist/..."
mkdir -p dist

# Copiar archivos estáticos y carpetas necesarias
echo "Copiando archivos estáticos..."
cp -r css dist/
cp -r js dist/
cp index.html dist/

# Generar el archivo dist/js/config.js con las variables de entorno de Vercel
echo "Generando dist/js/config.js..."
echo "// Archivo generado automáticamente durante el build de Vercel" > dist/js/config.js
echo "export const SUPABASE_URL = \"\${SUPABASE_URL}\";" >> dist/js/config.js
echo "export const SUPABASE_ANON_KEY = \"\${SUPABASE_ANON_KEY}\";" >> dist/js/config.js

echo "Build completado con éxito."
