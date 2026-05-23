'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { AlertTriangle, Check, ClipboardList, LockKeyhole, Play, RotateCcw } from 'lucide-react';
import { DashboardLayout } from '@/components/layouts/DashboardLayout';
import { Button, Input, Select, toast } from '@/components/ui';
import { SectionCard, WarehouseWorkspace, formatDateTime } from '@/components/warehouses/WarehouseWorkspace';
import {
    WmsCompletionMark,
    WmsEmptyState,
    WmsMetric,
    WmsMetricGrid,
    WmsPanelGrid,
    WmsProgress,
    WmsRiskNotice,
    WmsActionRow,
    WmsStatusBadge,
    WmsTextArea,
} from '@/components/warehouses/WarehouseExecutionLuxury';
import warehouseClient from '@/lib/warehouses/client';
import { getDispatchStatusLabel } from '@/lib/warehouses/localization';
import type { WarehouseDispatchLine, WarehouseDispatchOrder, WarehouseTask } from '@/lib/warehouses/types';

const TASK_TYPE_OPTIONS = [
    { value: 'picking', label: 'Picking' },
    { value: 'loading', label: 'Cargue' },
    { value: 'inspection', label: 'Inspeccion' },
];

const TASK_STATUS_LABELS: Record<WarehouseTask['status'], string> = {
    open: 'Pendiente',
    in_progress: 'Activo',
    blocked: 'Rechazo visible',
    completed: 'Completado',
    cancelled: 'Cancelado',
};

function taskTone(status: WarehouseTask['status']) {
    if (status === 'completed') return 'strong' as const;
    if (status === 'blocked') return 'critical' as const;
    if (status === 'cancelled') return 'muted' as const;
    return 'neutral' as const;
}

function taskActionLabel(nextStatus: WarehouseTask['status']) {
    const labels: Record<WarehouseTask['status'], string> = {
        open: 'Reabrir',
        in_progress: 'Iniciar',
        blocked: 'Registrar rechazo',
        completed: 'Cerrar con confirmacion',
        cancelled: 'Cancelar',
    };

    return labels[nextStatus];
}

function visibleChecklist(description?: string | null) {
    const lines = (description || '')
        .split(/\r?\n|;/)
        .map((item) => item.trim())
        .filter(Boolean);

    return lines.length ? lines : ['Verificar SKU', 'Separar cantidad solicitada', 'Confirmar novedad o rechazo antes del cierre'];
}

function getMetadataText(task: WarehouseTask, key: string) {
    const value = task.metadata?.[key];
    return typeof value === 'string' ? value : '';
}

function dispatchLineTotals(dispatchItem: WarehouseDispatchOrder) {
    const lines = dispatchItem.lines || [];
    return lines.reduce((totals, line) => ({
        requested: totals.requested + Number(line.requested_qty || 0),
        picked: totals.picked + Number(line.picked_qty || 0),
        dispatched: totals.dispatched + Number(line.dispatched_qty || 0),
        rejected: totals.rejected + Number(line.rejected_qty || 0),
    }), {
        requested: 0,
        picked: 0,
        dispatched: 0,
        rejected: 0,
    });
}

