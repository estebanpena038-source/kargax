/**
 * =============================================================================
 * KARGAX - PREMIUM PIN INPUT COMPONENT
 * /components/picking/PinInput.tsx
 * 
 * Componente de entrada de PIN premium con teclado numérico visual.
 * Diseño inspirado en apps bancarias y de seguridad.
 * 
 * FEATURES:
 * - Teclado numérico tipo ATM
 * - Retroalimentación visual por dígito
 * - Animaciones de error y éxito
 * - Soporte para copiar/pegar
 * - Accesibilidad completa
 * - Bloqueo después de intentos fallidos
 * 
 * SEGURIDAD:
 * - No muestra el PIN ingresado (solo puntos)
 * - Limpia el input en error
 * - Rate limiting visual
 * 
 * =============================================================================
 */

'use client';

import * as React from 'react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Delete,
    Check,
    X,
    Loader2,
    Lock,
    Unlock,
    AlertTriangle,
    KeyRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Estado de la verificación del PIN
 */
export type PinStatus =
    | 'idle'        // Esperando entrada
    | 'entering'    // Ingresando dígitos
    | 'verifying'   // Verificando con servidor
    | 'success'     // PIN correcto
    | 'error'       // PIN incorrecto
    | 'locked';     // Bloqueado por intentos

/**
 * Props del componente PinInput
 */
export interface PinInputProps {
    /** Número de dígitos del PIN */
    pinLength?: number;

    /** Título a mostrar */
    title?: string;

    /** Descripción */
    description?: string;

    /** Si está bloqueado */
    isLocked?: boolean;

    /** Número de intentos restantes */
    attemptsRemaining?: number;

    /** Máximo de intentos */
    maxAttempts?: number;

    /** Si está verificando */
    isVerifying?: boolean;

    /** Si la verificación fue exitosa */
    isSuccess?: boolean;

    /** Mensaje de error */
    errorMessage?: string;

    /** Callback cuando se completa el PIN */
    onSubmit?: (pin: string) => Promise<void>;

    /** Callback cuando cambia el PIN */
    onChange?: (pin: string) => void;

    /** Clase CSS adicional */
    className?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const NUMPAD_LAYOUT = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'delete'],
];

// =============================================================================
// SUBCOMPONENTS
// =============================================================================

/**
 * Indicador de dígito (punto o vacío)
 */
function DigitDot({
    filled,
    isActive,
    status,
}: {
    filled: boolean;
    isActive: boolean;
    status: PinStatus;
}) {
    return (
        <motion.div
            className={cn(
                'w-4 h-4 rounded-full border-2 transition-all duration-200',
                filled
                    ? status === 'error'
                        ? 'bg-zinc-500 border-zinc-500'
                        : 'bg-zinc-950 border-zinc-950'
                    : isActive
                        ? 'border-zinc-950'
                        : 'border-zinc-300'
            )}
            animate={
                status === 'error'
                    ? { x: [0, -4, 4, -4, 4, 0] }
                    : status === 'success'
                        ? { scale: [1, 1.2, 1] }
                        : {}
            }
            transition={{ duration: 0.3 }}
        />
    );
}

/**
 * Botón del teclado numérico
 */
