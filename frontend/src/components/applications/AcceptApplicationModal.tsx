// =============================================================================
// KARGAX - ACCEPT APPLICATION MODAL
// Enterprise-grade modal for accepting applications with messaging
// =============================================================================

'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    CheckCircle2,
    Truck,
    MapPin,
    Calendar,
    DollarSign,
    MessageSquare,
    Loader2,
    Send,
    Sparkles,
    User,
} from 'lucide-react';

import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatCOP } from '@/constants/colombia';

// =============================================================================
// Types
// =============================================================================

interface OfferInfo {
    cargoType: string;
    originCity: string;
    destinationCity: string;
    pickupDate: string;
    totalAmount: number;
}

interface TruckerInfo {
    name: string;
    email: string;
    phone?: string | null;
    proposedAmount?: number | null;
}

interface AcceptApplicationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (message: string) => Promise<void>;
    offer: OfferInfo;
    trucker: TruckerInfo;
    isProcessing?: boolean;
}

// =============================================================================
// Message Templates
// =============================================================================

const MESSAGE_TEMPLATES = {
    formal: (trucker: TruckerInfo, offer: OfferInfo) =>
        `Estimado/a ${trucker.name},

¡Felicitaciones! Has sido seleccionado/a para realizar el envío de ${offer.cargoType} desde ${offer.originCity} hasta ${offer.destinationCity}.

Detalles del servicio:
• Fecha de recogida: ${formatDate(offer.pickupDate)}
• Tarifa acordada: ${formatCOP(trucker.proposedAmount || offer.totalAmount)}

Por favor confirma tu disponibilidad respondiendo a este mensaje. Coordinaremos los detalles de recogida una vez confirmado.

¡Gracias por tu confianza en KargaX!`,

    casual: (trucker: TruckerInfo, offer: OfferInfo) =>
        `Hola ${trucker.name}.

Te hemos seleccionado para el envío de ${offer.cargoType} (${offer.originCity} → ${offer.destinationCity}).

Confirmame cuando puedas para coordinar la recogida el ${formatDate(offer.pickupDate)}.

¡Éxitos!`,

    minimal: (trucker: TruckerInfo, offer: OfferInfo) =>
        `${trucker.name}, has sido aceptado para el envío ${offer.originCity} → ${offer.destinationCity}. Contáctame para coordinar detalles.`,
};

function formatDate(dateString: string): string {
    try {
        return new Date(dateString).toLocaleDateString('es-CO', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });
    } catch {
        return dateString;
    }
}

// =============================================================================
// Sub-components
// =============================================================================

function OfferSummaryCard({ offer, trucker }: { offer: OfferInfo; trucker: TruckerInfo }) {
    return (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100">
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-white font-bold">
                    {trucker.name?.charAt(0).toUpperCase() || 'T'}
                </div>
                <div>
                    <h4 className="font-semibold text-slate-900">{trucker.name}</h4>
                    <p className="text-sm text-slate-500">{trucker.email}</p>
                </div>
                <div className="ml-auto">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 text-sm font-medium rounded-full">
                        <Sparkles className="w-3.5 h-3.5" />
                        Seleccionado
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                    <Truck className="w-4 h-4 text-green-600" />
                    <span>{offer.cargoType}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                    <Calendar className="w-4 h-4 text-blue-500" />
                    <span>{formatDate(offer.pickupDate).split(',')[0]}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 col-span-2">
                    <MapPin className="w-4 h-4 text-rose-500" />
                    <span className="font-medium">{offer.originCity}</span>
                    <span className="text-slate-400">→</span>
                    <span className="font-medium">{offer.destinationCity}</span>
                </div>
                <div className="flex items-center gap-2 col-span-2">
                    <DollarSign className="w-4 h-4 text-emerald-500" />
                    <span className="text-lg font-bold text-emerald-600">
                        {formatCOP(trucker.proposedAmount || offer.totalAmount)}
                    </span>
                </div>
            </div>
        </div>
    );
}

