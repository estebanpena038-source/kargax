'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { ExternalLink, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button, Input, Select, toast } from '@/components/ui';
import { SectionCard, WarehouseWorkspace } from '@/components/warehouses/WarehouseWorkspace';
import {
    WmsEmptyState,
    WmsCardGrid,
    WmsImageThumb,
    WmsMetric,
    WmsMetricGrid,
    WmsPanelGrid,
    WmsRiskNotice,
    WmsActionRow,
    WmsStatusBadge,
    WmsTextArea,
} from '@/components/warehouses/WarehouseExecutionLuxury';
import warehouseClient from '@/lib/warehouses/client';
import {
    formatWarehouseDateTime,
    getIncidentSeverityLabel,
    getIncidentStatusLabel,
    getIncidentTypeLabel,
    getWarehouseActionLabel,
    mapWarehouseErrorMessage,
} from '@/lib/warehouses/localization';
import type { WarehouseIncident } from '@/lib/warehouses/types';

const INCIDENT_TYPES: WarehouseIncident['incident_type'][] = ['damage', 'shortage', 'delay', 'security', 'documentation', 'payment_hold', 'other'];
const INCIDENT_SEVERITIES: WarehouseIncident['severity'][] = ['low', 'medium', 'high', 'critical'];

function incidentTone(status: WarehouseIncident['status'], severity: WarehouseIncident['severity']) {
    if (severity === 'critical' && status !== 'closed' && status !== 'resolved') return 'critical' as const;
    if (status === 'resolved' || status === 'closed') return 'strong' as const;
    return 'neutral' as const;
}

function severityTone(severity: WarehouseIncident['severity']) {
    return severity === 'critical' ? 'critical' as const : severity === 'high' ? 'strong' as const : 'neutral' as const;
}

function sortIncidents(incidents: WarehouseIncident[]) {
    const severityRank: Record<WarehouseIncident['severity'], number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
    };
    const statusRank: Record<WarehouseIncident['status'], number> = {
        open: 0,
        investigating: 1,
        resolved: 2,
        closed: 3,
    };

    return [...incidents].sort((left, right) => {
        const byStatus = statusRank[left.status] - statusRank[right.status];
        if (byStatus !== 0) return byStatus;
        const bySeverity = severityRank[left.severity] - severityRank[right.severity];
        if (bySeverity !== 0) return bySeverity;
        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });
}

function isImageUrl(value: string) {
    return /\.(png|jpe?g|webp|gif|avif)(\?.*)?$/i.test(value);
}

function validateEvidenceUrl(value: string) {
    if (!value.trim()) return 'Agrega una URL de evidencia.';

    try {
        const parsed = new URL(value.trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return 'La evidencia debe usar http o https.';
        }
    } catch {
        return 'La evidencia debe ser una URL valida.';
    }

    return null;
}