export default function WarehousePickingPage() {
    const params = useParams<{ id: string }>();
    const warehouseId = params?.id as string;
    const [saving, setSaving] = React.useState(false);
    const [processingId, setProcessingId] = React.useState<string | null>(null);
    const [formError, setFormError] = React.useState('');
    const [confirmationByTask, setConfirmationByTask] = React.useState<Record<string, string>>({});
    const [blockNoteByTask, setBlockNoteByTask] = React.useState<Record<string, string>>({});
    const [form, setForm] = React.useState({
        taskType: 'picking',
        title: '',
        description: '',
        dueAt: '',
        offerId: '',
    });

    return (
        <DashboardLayout pageTitle="Picking">
            <WarehouseWorkspace
                warehouseId={warehouseId}
                section="picking"
                renderSection={({ tasks, dispatches, capabilities, reload }) => {
                    const pickingTasks = tasks.filter((task) => task.task_type === 'picking' || task.task_type === 'loading' || task.task_type === 'inspection');
                    const activeTasks = pickingTasks.filter((task) => task.status === 'open' || task.status === 'in_progress' || task.status === 'blocked');
                    const completedTasks = pickingTasks.filter((task) => task.status === 'completed').length;
                    const blockedTasks = pickingTasks.filter((task) => task.status === 'blocked').length;
                    const pickingDispatches = dispatches.filter((dispatchItem) => dispatchItem.status === 'draft' || dispatchItem.status === 'picking' || dispatchItem.status === 'ready');

                    const updateTaskStatus = async (task: WarehouseTask, status: WarehouseTask['status']) => {
                        const confirmation = confirmationByTask[task.id]?.trim() || '';
                        const blockNote = blockNoteByTask[task.id]?.trim() || '';

                        if (status === 'completed' && task.status !== 'blocked' && confirmation.length < 4) {
                            toast.warning('Confirmacion requerida', 'Escribe una confirmacion operativa antes de cerrar el picking.');
                            return;
                        }

                        if (status === 'blocked' && blockNote.length < 8) {
                            toast.warning('Rechazo sin contexto', 'Describe el rechazo, faltante o novedad antes de bloquear.');
                            return;
                        }

                        try {
                            setProcessingId(task.id);
                            await warehouseClient.updateTask(warehouseId, task.id, {
                                status,
                                metadata: {
                                    ...task.metadata,
                                    confirmationProvided: status === 'completed' ? Boolean(confirmation) : task.metadata?.confirmationProvided,
                                    confirmedAt: status === 'completed' ? new Date().toISOString() : task.metadata?.confirmedAt,
                                    rejectionFlowVisible: status === 'blocked' ? true : task.metadata?.rejectionFlowVisible,
                                    rejectionNote: status === 'blocked' ? blockNote : task.metadata?.rejectionNote,
                                },
                            });
                            setConfirmationByTask((current) => ({ ...current, [task.id]: '' }));
                            setBlockNoteByTask((current) => ({ ...current, [task.id]: '' }));
                            toast.success('Picking', 'Estado actualizado sin duplicar la accion.');
                            await reload();
                        } catch (error) {
                            toast.error('Picking', error instanceof Error ? error.message : 'No se pudo actualizar la tarea');
                        } finally {
                            setProcessingId(null);
                        }
                    };

                    return (
                        <div className="space-y-6">
                            <WmsMetricGrid>
                                <WmsMetric label="Checklist" value={pickingTasks.length} detail="Tareas de ejecucion" />
                                <WmsMetric label="Activas" value={activeTasks.length} detail="Pendientes o en curso" />
                                <WmsMetric label="Rechazos" value={blockedTasks} detail="Flujo visible" />
                                <WmsMetric label="Despachos" value={pickingDispatches.length} detail="Manifiestos vivos" />
                            </WmsMetricGrid>

                            <WmsPanelGrid reverse>
                                <SectionCard title="Checklist de picking" description="Una tarea, una accion siguiente, sin doble submit.">
                                    <div className="mb-5">
                                        <WmsProgress label="Progreso monocromo" value={completedTasks} total={pickingTasks.length} />
                                    </div>

                                    <div className="space-y-4">
                                        {pickingTasks.map((task) => {
                                            const checklist = visibleChecklist(task.description);
                                            const rejectionNote = getMetadataText(task, 'rejectionNote');
                                            const canTransition = capabilities?.manageTasks && processingId !== task.id;

                                            return (
                                                <div key={task.id} className="min-w-0 rounded-lg border border-zinc-200 bg-white p-4">
                                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                        <div className="flex min-w-0 items-start gap-3">
                                                            <WmsCompletionMark done={task.status === 'completed'} />
                                                            <div className="min-w-0">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <p className="font-semibold text-zinc-950">{task.title}</p>
                                                                    <WmsStatusBadge label={TASK_STATUS_LABELS[task.status]} tone={taskTone(task.status)} />
                                                                </div>
                                                                <p className="mt-1 text-sm text-zinc-500">
                                                                    {task.task_type} / vence {formatDateTime(task.due_at)} / {task.offer_id ? `viaje ${task.offer_id.slice(0, 8)}` : 'sin viaje'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <p className="font-money text-xs text-zinc-400">{task.id.slice(0, 8)}</p>
                                                    </div>

                                                    <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200">
                                                        {checklist.map((item, index) => {
                                                            const done = task.status === 'completed';
                                                            return (
                                                                <div key={`${task.id}-${index}`} className="flex min-w-0 items-center gap-3 border-b border-zinc-100 px-3 py-3 last:border-b-0 min-[380px]:px-4">
                                                                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${done ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-200 bg-white text-zinc-400'}`}>
                                                                        {done ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : index + 1}
                                                                    </span>
                                                                    <p className="text-sm text-zinc-700">{item}</p>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {task.status === 'blocked' ? (
                                                        <div className="mt-4">
                                                            <WmsRiskNotice
                                                                critical
                                                                title="Rejection flow visible"
                                                                description={rejectionNote || 'La tarea esta bloqueada. Documenta faltante, dano, SKU incorrecto o novedad antes de continuar.'}
                                                            />
                                                        </div>
                                                    ) : null}

                                                    {capabilities?.manageTasks ? (
                                                        <div className="mt-4 space-y-3">
                                                            {(task.status === 'open' || task.status === 'in_progress') ? (
                                                                <Input
                                                                    label="PIN / confirmacion operativa"
                                                                    value={confirmationByTask[task.id] || ''}
                                                                    onChange={(event) => setConfirmationByTask((current) => ({ ...current, [task.id]: event.target.value }))}
                                                                    placeholder="No se guarda el PIN, solo la confirmacion"
                                                                />
                                                            ) : null}

                                                            {(task.status === 'open' || task.status === 'in_progress' || task.status === 'blocked') ? (
                                                                <WmsTextArea
                                                                    label={task.status === 'blocked' ? 'Nota de recuperacion' : 'Motivo de rechazo o bloqueo'}
                                                                    value={blockNoteByTask[task.id] || ''}
                                                                    onChange={(value) => setBlockNoteByTask((current) => ({ ...current, [task.id]: value }))}
                                                                    placeholder="Describe faltante, dano, SKU incorrecto, evidencia o decision de supervisor."
                                                                    minHeight={76}
                                                                />
                                                            ) : null}

                                                            <WmsActionRow>
                                                                {task.status === 'open' ? (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="secondary"
                                                                        leftIcon={<Play className="h-4 w-4" />}
                                                                        disabled={!canTransition}
                                                                        onClick={() => updateTaskStatus(task, 'in_progress')}
                                                                    >
                                                                        {taskActionLabel('in_progress')}
                                                                    </Button>
                                                                ) : null}
                                                                {(task.status === 'open' || task.status === 'in_progress') ? (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        leftIcon={<AlertTriangle className="h-4 w-4" />}
                                                                        disabled={!canTransition}
                                                                        onClick={() => updateTaskStatus(task, 'blocked')}
                                                                    >
                                                                        {taskActionLabel('blocked')}
                                                                    </Button>
                                                                ) : null}
                                                                {task.status === 'blocked' ? (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        leftIcon={<RotateCcw className="h-4 w-4" />}
                                                                        disabled={!canTransition}
                                                                        onClick={() => updateTaskStatus(task, 'in_progress')}
                                                                    >
                                                                        Reabrir con revision
                                                                    </Button>
                                                                ) : null}
                                                                {(task.status === 'in_progress' || task.status === 'blocked') ? (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="secondary"
                                                                        leftIcon={<LockKeyhole className="h-4 w-4" />}
                                                                        disabled={!canTransition}
                                                                        onClick={() => updateTaskStatus(task, 'completed')}
                                                                    >
                                                                        {taskActionLabel('completed')}
                                                                    </Button>
                                                                ) : null}
                                                                {(task.status === 'open' || task.status === 'in_progress' || task.status === 'blocked') ? (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        disabled={!canTransition}
                                                                        onClick={() => updateTaskStatus(task, 'cancelled')}
                                                                    >
                                                                        Cancelar
                                                                    </Button>
                                                                ) : null}
                                                            </WmsActionRow>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            );
                                        })}

                                        {pickingTasks.length === 0 ? (
                                            <WmsEmptyState
                                                title="No hay checklist de picking"
                                                description="Crea una tarea o genera un despacho para que el alistamiento aparezca aqui."
                                            />
                                        ) : null}
                                    </div>
                                </SectionCard>

                                <SectionCard title="Nueva tarea" description="Crea solo lo necesario para el siguiente alistamiento.">
                                    <div className="space-y-3">
                                        <Select
                                            label="Tipo"
                                            value={form.taskType}
                                            onChange={(value) => setForm((current) => ({ ...current, taskType: value }))}
                                            options={TASK_TYPE_OPTIONS}
                                        />
                                        <Input label="Titulo" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Alistar pedido 1042" />
                                        <Input label="Viaje vinculado" value={form.offerId} onChange={(event) => setForm((current) => ({ ...current, offerId: event.target.value }))} placeholder="Opcional" />
                                        <Input label="Vence" type="datetime-local" value={form.dueAt} onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))} />
                                        <WmsTextArea
                                            label="Checklist"
                                            value={form.description}
                                            onChange={(value) => setForm((current) => ({ ...current, description: value }))}
                                            placeholder="Una linea por accion: verificar lote, separar unidades, revisar evidencia."
                                            minHeight={120}
                                        />
                                        {formError ? <p className="text-sm font-medium text-zinc-950">{formError}</p> : null}
                                        <Button fullWidth isLoading={saving} disabled={!capabilities?.manageTasks} onClick={async () => {
                                            if (!form.title.trim()) {
                                                setFormError('El titulo de la tarea es obligatorio.');
                                                return;
                                            }

                                            setSaving(true);
                                            try {
                                                await warehouseClient.createTask(warehouseId, {
                                                    ...form,
                                                    taskType: form.taskType,
                                                    title: form.title.trim(),
                                                    description: form.description.trim() || undefined,
                                                    dueAt: form.dueAt || undefined,
                                                    offerId: form.offerId.trim() || undefined,
                                                    metadata: {
                                                        source: 'warehouse_execution_picking',
                                                    },
                                                });
                                                setForm({ taskType: 'picking', title: '', description: '', dueAt: '', offerId: '' });
                                                setFormError('');
                                                toast.success('Tarea creada', 'El checklist quedo listo para operar.');
                                                await reload();
                                            } catch (error) {
                                                toast.error('Error', error instanceof Error ? error.message : 'No se pudo crear la tarea');
                                            } finally {
                                                setSaving(false);
                                            }
                                        }}>
                                            Crear tarea
                                        </Button>
                                    </div>
                                </SectionCard>
                            </WmsPanelGrid>

                            <SectionCard title="Manifiestos en alistamiento" description="Despachos conectados a picking, listos para confirmar sin perder trazabilidad.">
                                <div className="wms-card-grid">
                                    {pickingDispatches.map((dispatchItem) => {
                                        const totals = dispatchLineTotals(dispatchItem);

                                        return (
                                            <div key={dispatchItem.id} className="min-w-0 rounded-lg border border-zinc-200 bg-white p-4">
                                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <ClipboardList className="h-4 w-4 text-zinc-500" aria-hidden="true" />
                                                            <p className="font-semibold text-zinc-950">{dispatchItem.dispatch_number}</p>
                                                            <WmsStatusBadge label={getDispatchStatusLabel(dispatchItem.status)} tone={dispatchItem.status === 'ready' ? 'strong' : 'neutral'} />
                                                        </div>
                                                        <p className="mt-2 text-sm text-zinc-500">
                                                            {dispatchItem.offer_id ? `Viaje ${dispatchItem.offer_id.slice(0, 8)}` : 'Despacho sin viaje vinculado'} / {formatDateTime(dispatchItem.scheduled_at)}
                                                        </p>
                                                    </div>
                                                    <p className="font-money text-sm text-zinc-500">{dispatchItem.lines?.length || 0} lineas</p>
                                                </div>

                                                <WmsMetricGrid dense className="mt-4">
                                                    <WmsMetric label="Solicitado" value={totals.requested} />
                                                    <WmsMetric label="Picked" value={totals.picked} />
                                                    <WmsMetric label="Despacho" value={totals.dispatched} />
                                                    <WmsMetric label="Rechazo" value={totals.rejected} />
                                                </WmsMetricGrid>

                                                {dispatchItem.lines?.length ? (
                                                    <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200">
                                                        {dispatchItem.lines.map((line: WarehouseDispatchLine) => (
                                                            <div key={line.id} className="border-b border-zinc-100 px-4 py-3 last:border-b-0">
                                                                <p className="font-medium text-zinc-950">{line.sku_code_snapshot} / {line.sku_name_snapshot}</p>
                                                                <p className="mt-1 font-money text-xs text-zinc-500">
                                                                    Sol {line.requested_qty} / Pick {line.picked_qty} / Rech {line.rejected_qty}
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : null}
                                            </div>
                                        );
                                    })}

                                    {pickingDispatches.length === 0 ? (
                                        <WmsEmptyState
                                            title="Sin despachos en picking"
                                            description="Los despachos en borrador, picking o listos apareceran como manifiestos vivos."
                                        />
                                    ) : null}
                                </div>
                            </SectionCard>
                        </div>
                    );
                }}
            />
        </DashboardLayout>
    );
}
