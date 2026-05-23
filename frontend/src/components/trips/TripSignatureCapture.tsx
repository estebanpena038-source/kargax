'use client';

import * as React from 'react';
import { CheckCircle2, PenLine, RefreshCw, Save } from 'lucide-react';

import { Button, Input } from '@/components/ui';

interface TripSignatureCaptureProps {
    title: string;
    subtitle: string;
    signerRole: 'warehouse_manager' | 'customer' | 'receiver' | 'other';
    requireDocumentId?: boolean;
    savedAt?: string | null;
    onSave: (payload: {
        signerName: string;
        signerDocumentId?: string;
        signerRole: 'warehouse_manager' | 'customer' | 'receiver' | 'other';
        file: File;
    }) => Promise<void>;
}

export function TripSignatureCapture({
    title,
    subtitle,
    signerRole,
    requireDocumentId = false,
    savedAt,
    onSave,
}: TripSignatureCaptureProps) {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const [signerName, setSignerName] = React.useState('');
    const [signerDocumentId, setSignerDocumentId] = React.useState('');
    const [isDrawing, setIsDrawing] = React.useState(false);
    const [hasInk, setHasInk] = React.useState(false);
    const [isSaving, setIsSaving] = React.useState(false);

    const resizeCanvas = React.useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ratio = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * ratio;
        canvas.height = rect.height * ratio;

        const context = canvas.getContext('2d');
        if (!context) return;

        context.scale(ratio, ratio);
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.strokeStyle = '#0a0a0a';
        context.lineWidth = 2.4;
    }, []);

    React.useEffect(() => {
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);
    }, [resizeCanvas]);

    const drawPoint = (clientX: number, clientY: number, isStart: boolean) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;

        if (isStart) {
            context.beginPath();
            context.moveTo(x, y);
        } else {
            context.lineTo(x, y);
            context.stroke();
        }

        setHasInk(true);
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;
        context.clearRect(0, 0, canvas.width, canvas.height);
        setHasInk(false);
    };

    const exportSignature = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return null;

        return new Promise<File | null>((resolve) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    resolve(null);
                    return;
                }

                resolve(new File([blob], `signature-${Date.now()}.png`, { type: 'image/png' }));
            }, 'image/png');
        });
    };

    return (
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <PenLine className="h-5 w-5 text-zinc-800" />
                        <h3 className="font-semibold text-slate-900">{title}</h3>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
                </div>
                {savedAt ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-800">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Guardada
                    </span>
                ) : null}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Input
                    label="Nombre del firmante"
                    value={signerName}
                    onChange={(event) => setSignerName(event.target.value)}
                    placeholder="Nombre completo"
                />
                <Input
                    label={requireDocumentId ? 'Documento / cédula' : 'Documento (opcional)'}
                    value={signerDocumentId}
                    onChange={(event) => setSignerDocumentId(event.target.value)}
                    placeholder="1234567890"
                />
            </div>

            <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200">
                <canvas
                    ref={canvasRef}
                    className="h-52 w-full touch-none bg-white"
                    onPointerDown={(event) => {
                        setIsDrawing(true);
                        drawPoint(event.clientX, event.clientY, true);
                    }}
                    onPointerMove={(event) => {
                        if (!isDrawing) return;
                        drawPoint(event.clientX, event.clientY, false);
                    }}
                    onPointerUp={() => setIsDrawing(false)}
                    onPointerLeave={() => setIsDrawing(false)}
                />
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <Button
                    variant="outline"
                    leftIcon={<RefreshCw className="h-4 w-4" />}
                    onClick={clearSignature}
                >
                    Limpiar
                </Button>
                <Button
                    leftIcon={<Save className="h-4 w-4" />}
                    isLoading={isSaving}
                    onClick={async () => {
                        if (!signerName.trim()) {
                            alert('Ingresa el nombre del firmante.');
                            return;
                        }

                        if (requireDocumentId && !signerDocumentId.trim()) {
                            alert('Ingresa el documento del firmante.');
                            return;
                        }

                        if (!hasInk) {
                            alert('Dibuja la firma antes de guardar.');
                            return;
                        }

                        const file = await exportSignature();
                        if (!file) {
                            alert('No se pudo exportar la firma.');
                            return;
                        }

                        setIsSaving(true);
                        try {
                            await onSave({
                                signerName: signerName.trim(),
                                signerDocumentId: signerDocumentId.trim() || undefined,
                                signerRole,
                                file,
                            });
                        } finally {
                            setIsSaving(false);
                        }
                    }}
                >
                    Guardar firma
                </Button>
            </div>
        </div>
    );
}
