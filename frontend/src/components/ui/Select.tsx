// =============================================================================
// KargaX - Select Component
// Luxury dropdown with search, async loading, and accessibility
// =============================================================================

'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectOption {
    value: string;
    label: string;
    description?: string;
    icon?: React.ReactNode;
    disabled?: boolean;
}

export interface SelectProps {
    options: SelectOption[];
    value?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    label?: string;
    helperText?: string;
    errorMessage?: string;
    disabled?: boolean;
    searchable?: boolean;
    searchPlaceholder?: string;
    isLoading?: boolean;
    className?: string;
    name?: string;
    required?: boolean;
    renderOption?: (option: SelectOption) => React.ReactNode;
    noResultsMessage?: string;
    size?: 'sm' | 'md' | 'lg';
}

export const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
    (
        {
            options,
            value,
            onChange,
            placeholder = 'Selecciona una opcion',
            label,
            helperText,
            errorMessage,
            disabled = false,
            searchable = false,
            searchPlaceholder = 'Buscar...',
            isLoading = false,
            className,
            name,
            required = false,
            renderOption,
            noResultsMessage = 'No se encontraron resultados',
            size = 'md',
        },
        ref
    ) => {
        const [isOpen, setIsOpen] = React.useState(false);
        const [searchQuery, setSearchQuery] = React.useState('');
        const [highlightedIndex, setHighlightedIndex] = React.useState(0);
        const [menuPosition, setMenuPosition] = React.useState<{
            top: number;
            left: number;
            width: number;
            maxHeight: number;
            placement: 'top' | 'bottom';
        } | null>(null);
        const [canUsePortal, setCanUsePortal] = React.useState(false);

        const containerRef = React.useRef<HTMLDivElement>(null);
        const dropdownRef = React.useRef<HTMLDivElement>(null);
        const searchInputRef = React.useRef<HTMLInputElement>(null);
        const optionsRef = React.useRef<HTMLDivElement>(null);
        const inputId = React.useId();

        const selectedOption = React.useMemo(
            () => options.find((opt) => opt.value === value),
            [options, value]
        );

        const filteredOptions = React.useMemo(() => {
            if (!searchQuery.trim()) return options;

            const query = searchQuery.toLowerCase();
            return options.filter((option) =>
                option.label.toLowerCase().includes(query) ||
                option.description?.toLowerCase().includes(query)
            );
        }, [options, searchQuery]);

        const handleToggle = () => {
            if (disabled || isLoading) return;
            setIsOpen(!isOpen);
            setSearchQuery('');
            setHighlightedIndex(0);
        };

        const updateMenuPosition = React.useCallback(() => {
            if (!containerRef.current) return;

            const rect = containerRef.current.getBoundingClientRect();
            const gap = 8;
            const viewportPadding = 12;
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
            const spaceBelow = viewportHeight - rect.bottom - viewportPadding - gap;
            const spaceAbove = rect.top - viewportPadding - gap;
            const placement = spaceBelow < 180 && spaceAbove > spaceBelow ? 'top' : 'bottom';
            const availableHeight = Math.max(160, placement === 'top' ? spaceAbove : spaceBelow);
            const maxHeight = Math.min(352, availableHeight);

            setMenuPosition({
                top: placement === 'top'
                    ? Math.max(viewportPadding, rect.top - gap - maxHeight)
                    : Math.min(viewportHeight - viewportPadding - maxHeight, rect.bottom + gap),
                left: Math.max(viewportPadding, rect.left),
                width: Math.max(240, Math.min(rect.width, window.innerWidth - viewportPadding * 2)),
                maxHeight,
                placement,
            });
        }, []);

        const handleSelect = (optionValue: string) => {
            const option = options.find((opt) => opt.value === optionValue);
            if (option?.disabled) return;

            onChange?.(optionValue);
            setIsOpen(false);
            setSearchQuery('');
        };

        const handleKeyDown = (event: React.KeyboardEvent) => {
            switch (event.key) {
                case 'Enter':
                case ' ':
                    event.preventDefault();
                    if (isOpen && filteredOptions[highlightedIndex]) {
                        handleSelect(filteredOptions[highlightedIndex].value);
                    } else {
                        handleToggle();
                    }
                    break;
                case 'Escape':
                    setIsOpen(false);
                    break;
                case 'ArrowDown':
                    event.preventDefault();
                    if (!isOpen) {
                        setIsOpen(true);
                    } else {
                        setHighlightedIndex((prev) => Math.min(prev + 1, filteredOptions.length - 1));
                    }
                    break;
                case 'ArrowUp':
                    event.preventDefault();
                    if (isOpen) {
                        setHighlightedIndex((prev) => Math.max(prev - 1, 0));
                    }
                    break;
                case 'Home':
                    if (isOpen) {
                        event.preventDefault();
                        setHighlightedIndex(0);
                    }
                    break;
                case 'End':
                    if (isOpen) {
                        event.preventDefault();
                        setHighlightedIndex(filteredOptions.length - 1);
                    }
                    break;
            }
        };

        React.useEffect(() => {
            const handleClickOutside = (event: MouseEvent) => {
                const target = event.target as Node;
                if (
                    containerRef.current &&
                    !containerRef.current.contains(target) &&
                    !dropdownRef.current?.contains(target)
                ) {
                    setIsOpen(false);
                }
            };

            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }, []);

        React.useEffect(() => {
            setCanUsePortal(true);
        }, []);

        React.useEffect(() => {
            if (!isOpen) return;

            updateMenuPosition();
            window.addEventListener('resize', updateMenuPosition);
            window.addEventListener('scroll', updateMenuPosition, true);

            return () => {
                window.removeEventListener('resize', updateMenuPosition);
                window.removeEventListener('scroll', updateMenuPosition, true);
            };
        }, [isOpen, updateMenuPosition]);

        React.useEffect(() => {
            if (isOpen && searchable && searchInputRef.current) {
                searchInputRef.current.focus();
            }
        }, [isOpen, searchable]);

        React.useEffect(() => {
            if (isOpen && optionsRef.current) {
                const highlightedElement = optionsRef.current.children[highlightedIndex] as HTMLElement;
                highlightedElement?.scrollIntoView({ block: 'nearest' });
            }
        }, [highlightedIndex, isOpen]);

        const sizeClasses = {
            sm: 'h-9 text-sm px-3',
            md: 'h-11 text-base px-4',
            lg: 'h-12 text-lg px-5',
        };

        const dropdown = isOpen && menuPosition ? (
            <div
                ref={dropdownRef}
                data-kx-select-menu="true"
                className={cn(
                    'pointer-events-auto fixed z-[1000] overflow-hidden rounded-lg border border-zinc-200 bg-white text-zinc-950 shadow-[0_28px_80px_-42px_rgba(0,0,0,.78)]',
                    'animate-in fade-in slide-in-from-top-2 duration-200'
                )}
                style={{
                    top: menuPosition.top,
                    left: menuPosition.left,
                    width: menuPosition.width,
                    maxHeight: menuPosition.maxHeight,
                    pointerEvents: 'auto',
                }}
            >
                {searchable && (
                    <div className="border-b border-zinc-100 bg-white p-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setHighlightedIndex(0);
                                }}
                                placeholder={searchPlaceholder}
                                className="w-full rounded-md border border-zinc-200 bg-white py-2 pl-9 pr-8 text-sm text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950/10"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </div>
                )}

                <div
                    ref={optionsRef}
                    role="listbox"
                    className="overflow-auto bg-white py-1"
                    style={{ maxHeight: searchable ? menuPosition.maxHeight - 58 : menuPosition.maxHeight }}
                >
                    {filteredOptions.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-zinc-500">
                            {noResultsMessage}
                        </div>
                    ) : (
                        filteredOptions.map((option, index) => (
                            <button
                                key={option.value}
                                type="button"
                                role="option"
                                aria-selected={option.value === value}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => handleSelect(option.value)}
                                onMouseEnter={() => setHighlightedIndex(index)}
                                disabled={option.disabled}
                                className={cn(
                                    'flex w-full items-center justify-between gap-3 bg-white px-4 py-2.5 text-left text-zinc-950 transition-colors',
                                    index === highlightedIndex && 'bg-zinc-50',
                                    option.value === value && 'bg-zinc-100',
                                    option.disabled && 'cursor-not-allowed opacity-50',
                                    !option.disabled && 'hover:bg-zinc-50'
                                )}
                            >
                                {renderOption ? (
                                    renderOption(option)
                                ) : (
                                    <div className="flex min-w-0 items-center gap-3">
                                        {option.icon}
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-zinc-950">
                                                {option.label}
                                            </p>
                                            {option.description && (
                                                <p className="truncate text-xs text-zinc-500">
                                                    {option.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {option.value === value && <Check className="h-4 w-4 shrink-0 text-zinc-950" />}
                            </button>
                        ))
                    )}
                </div>
            </div>
        ) : null;

        return (
            <div className={cn('relative min-w-0 w-full', className)} ref={containerRef}>
                {name && <input type="hidden" name={name} value={value || ''} />}

                {label && (
                    <label htmlFor={inputId} className="mb-2 block text-sm font-medium text-zinc-700">
                        {label}
                        {required && <span className="ml-1 text-red-500">*</span>}
                    </label>
                )}

                <button
                    ref={ref}
                    type="button"
                    id={inputId}
                    onClick={handleToggle}
                    onKeyDown={handleKeyDown}
                    disabled={disabled || isLoading}
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                    aria-labelledby={label ? inputId : undefined}
                    className={cn(
                        'flex w-full items-center justify-between rounded-lg border bg-white/90 transition-all duration-200',
                        sizeClasses[size],
                        disabled && 'cursor-not-allowed bg-zinc-50 opacity-50',
                        errorMessage
                            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                            : 'border-zinc-200 hover:border-zinc-300 focus:border-zinc-950 focus:ring-2 focus:ring-zinc-950/10',
                        'focus:outline-none'
                    )}
                >
                    <span className={cn('truncate text-left', selectedOption ? 'text-zinc-950' : 'text-zinc-400')}>
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Cargando...
                            </span>
                        ) : selectedOption ? (
                            <span className="flex min-w-0 items-center gap-2">
                                {selectedOption.icon}
                                <span className="truncate">{selectedOption.label}</span>
                            </span>
                        ) : (
                            placeholder
                        )}
                    </span>

                    <ChevronDown
                        className={cn(
                            'h-5 w-5 shrink-0 text-zinc-400 transition-transform duration-200',
                            isOpen && 'rotate-180'
                        )}
                    />
                </button>

                {(errorMessage || helperText) && (
                    <p className={cn('mt-2 text-sm', errorMessage ? 'text-red-600' : 'text-zinc-500')}>
                        {errorMessage || helperText}
                    </p>
                )}

                {canUsePortal && dropdown ? createPortal(dropdown, document.body) : dropdown}
            </div>
        );
    }
);

Select.displayName = 'Select';

export default Select;
