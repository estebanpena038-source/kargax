// =============================================================================
// KARGAX - Voice Message Component
// Enterprise-Grade Audio Player
// =============================================================================

'use client';

import * as React from 'react';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VoiceMessageData } from '../types';

export interface VoiceMessageProps {
    audio: VoiceMessageData;
    isMine: boolean;
}

export function VoiceMessage({ audio, isMine }: VoiceMessageProps) {
    const [isPlaying, setIsPlaying] = React.useState(false);
    const [progress, setProgress] = React.useState(0);
    const audioRef = React.useRef<HTMLAudioElement | null>(null);

    React.useEffect(() => {
        audioRef.current = new Audio(audio.audioUrl);
        
        const handleEnded = () => {
            setIsPlaying(false);
            setProgress(0);
        };
        
        const handleTimeUpdate = () => {
            if (audioRef.current) {
                setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
            }
        };

        audioRef.current.addEventListener('ended', handleEnded);
        audioRef.current.addEventListener('timeupdate', handleTimeUpdate);

        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.removeEventListener('ended', handleEnded);
                audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
            }
        };
    }, [audio.audioUrl]);

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const formatDuration = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Fake waveform for UI aesthetics if none provided
    const waveform = audio.waveform || Array.from({ length: 30 }, () => Math.random() * 0.8 + 0.2);

    return (
        <div className={cn(
            'flex items-center gap-3 min-w-[200px]',
            isMine ? 'text-white' : 'text-zinc-900'
        )}>
            <button
                onClick={togglePlay}
                className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors',
                    isMine ? 'bg-white text-zinc-900' : 'bg-zinc-900 text-white'
                )}
            >
                {isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                ) : (
                    <Play className="w-4 h-4 fill-current ml-1" />
                )}
            </button>

            <div className="flex flex-col flex-1 gap-1">
                {/* Waveform visualization */}
                <div className="flex items-center gap-[2px] h-6 w-full">
                    {waveform.map((val, i) => {
                        const isPlayed = (i / waveform.length) * 100 <= progress;
                        return (
                            <div 
                                key={i}
                                className={cn(
                                    'w-1 rounded-full transition-all duration-100',
                                    isPlayed 
                                        ? (isMine ? 'bg-white' : 'bg-zinc-900') 
                                        : (isMine ? 'bg-white/30' : 'bg-zinc-300')
                                )}
                                style={{ height: `${Math.max(10, val * 100)}%` }}
                            />
                        );
                    })}
                </div>
                
                <div className="text-[11px] font-mono opacity-80">
                    {formatDuration(audio.durationSeconds)}
                </div>
            </div>
        </div>
    );
}

export default VoiceMessage;