function TemplateSelector({
    selectedTemplate,
    onSelect,
}: {
    selectedTemplate: keyof typeof MESSAGE_TEMPLATES;
    onSelect: (template: keyof typeof MESSAGE_TEMPLATES) => void;
}) {
    const templates = [
        { id: 'formal' as const, label: 'Formal', Icon: MessageSquare },
        { id: 'casual' as const, label: 'Casual', Icon: User },
        { id: 'minimal' as const, label: 'Mínimo', Icon: Send },
    ];

    return (
        <div className="flex gap-2">
            {templates.map((t) => {
                const Icon = t.Icon;
                return (
                <button
                    key={t.id}
                    onClick={() => onSelect(t.id)}
                    className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                        selectedTemplate === t.id
                            ? 'bg-green-100 text-green-800 ring-2 ring-green-400'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    )}
                >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{t.label}</span>
                </button>
                );
            })}
        </div>
    );
}

// =============================================================================
// Main Component
// =============================================================================

export function AcceptApplicationModal({
    isOpen,
    onClose,
    onConfirm,
    offer,
    trucker,
    isProcessing = false,
}: AcceptApplicationModalProps) {
    const [selectedTemplate, setSelectedTemplate] = React.useState<keyof typeof MESSAGE_TEMPLATES>('formal');
    const [message, setMessage] = React.useState('');
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    // Generate message from template
    React.useEffect(() => {
        if (isOpen && offer && trucker) {
            const templateFn = MESSAGE_TEMPLATES[selectedTemplate];
            setMessage(templateFn(trucker, offer));
        }
    }, [isOpen, selectedTemplate, offer, trucker]);

    // Focus textarea when modal opens
    React.useEffect(() => {
        if (isOpen && textareaRef.current) {
            setTimeout(() => textareaRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleConfirm = async () => {
        if (!message.trim()) return;
        await onConfirm(message);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            handleConfirm();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', duration: 0.3 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
                            {/* Header */}
                            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                                        <CheckCircle2 className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900">
                                            Aceptar Transportador
                                        </h2>
                                        <p className="text-sm text-slate-500">
                                            Envía un mensaje de bienvenida al transportador
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    disabled={isProcessing}
                                    className="p-2 rounded-lg hover:bg-white/50 transition-colors"
                                >
                                    <X className="w-5 h-5 text-slate-400" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-5 space-y-4 overflow-y-auto flex-1">
                                {/* Offer Summary */}
                                <OfferSummaryCard offer={offer} trucker={trucker} />

                                {/* Template Selector */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Plantilla de mensaje
                                    </label>
                                    <TemplateSelector
                                        selectedTemplate={selectedTemplate}
                                        onSelect={setSelectedTemplate}
                                    />
                                </div>

                                {/* Message Input */}
                                <div>
                                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                                        <MessageSquare className="w-4 h-4" />
                                        Mensaje para el transportador
                                    </label>
                                    <textarea
                                        ref={textareaRef}
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        disabled={isProcessing}
                                        rows={8}
                                        className={cn(
                                            'w-full px-4 py-3 rounded-xl border border-slate-200',
                                            'focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400',
                                            'resize-none text-sm text-slate-700 leading-relaxed',
                                            'placeholder:text-slate-400 transition-all',
                                            isProcessing && 'opacity-50 cursor-not-allowed'
                                        )}
                                        placeholder="Escribe tu mensaje aquí..."
                                    />
                                    <p className="mt-1 text-xs text-slate-400">
                                        Tip: Ctrl + Enter para enviar rápidamente
                                    </p>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
                                <Button
                                    variant="outline"
                                    onClick={onClose}
                                    disabled={isProcessing}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    onClick={handleConfirm}
                                    disabled={isProcessing || !message.trim()}
                                    className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-6"
                                >
                                    {isProcessing ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Procesando...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4 mr-2" />
                                            Aceptar y Enviar Mensaje
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

export default AcceptApplicationModal;
