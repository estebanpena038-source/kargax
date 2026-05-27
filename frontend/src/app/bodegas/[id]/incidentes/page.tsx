'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { ExternalLink, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button, Input, Select, toast } from '@/components/ui';
import { SectionCard, WarehouseWorkspace } from '@/components/warehouses/WarehouseWorkspace';
import {
    WmsEmptyState,
    WmsFleetCard,
    WmsFleetDarkPanel,
    WmsFleetIdentity,
    WmsFleetInfoGrid,
    WmsFleetInfoItem,
    WmsFleetSection,
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
                        <div className="space-y-4 sm:space-y-5">
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
                                <SectionCard title="Registrar incidente" description="Tipo, severidad, evidencia y contexto para decidir rapido.">
                                    <div className="space-y-4">
                                        <div className="grid gap-3">
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

                                        <div className="min-w-0 rounded-lg border border-zinc-200 bg-zinc-50 p-3.5">
                                            <p className="text-sm font-semibold text-zinc-950">Evidencia</p>
                                            <p className="mt-1 text-xs text-zinc-500">Agrega URLs de foto, documento o soporte. Quedan asociadas al incidente.</p>
                                                <div className="mt-3 flex min-w-0 flex-col gap-3">
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

                                <WmsFleetSection icon={ShieldAlert} title="Revision de incidentes" description="Severidad, evidencia, estado y accion siguiente para soporte/admin.">
                                    {sortedIncidents.length ? (
                                    <>
                                        {sortedIncidents.map((incident) => {
                                            const nextStatuses = incident.status === 'open' ? ['investigating', 'resolved', 'closed']
                                                : incident.status === 'investigating' ? ['resolved', 'closed']
                                                    : incident.status === 'resolved' ? ['closed']
                                                        : [];
                                            const supportReview = typeof incident.metadata?.supportReviewNote === 'string'
                                                ? incident.metadata.supportReviewNote
                                                : '';

                                            return (
                                                <WmsFleetCard
                                                    key={incident.id}
                                                    identity={(
                                                        <WmsFleetIdentity
                                                            title={incident.title}
                                                            subtitle={<span className="line-clamp-3">{incident.description}</span>}
                                                            status={<WmsStatusBadge label={getIncidentSeverityLabel(incident.severity)} tone={severityTone(incident.severity)} />}
                                                            activity={formatWarehouseDateTime(incident.created_at)}
                                                        />
                                                    )}
                                                    info={(
                                                        <WmsFleetInfoGrid>
                                                            <WmsFleetInfoItem label="Tipo" value={getIncidentTypeLabel(incident.incident_type)} />
                                                            <WmsFleetInfoItem label="Estado" value={getIncidentStatusLabel(incident.status)} />
                                                            <WmsFleetInfoItem label="Viaje" value={incident.offer_id ? incident.offer_id.slice(0, 8) : 'Sin viaje'} />
                                                            <WmsFleetInfoItem label="Evidencia" value={incident.evidence_urls?.length || 0} />
                                                            {supportReview ? (
                                                                <WmsFleetInfoItem
                                                                    label="Revision soporte/admin"
                                                                    value={<span className="line-clamp-3 text-sm font-normal">{supportReview}</span>}
                                                                    className="min-[520px]:col-span-2 xl:col-span-1 2xl:col-span-2"
                                                                />
                                                            ) : null}
                                                        </WmsFleetInfoGrid>
                                                    )}
                                                    darkPanel={(
                                                        <WmsFleetDarkPanel
                                                            label="Riesgo"
                                                            value={getIncidentStatusLabel(incident.status)}
                                                            detail={getIncidentSeverityLabel(incident.severity)}
                                                        />
                                                    )}
                                                    actions={capabilities?.manageIncidents && nextStatuses.length ? (
                                                        <div className="space-y-3">
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
                                                />
                                            );
                                        })}
                                        {sortedIncidents.some((incident) => incident.evidence_urls?.length) ? (
                                            <div className="grid gap-3">
                                                {sortedIncidents.map((incident) => (
                                                    incident.evidence_urls?.length ? (
                                                        <div key={`evidence-${incident.id}`} className="rounded-lg border border-zinc-200 bg-white p-3.5">
                                                            <p className="text-sm font-semibold text-zinc-950">{incident.title}</p>
                                                            <div className="mt-3 flex min-w-0 gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
                                                                {incident.evidence_urls.map((url, index) => (
                                                                    isImageUrl(url) ? (
                                                                        <div key={url} className="w-24 shrink-0">
                                                                            <WmsImageThumb src={url} alt={`Evidencia ${index + 1} de ${incident.title}`} caption={`Evidencia ${index + 1}`} />
                                                                        </div>
                                                                    ) : (
                                                                        <a
                                                                            key={url}
                                                                            href={url}
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                            className="flex min-h-24 w-56 shrink-0 items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3.5 text-sm font-medium text-zinc-700 transition hover:border-zinc-950 hover:text-zinc-950"
                                                                        >
                                                                            <span className="line-clamp-2 break-all">{url}</span>
                                                                            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                                                                        </a>
                                                                    )
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ) : null
                                                ))}
                                            </div>
                                        ) : null}
                                    </>
                                    ) : (
                                        <WmsEmptyState
                                            title="No hay incidentes abiertos"
                                            description="Cuando aparezca un dano, faltante, demora o riesgo, quedara aqui con evidencia y estado."
                                        />
                                    )}
                                </WmsFleetSection>
                            </WmsPanelGrid>
                        </div>
                    );
                }}
            />
        </DashboardLayout>
    );
}
