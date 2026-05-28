# Prompts IA — Last Mile KargaX

## Prompt frontend

Actúa como senior frontend engineer de KargaX. Revisa `frontend/src/components/last-mile/LastMileExplainer.tsx` y confirma que no rompe UI, que el copy está en español claro, que no toca wallet/billing/RLS y que los props coinciden con `LastMileDashboardResponse`.

## Prompt QA

Actúa como QA enterprise. Prueba `/dashboard/control-margen` con una empresa que tiene 26 viajes y 0 snapshots. Valida que el usuario entienda qué hace Last Mile, qué debe hacer y qué NO modifica el recalcular.

## Prompt seguridad

Actúa como arquitecto Supabase. Audita que las tablas `last_mile_*` y queries server-side filtren por `business_id`. No propongas cambios sin citar archivo, tabla y política exacta.

## Prompt producto

Actúa como product-minded CEO. Evalúa si el copy “Last Mile convierte viajes en decisiones” aumenta activación y reduce tickets de soporte para empresas con viajes pero sin análisis.