export default function WarehouseIncidentsPage() {
    const params = useParams<{ id: string }>();
    const warehouseId = params?.id as string;
    const [saving, setSaving] = React.useState(false);
    const [processingId, setProcessingId] = React.useState<string | null>(null);
    const [formError, setFormError] = React.useState('');
    const [evidenceDraft, setEvidenceDraft] = React.useState('');
    const [reviewNoteByIncident, setReviewNoteByIncident] = React.useState<Record<string, string>>({});
    const [form, setForm] = React.useState({
        incidentType: 'damage' as WarehouseIncident['incident_type'],
        severity: 'medium' as WarehouseIncident['severity'],
        title: '',
        description: '',
        offerId: '',
        evidenceUrls: [] as string[],
    });

    const addEvidence = () => {
        const error = validateEvidenceUrl(evidenceDraft);
        if (error) {
            setFormError(error);
            return;
        }

        setFormError('');
        setForm((current) => ({
            ...current,
            evidenceUrls: Array.from(new Set([...current.evidenceUrls, evidenceDraft.trim()])),
        }));
        setEvidenceDraft('');
    };

    return (
        <DashboardLayout pageTitle="Incidentes">
            <WarehouseWorkspace
                warehouseId={warehouseId}
                section="incidents"
                renderSection={({ incidents, capabilities, reload }) => {
                    const openIncidents = incidents.filter((incident) => incident.status === 'open' || incident.status === 'investigating');
                    const criticalOpen = openIncidents.filter((incident) => incident.severity === 'critical');
                    const evidenceCount = incidents.reduce((sum, incident) => sum + (incident.evidence_urls?.length || 0), 0);
                    const sortedIncidents = sortIncidents(incidents);

                    const updateIncidentStatus = async (incident: WarehouseIncident, nextStatus: WarehouseIncident['status']) => {
                        const reviewNote = reviewNoteByIncident[incident.id]?.trim() || '';

                        if ((nextStatus === 'resolved' || nextStatus === 'closed') && incident.severity === 'critical' && reviewNote.length < 10) {
                            toast.warning('Revision requerida', 'Un riesgo critico necesita nota de soporte/admin antes de cerrar.');
                            return;
                        }

                        try {
                            setProcessingId(incident.id);
                            await warehouseClient.updateIncident(warehouseId, incident.id, {
                                status: nextStatus,
                                metadata: {
                                    ...incident.metadata,
                                    supportReviewNote: reviewNote || incident.metadata?.supportReviewNote,
                                    supportReviewedAt: reviewNote ? new Date().toISOString() : incident.metadata?.supportReviewedAt,
                                },
                            });
                            setReviewNoteByIncident((current) => ({ ...current, [incident.id]: '' }));
                            toast.success('Incidente actualizado', 'El estado quedo visible para operacion y soporte.');
                            await reload();
                        } catch (error) {
                            toast.error('Error', error instanceof Error ? mapWarehouseErrorMessage(error.message) : 'No se pudo actualizar el incidente');
                        } finally {
                            setProcessingId(null);
                        }
                    };

                    return (
                        <div className="space-y-6">
                            <WmsMetricGrid>
                                <WmsMetric label="Incidentes" value={incidents.length} detail="Historial operativo" />
                                <WmsMetric label="Abiertos" value={openIncidents.length} detail="Requieren seguimiento" />
                                <WmsMetric label="Criticos" value={criticalOpen.length} detail="No se esconden" />
                                <WmsMetric label="Evidencia" value={evidenceCount} detail="URLs asociadas" />
                            </WmsMetricGrid>

                            {criticalOpen.length ? (
                                <WmsRiskNotice
                                    critical
                                    title={`${criticalOpen.length} riesgo critico abierto`}
                                    description="Debe permanecer visible hasta que soporte/admin registre revision y estado de cierre."
                                />
                            ) : null}

                            <WmsPanelGrid aside="wide">
                                <SectionCard title="Registrar incidente" description="Tipo, severidad textual, evidencia y estado inicial sin ruido visual.">
                                    <div className="space-y-4">
                                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                                            <Select
                                                label="Tipo"
                                                value={form.incidentType}
                                                onChange={(value) => setForm((current) => ({ ...current, incidentType: value as WarehouseIncident['incident_type'] }))}
                                                options={INCIDENT_TYPES.map((value) => ({ value, label: getIncidentTypeLabel(value) }))}
                                            />
                                            <Select
                                                label="Severidad"
                                                value={form.severity}
                                                onChange={(value) => setForm((current) => ({ ...current, severity: value as WarehouseIncident['severity'] }))}
                                                options={INCIDENT_SEVERITIES.map((value) => ({ value, label: getIncidentSeverityLabel(value) }))}
                                            />
                                        </div>
                                        <Input label="Titulo" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Faltante en recepcion 1042" />
                                        <Input label="Viaje vinculado" value={form.offerId} onChange={(event) => setForm((current) => ({ ...current, offerId: event.target.value }))} placeholder="Opcional" />
                                        <WmsTextArea
                                            label="Descripcion"
                                            value={form.description}
                                            onChange={(value) => setForm((current) => ({ ...current, description: value }))}
                                            placeholder="Describe el hecho, el riesgo, el SKU o la etapa afectada."
                                            minHeight={132}
                                        />

                                        <div className="min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                                            <p className="text-sm font-semibold text-zinc-950">Evidencia</p>
                                            <p className="mt-1 text-xs text-zinc-500">Agrega URLs de foto, documento o soporte. Quedan asociadas al incidente.</p>
                                                <div className="mt-3 flex min-w-0 flex-col gap-3 sm:flex-row">
                                                <Input
                                                    label=""
                                                    value={evidenceDraft}
                                                    onChange={(event) => setEvidenceDraft(event.target.value)}
                                                    placeholder="https://..."
                                                />
                                                <Button variant="outline" leftIcon={<Plus className="h-4 w-4" />} onClick={addEvidence}>
                                                    Agregar
                                                </Button>
                                            </div>
                                            {form.evidenceUrls.length ? (
                                                <div className="mt-3 space-y-2">
                                                    {form.evidenceUrls.map((url) => (
                                                        <div key={url} className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2">
                                                            <p className="truncate text-sm text-zinc-600">{url}</p>
                                                            <button
                                                                type="button"
                                                                className="rounded-md border border-zinc-200 p-2 text-zinc-500 transition hover:border-zinc-950 hover:text-zinc-950"
                                                                aria-label="Quitar evidencia"
                                                                onClick={() => setForm((current) => ({
                                                                    ...current,
                                                                    evidenceUrls: current.evidenceUrls.filter((item) => item !== url),
                                                                }))}
                                                            >
                                                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </div>

                                        {formError ? <p className="text-sm font-medium text-zinc-950">{formError}</p> : null}
                                        <Button
                                            fullWidth
                                            isLoading={saving}
                                            disabled={!capabilities?.manageIncidents}
                                            onClick={async () => {
                                                setFormError('');

                                                if (!form.title.trim() || !form.description.trim()) {
                                                    setFormError('Titulo y descripcion son obligatorios para revisar el incidente.');
                                                    return;
                                                }

                                                if (form.severity === 'critical' && !form.evidenceUrls.length) {
                                                    setFormError('Un incidente critico necesita evidencia antes de reportarse.');
                                                    return;
                                                }

                                                setSaving(true);
                                                try {
                                                    await warehouseClient.createIncident(warehouseId, {
                                                        incidentType: form.incidentType,
                                                        severity: form.severity,
                                                        title: form.title.trim(),
                                                        description: form.description.trim(),
                                                        offerId: form.offerId.trim() || undefined,
                                                        evidenceUrls: form.evidenceUrls,
                                                        metadata: {
                                                            source: 'warehouse_execution_incidents',
                                                        },
                                                    });
                                                    setForm({ incidentType: 'damage', severity: 'medium', title: '', description: '', offerId: '', evidenceUrls: [] });
                                                    setEvidenceDraft('');
                                                    toast.success('Incidente reportado', 'El riesgo quedo visible para revision.');
                                                    await reload();
                                                } catch (error) {
                                                    toast.error('Error', error instanceof Error ? mapWarehouseErrorMessage(error.message) : 'No se pudo reportar el incidente');
                                                } finally {
                                                    setSaving(false);
                                                }
                                            }}
                                        >
                                            Reportar incidente
                                        </Button>
                                    </div>
                                </SectionCard>

                                <SectionCard title="Revision de incidentes" description="Severidad, evidencia, estado y accion siguiente para soporte/admin.">
                                    <div className="space-y-4">
                                        {sortedIncidents.map((incident) => {
                                            const nextStatuses = incident.status === 'open' ? ['investigating', 'resolved', 'closed']
                                                : incident.status === 'investigating' ? ['resolved', 'closed']
                                                    : incident.status === 'resolved' ? ['closed']
                                                        : [];
                                            const supportReview = typeof incident.metadata?.supportReviewNote === 'string'
                                                ? incident.metadata.supportReviewNote
                                                : '';

                                            return (
                                                <div key={incident.id} className={`min-w-0 rounded-lg border bg-white p-4 ${incident.severity === 'critical' && incident.status !== 'closed' && incident.status !== 'resolved' ? 'border-zinc-950 shadow-[inset_4px_0_0_#09090b]' : 'border-zinc-200'}`}>
                                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                        <div className="min-w-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <ShieldAlert className="h-4 w-4 text-zinc-950" aria-hidden="true" />
                                                                <p className="font-semibold text-zinc-950">{incident.title}</p>
                                                                <WmsStatusBadge label={getIncidentSeverityLabel(incident.severity)} tone={severityTone(incident.severity)} />
                                                                <WmsStatusBadge label={getIncidentStatusLabel(incident.status)} tone={incidentTone(incident.status, incident.severity)} />
                                                            </div>
                                                            <p className="mt-2 text-sm text-zinc-500">
                                                                {getIncidentTypeLabel(incident.incident_type)} / {formatWarehouseDateTime(incident.created_at)}
                                                            </p>
                                                        </div>
                                                        <p className="min-w-0 font-money text-sm text-zinc-500">{incident.offer_id ? `Viaje ${incident.offer_id.slice(0, 8)}` : 'Sin viaje'}</p>
                                                    </div>

                                                    <p className="mt-4 text-sm leading-6 text-zinc-700">{incident.description}</p>

                                                    {supportReview ? (
                                                        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                                                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Revision soporte/admin</p>
                                                            <p className="mt-2 text-sm text-zinc-700">{supportReview}</p>
                                                        </div>
                                                    ) : null}

                                                    {incident.evidence_urls?.length ? (
                                                        <WmsCardGrid compact className="mt-4">
                                                            {incident.evidence_urls.map((url, index) => (
                                                                isImageUrl(url) ? (
                                                                    <WmsImageThumb key={url} src={url} alt={`Evidencia ${index + 1} de ${incident.title}`} caption={`Evidencia ${index + 1}`} />
                                                                ) : (
                                                                    <a
                                                                        key={url}
                                                                        href={url}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="flex min-h-24 items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm font-medium text-zinc-700 transition hover:border-zinc-950 hover:text-zinc-950"
                                                                    >
                                                                        <span className="line-clamp-2 break-all">{url}</span>
                                                                        <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                                                                    </a>
                                                                )
                                                            ))}
                                                        </WmsCardGrid>
                                                    ) : (
                                                        <div className="mt-4 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-500">
                                                            Sin evidencia asociada. El riesgo sigue visible.
                                                        </div>
                                                    )}

                                                    {capabilities?.manageIncidents && nextStatuses.length ? (
                                                        <div className="mt-4 space-y-3">
                                                            <WmsTextArea
                                                                label="Nota de revision"
                                                                value={reviewNoteByIncident[incident.id] || ''}
                                                                onChange={(value) => setReviewNoteByIncident((current) => ({ ...current, [incident.id]: value }))}
                                                                placeholder="Decision de soporte/admin, evidencia revisada o siguiente paso."
                                                                minHeight={76}
                                                            />
                                                            <WmsActionRow>
                                                                {nextStatuses.map((nextStatus) => (
                                                                    <Button
                                                                        key={nextStatus}
                                                                        size="sm"
                                                                        variant={nextStatus === 'closed' ? 'outline' : 'secondary'}
                                                                        disabled={processingId === incident.id}
                                                                        onClick={() => updateIncidentStatus(incident, nextStatus as WarehouseIncident['status'])}
                                                                    >
                                                                        {getWarehouseActionLabel(nextStatus)}
                                                                    </Button>
                                                                ))}
                                                            </WmsActionRow>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            );
                                        })}
                                        {incidents.length === 0 ? (
                                            <WmsEmptyState
                                                title="No hay incidentes abiertos"
                                                description="Cuando aparezca un dano, faltante, demora o riesgo, quedara aqui con evidencia y estado."
                                            />
                                        ) : null}
                                    </div>
                                </SectionCard>
                            </WmsPanelGrid>
                        </div>
                    );
                }}
            />
        </DashboardLayout>
    );
}