function NumpadButton({
    value,
    onPress,
    disabled,
}: {
    value: string;
    onPress: (value: string) => void;
    disabled?: boolean;
}) {
    // Si es vacío, renderizar espacio
    if (value === '') {
        return <div className="w-20 h-14" />;
    }

    // Si es delete, renderizar icono
    const isDelete = value === 'delete';

    return (
        <motion.button
            type="button"
            onClick={() => onPress(value)}
            disabled={disabled}
            className={cn(
                'w-20 h-14 rounded-lg font-semibold text-xl',
                'flex items-center justify-center',
                'transition-all duration-150',
                'active:scale-95',
                isDelete
                    ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                    : 'bg-white text-zinc-950 border border-zinc-200 shadow-sm hover:shadow-md hover:border-zinc-950',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-sm'
            )}
            whileTap={{ scale: 0.95 }}
        >
            {isDelete ? <Delete className="w-6 h-6" /> : value}
        </motion.button>
    );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function PinInput({
    pinLength = 4,
    title = 'Ingresa el PIN',
    description,
    isLocked = false,
    attemptsRemaining,
    maxAttempts = 5,
    isVerifying = false,
    isSuccess = false,
    errorMessage,
    onSubmit,
    onChange,
    className,
}: PinInputProps) {
    // Estado del PIN
    const [pin, setPin] = useState<string>('');
    const [status, setStatus] = useState<PinStatus>('idle');
    const [localError, setLocalError] = useState<string | null>(null);

    // Ref para rastrear el error anterior y evitar resets innecesarios
    const prevErrorRef = useRef<string | undefined>(undefined);
    const resetTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Ref para el input hidden (para copiar/pegar)
    const inputRef = useRef<HTMLInputElement>(null);

    // Actualizar estado según props - MEJORADO para evitar resets innecesarios
    useEffect(() => {
        // Limpiar timer anterior si existe
        if (resetTimerRef.current) {
            clearTimeout(resetTimerRef.current);
            resetTimerRef.current = null;
        }

        if (isLocked) {
            setStatus('locked');
        } else if (isSuccess) {
            setStatus('success');
        } else if (isVerifying) {
            setStatus('verifying');
        } else if (errorMessage && errorMessage !== prevErrorRef.current) {
            // Solo procesar si es un NUEVO error (diferente al anterior)
            setStatus('error');
            setLocalError(errorMessage);
            prevErrorRef.current = errorMessage;

            // Limpiar PIN después de mostrar error
            resetTimerRef.current = setTimeout(() => {
                setPin('');
                setStatus('idle');
                setLocalError(null);
            }, 2000); // Dar más tiempo para leer el error
        } else if (pin.length > 0 && status !== 'error') {
            setStatus('entering');
        } else if (pin.length === 0 && status !== 'error') {
            setStatus('idle');
        }

        // Cleanup del timer al desmontar
        return () => {
            if (resetTimerRef.current) {
                clearTimeout(resetTimerRef.current);
            }
        };
    }, [isLocked, isSuccess, isVerifying, errorMessage, pin.length, status]);

    // Manejar presión de tecla del numpad
    const handlePress = useCallback((value: string) => {
        if (status === 'locked' || status === 'verifying' || status === 'success') {
            return;
        }

        if (value === 'delete') {
            setPin(prev => prev.slice(0, -1));
            setLocalError(null);
        } else {
            if (pin.length < pinLength) {
                const newPin = pin + value;
                setPin(newPin);
                onChange?.(newPin);
                setLocalError(null);

                // Auto-submit cuando está completo
                if (newPin.length === pinLength && onSubmit) {
                    onSubmit(newPin);
                }
            }
        }
    }, [pin, pinLength, status, onChange, onSubmit]);

    // Manejar input de teclado físico
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (status === 'locked' || status === 'verifying' || status === 'success') {
            return;
        }

        if (/^[0-9]$/.test(e.key)) {
            handlePress(e.key);
        } else if (e.key === 'Backspace') {
            handlePress('delete');
        }
    }, [handlePress, status]);

    // Manejar paste
    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, pinLength);
        if (pasted.length === pinLength) {
            setPin(pasted);
            onChange?.(pasted);
            onSubmit?.(pasted);
        }
    }, [pinLength, onChange, onSubmit]);

    // Limpiar PIN
    const handleClear = useCallback(() => {
        setPin('');
        setLocalError(null);
        setStatus('idle');
    }, []);

    // Focus al montar
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Determinar si los botones están deshabilitados
    const isDisabled = status === 'locked' || status === 'verifying' || status === 'success';

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                'flex flex-col items-center rounded-lg p-6',
                'bg-white',
                'border border-zinc-200 shadow-[0_24px_60px_-48px_rgba(10,10,10,.65)]',
                className
            )}
        >
            {/* Header con icono */}
            <motion.div
                className={cn(
                    'mb-4 flex h-16 w-16 items-center justify-center rounded-lg border shadow-sm',
                    status === 'success'
                        ? 'border-zinc-950 bg-zinc-950'
                        : status === 'error'
                            ? 'border-zinc-500 bg-zinc-500'
                            : status === 'locked'
                                ? 'border-zinc-400 bg-zinc-400'
                                : 'border-zinc-950 bg-zinc-950'
                )}
                animate={status === 'verifying' ? { rotate: 360 } : {}}
                transition={{ duration: 2, repeat: status === 'verifying' ? Infinity : 0 }}
            >
                {status === 'verifying' ? (
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                ) : status === 'success' ? (
                    <Unlock className="w-8 h-8 text-white" />
                ) : status === 'locked' ? (
                    <Lock className="w-8 h-8 text-white" />
                ) : status === 'error' ? (
                    <X className="w-8 h-8 text-white" />
                ) : (
                    <KeyRound className="w-8 h-8 text-white" />
                )}
            </motion.div>

            {/* Título */}
            <h3 className="text-xl font-bold text-slate-900 text-center">
                {status === 'success'
                    ? 'PIN verificado'
                    : status === 'locked'
                        ? 'Acceso bloqueado'
                        : status === 'error'
                            ? 'PIN incorrecto'
                            : title
                }
            </h3>

            {/* Descripción */}
            {description && status === 'idle' && (
                <p className="text-sm text-slate-500 text-center mt-1 max-w-xs">
                    {description}
                </p>
            )}

            {/* Mensaje de error */}
            <AnimatePresence>
                {(localError || errorMessage) && status === 'error' && (
                    <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mt-2 flex items-center gap-1 text-center text-sm text-zinc-700"
                    >
                        <AlertTriangle className="w-4 h-4" />
                        {localError || errorMessage}
                    </motion.p>
                )}
            </AnimatePresence>

            {/* Intentos restantes */}
            {attemptsRemaining !== undefined && attemptsRemaining < maxAttempts && status !== 'success' && (
                <p className={cn(
                    'text-sm mt-2 font-medium',
                    attemptsRemaining <= 2 ? 'text-zinc-950' : 'text-zinc-600'
                )}>
                    {attemptsRemaining} intentos restantes
                </p>
            )}

            {/* Indicadores de dígitos */}
            <div className="flex items-center gap-4 my-8">
                {Array.from({ length: pinLength }).map((_, i) => (
                    <DigitDot
                        key={i}
                        filled={i < pin.length}
                        isActive={i === pin.length}
                        status={status}
                    />
                ))}
            </div>

            {/* Input hidden para teclado y paste */}
            <input
                ref={inputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={pinLength}
                value={pin}
                onChange={() => { }} // Controlado por handlePress
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                className="sr-only"
                aria-label="PIN input"
            />

            {/* Teclado numérico */}
            <div className="grid gap-3">
                {NUMPAD_LAYOUT.map((row, rowIndex) => (
                    <div key={rowIndex} className="flex gap-3 justify-center">
                        {row.map((key, keyIndex) => (
                            <NumpadButton
                                key={`${rowIndex}-${keyIndex}`}
                                value={key}
                                onPress={handlePress}
                                disabled={isDisabled}
                            />
                        ))}
                    </div>
                ))}
            </div>

            {/* Botón limpiar */}
            {pin.length > 0 && status !== 'success' && status !== 'verifying' && (
                <Button
                    onClick={handleClear}
                    variant="ghost"
                    size="sm"
                    className="mt-4 text-slate-500"
                >
                    Limpiar
                </Button>
            )}

            {/* Mensaje de bloqueado */}
            {status === 'locked' && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-4 rounded-lg border border-zinc-300 bg-zinc-50 p-4 text-center"
                >
                    <p className="font-medium text-zinc-950">
                        Demasiados intentos fallidos
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">
                        Contacta al administrador para desbloquear
                    </p>
                </motion.div>
            )}

            {/* Indicador de verificando */}
            {status === 'verifying' && (
                <p className="mt-4 flex items-center gap-2 font-medium text-zinc-800">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verificando PIN...
                </p>
            )}
        </motion.div>
    );
}

export default PinInput;
