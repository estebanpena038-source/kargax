// =============================================================================
// KargaX - Input Component
// Premium form input with validation states
// =============================================================================

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// Input Variants
// =============================================================================
const inputVariants = cva(
    `flex min-w-0 w-full rounded-lg border bg-white/90 px-4 py-3 text-base text-zinc-950
   transition-all duration-200 ease-out
   placeholder:text-zinc-400
   focus:outline-none focus:ring-2 focus:ring-offset-1
   disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-zinc-50`,
    {
        variants: {
            state: {
                default: `
          border-zinc-200
          hover:border-zinc-300
          focus:border-zinc-950 focus:ring-zinc-950/10
        `,
                error: `
          border-red-500 
          hover:border-red-600
          focus:border-red-500 focus:ring-red-500/20
          pr-10
        `,
                success: `
          border-emerald-500
          hover:border-emerald-600
          focus:border-emerald-500 focus:ring-emerald-500/20
          pr-10
        `,
            },
            size: {
                sm: 'h-9 text-sm px-3 py-2',
                md: 'h-11 text-base px-4 py-3',
                lg: 'h-13 text-lg px-5 py-4',
            },
        },
        defaultVariants: {
            state: 'default',
            size: 'md',
        },
    }
);

// =============================================================================
// Types
// =============================================================================
export interface InputProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>,
    VariantProps<typeof inputVariants> {
    label?: string;
    helperText?: string;
    errorMessage?: string;
    successMessage?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    showPasswordToggle?: boolean;
}

// =============================================================================
// Component
// =============================================================================
const Input = React.forwardRef<HTMLInputElement, InputProps>(
    (
        {
            className,
            type = 'text',
            state,
            size,
            label,
            helperText,
            errorMessage,
            successMessage,
            leftIcon,
            rightIcon,
            showPasswordToggle,
            disabled,
            id,
            ...props
        },
        ref
    ) => {
        const [showPassword, setShowPassword] = React.useState(false);
        const generatedId = React.useId();
        const inputId = id ?? generatedId;

        // Determine state based on messages
        const computedState = errorMessage ? 'error' : successMessage ? 'success' : state;

        // Handle password toggle
        const inputType = type === 'password' && showPassword ? 'text' : type;

        return (
            <div className="min-w-0 w-full space-y-2">
                {/* Label */}
                {label && (
                    <label htmlFor={inputId} className="block text-sm font-medium text-zinc-700">
                        {label}
                    </label>
                )}

                {/* Input Container */}
                <div className="relative">
                    {/* Left Icon */}
                    {leftIcon && (
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                            {leftIcon}
                        </div>
                    )}

                    {/* Input Field */}
                    <input
                        id={inputId}
                        type={inputType}
                        className={cn(
                            inputVariants({ state: computedState, size }),
                            leftIcon && 'pl-11',
                            (rightIcon || showPasswordToggle || computedState !== 'default') && 'pr-11',
                            className
                        )}
                        ref={ref}
                        disabled={disabled}
                        aria-invalid={computedState === 'error'}
                        aria-describedby={
                            errorMessage
                                ? `${inputId}-error`
                                : helperText
                                    ? `${inputId}-helper`
                                    : undefined
                        }
                        {...props}
                    />

                    {/* Right Side Icons */}
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        {/* Password Toggle */}
                        {showPasswordToggle && type === 'password' && (
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="rounded-md text-zinc-400 transition-colors hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-950/20 disabled:cursor-not-allowed disabled:opacity-50"
                                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                aria-pressed={showPassword}
                                disabled={disabled}
                            >
                                {showPassword ? (
                                    <EyeOff className="h-5 w-5" />
                                ) : (
                                    <Eye className="h-5 w-5" />
                                )}
                            </button>
                        )}

                        {/* State Icons */}
                        {computedState === 'error' && !showPasswordToggle && (
                            <AlertCircle className="h-5 w-5 text-red-500" />
                        )}
                        {computedState === 'success' && !showPasswordToggle && (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        )}

                        {/* Custom Right Icon */}
                        {rightIcon && computedState === 'default' && !showPasswordToggle && (
                            <span className="text-zinc-400">{rightIcon}</span>
                        )}
                    </div>
                </div>

                {/* Helper/Error/Success Messages */}
                {(errorMessage || successMessage || helperText) && (
                    <p
                        id={errorMessage ? `${inputId}-error` : `${inputId}-helper`}
                        className={cn(
                            'text-sm',
                            errorMessage && 'text-red-600',
                            successMessage && 'text-emerald-600',
                            !errorMessage && !successMessage && 'text-zinc-500'
                        )}
                    >
                        {errorMessage || successMessage || helperText}
                    </p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';

export { Input, inputVariants };
