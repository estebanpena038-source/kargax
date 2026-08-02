// =============================================================================
// KARGAX - Location Message Component
// Enterprise-Grade Location Display
// =============================================================================

'use client';

import * as React from 'react';
import { MapPin, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LocationData } from '../types';

export interface LocationMessageProps {
    location: LocationData;
    isMine: boolean;
}

export function LocationMessage({ location, isMine }: LocationMessageProps) {
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;

    return (
        <div className={cn(
            'flex flex-col rounded-xl overflow-hidden shadow-sm max-w-[260px] sm:max-w-[300px]',
            isMine ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200'
        )}>
            {/* Map Placeholder */}
            <div className="h-32 bg-zinc-100 relative flex items-center justify-center overflow-hidden">
                {/* Simulated Map Background */}
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
                
                <div className="relative z-10 w-10 h-10 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30 ring-4 ring-white">
                    <MapPin className="w-5 h-5 text-white" />
                </div>
            </div>

            <div className="p-3 flex flex-col gap-2">
                <div className={cn(
                    'font-medium text-sm line-clamp-2 leading-snug',
                    isMine ? 'text-white' : 'text-zinc-900'
                )}>
                    {location.label || 'Ubicación compartida'}
                </div>
                
                <div className={cn(
                    'text-xs font-mono',
                    isMine ? 'text-zinc-400' : 'text-zinc-500'
                )}>
                    {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                </div>

                <a 
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                        'flex items-center justify-center gap-1.5 w-full py-2 mt-1 rounded-lg text-xs font-semibold transition-colors',
                        isMine 
                            ? 'bg-zinc-800 text-white hover:bg-zinc-700' 
                            : 'bg-zinc-50 text-zinc-900 hover:bg-zinc-100 border border-zinc-200'
                    )}
                >
                    <Navigation className="w-3.5 h-3.5" />
                    Abrir en Google Maps
                </a>
            </div>
        </div>
    );
}

export default LocationMessage;
