# Cómo subir CLIENTES4.0 a Git

El conector GitHub disponible en esta sesión permitió leer repositorios, pero no expuso herramienta de crear/editar/commitear archivos. Para subirlo manualmente:

```bash
cd C:\kargax2
mkdir CLIENTES4.0
# Copia los archivos de esta carpeta dentro de CLIENTES4.0
git add CLIENTES4.0
git commit -m "Add CLIENTES4.0 outbound lead package"
git push origin main
```

Archivo principal recomendado:
- CLIENTES4.0/CLIENTES4.0.xlsx
- CLIENTES4.0/README_CLIENTES4.0.md
- CLIENTES4.0/01_leads_priorizados.csv
- CLIENTES4.0/02_analisis_por_lead.md
- CLIENTES4.0/03_mensajes_por_lead.md
- CLIENTES4.0/04_plan_7_dias_scripts.md
