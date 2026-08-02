// =============================================================================
// KARGAX - Evidence Message Component
// Enterprise-Grade Inline Evidence Rendering
// =============================================================================

'use client';

import * as React from 'react';
import { FileText, Maximize2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/Dialog';
import type { EvidenceData } from '../types';

export interface EvidenceMessageProps {
    evidence: EvidenceData;
    isMine: boolean;
}

const typeLabels: Record<string, string> = {
    cargo: 'Carga',
    delivery: 'Entrega',
    signature: 'Firma',
    document: 'Documento',
    inspection: 'Inspección'
};

const qualityColors = {
    high: 'bg-green-500',
    medium: 'bg-amber-500',
    low: 'bg-red-500'
};

export function EvidenceMessage({ evidence, isMine }: EvidenceMessageProps) {
    return (
        <div className={cn(
            'flex flex-col rounded-xl overflow-hidden shadow-sm max-w-[260px] sm:max-w-[300px]',
            isMine ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'
        )}>
            {/* Header / Badge */}
            <div className={cn(
                'flex items-center justify-between px-3 py-2 border-b text-xs font-semibold',
                isMine ? 'border-zinc-800 text-white' : 'border-zinc-100 text-zinc-900'
            )}>
                <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{typeLabels[evidence.type] || 'Evidencia'}</span>
                </div>
                
                {evidence.quality && (
                    <div className="flex items-center gap-1.5" title={`Calidad: ${evidence.quality}`}>
                        <div className={cn('w-2 h-2 rounded-full', qualityColors[evidence.quality])} />
                    </div>
                )}
            </div>

            {/* Photo Thumbnail */}
            <Dialog>
                <DialogTrigger asChild>
                    <button className="relative w-full aspect-square bg-zinc-100 group overflow-hidden cursor-zoom-in">
                        {evidence.photoUrl ? (
                            <img 
                                src={evidence.photoUrl} 
                                alt={evidence.caption || 'Evidencia'} 
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                loading="lazy"
                            />
                        ) : (
                            <div className="flex w-full h-full items-center justify-center text-zinc-300">
                                <FileText className="w-12 h-12" />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                            <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                        </div>
                    </button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl w-full p-0 overflow-hidden bg-black border-none">
                    <img 
                        src={evidence.photoUrl} 
                        alt={evidence.caption || 'Evidencia Completa'} 
                        className="w-full h-auto max-h-[90vh] object-contain"
                    />
                </DialogContent>
            </Dialog>

            {/* Caption */}
            {evidence.caption && (
                <div className={cn(
                    'p-3 text-sm line-clamp-3',
                    isMine ? 'text-zinc-300' : 'text-zinc-600'
                )}>
                    {evidence.caption}
                </div>
            )}
        </div>
    );
}

export default EvidenceMessage;
