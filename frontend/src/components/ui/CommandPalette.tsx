// =============================================================================
// KargaX — Command Palette (Cmd+K)
// Linear/Vercel-style keyboard-first navigation
// =============================================================================

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
    BarChart3, Bell, CreditCard, FileText, HelpCircle, Home, LifeBuoy,
    LogOut, Package, Search, Settings, Shield, Truck, User, Users, Warehouse,
    Command,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/features/auth/store/authStore';

interface CommandItem {
    id: string;
    label: string;
    icon: React.ElementType;
    href?: string;
    action?: () => void;
    keywords?: string[];
    section: string;
}

export function CommandPalette() {
    const router = useRouter();
    const { user, signOut } = useAuthStore();
    const [open, setOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');
    const [selected, setSelected] = React.useState(0);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const items: CommandItem[] = React.useMemo(() => {
        const nav: CommandItem[] = [
            { id: 'dashboard', label: 'Dashboard', icon: Home, href: '/dashboard', section: 'Navegación', keywords: ['inicio', 'home'] },
            { id: 'ofertas', label: 'Ofertas de carga', icon: Package, href: '/ofertas', section: 'Navegación', keywords: ['publicar', 'cargas'] },
            { id: 'postulaciones', label: 'Mi trabajo', icon: FileText, href: '/postulaciones', section: 'Navegación', keywords: ['aceptadas', 'postulaciones', 'trabajos'] },
            { id: 'viaje', label: 'Viaje activo', icon: Truck, href: '/viaje', section: 'Navegación', keywords: ['trip'] },
            { id: 'billetera', label: 'Billetera', icon: CreditCard, href: '/billetera', section: 'Navegación', keywords: ['pagos', 'wallet'] },
            { id: 'bodegas', label: 'Bodegas', icon: Warehouse, href: '/bodegas', section: 'Navegación', keywords: ['warehouse'] },
            { id: 'equipo', label: 'Equipo', icon: Users, href: '/equipo', section: 'Navegación', keywords: ['team'] },
            { id: 'mensajes', label: 'Mensajes', icon: LifeBuoy, href: '/mensajes', section: 'Navegación', keywords: ['chat'] },
            { id: 'notificaciones', label: 'Notificaciones', icon: Bell, href: '/notificaciones', section: 'Navegación' },
            { id: 'planes', label: 'Planes y facturación', icon: BarChart3, href: '/planes', section: 'Navegación', keywords: ['billing', 'pricing'] },
        ];
        const account: CommandItem[] = [
            { id: 'perfil', label: 'Mi Perfil', icon: User, href: '/perfil', section: 'Cuenta' },
            { id: 'configuracion', label: 'Configuración', icon: Settings, href: '/configuracion', section: 'Cuenta' },
            { id: 'ayuda', label: 'Centro de Ayuda', icon: HelpCircle, href: '/ayuda', section: 'Cuenta' },
            { id: 'logout', label: 'Cerrar sesión', icon: LogOut, action: () => signOut(), section: 'Cuenta', keywords: ['salir'] },
        ];
        if (user?.userType === 'admin') {
            nav.push({ id: 'admin', label: 'Panel Admin', icon: Shield, href: '/admin', section: 'Navegación', keywords: ['superadmin'] });
            nav.push({ id: 'corporativo', label: 'Corporativo', icon: BarChart3, href: '/corporativo', section: 'Navegación', keywords: ['holding'] });
        }
        return [...nav, ...account];
    }, [user, signOut]);

    const filtered = React.useMemo(() => {
        if (!search) return items;
        const q = search.toLowerCase();
        return items.filter(
            (item) =>
                item.label.toLowerCase().includes(q) ||
                item.section.toLowerCase().includes(q) ||
                item.keywords?.some((kw) => kw.includes(q))
        );
    }, [items, search]);

    // Keyboard shortcut
    React.useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setOpen((prev) => !prev);
            }
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, []);

    // Focus input when opening
    React.useEffect(() => {
        if (open) {
            setSearch('');
            setSelected(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    // Arrow key navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)); }
        if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
        if (e.key === 'Enter' && filtered[selected]) {
            e.preventDefault();
            const item = filtered[selected];
            if (item.href) router.push(item.href);
            if (item.action) item.action();
            setOpen(false);
        }
    };

    const execute = (item: CommandItem) => {
        if (item.href) router.push(item.href);
        if (item.action) item.action();
        setOpen(false);
    };

    // Group by section
    const sections = React.useMemo(() => {
        const map = new Map<string, CommandItem[]>();
        filtered.forEach((item) => {
            if (!map.has(item.section)) map.set(item.section, []);
            map.get(item.section)!.push(item);
        });
        return map;
    }, [filtered]);

    let flatIndex = -1;

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 backdrop-blur-sm pt-[15vh]"
                    onClick={() => setOpen(false)}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: -10 }}
                        transition={{ duration: 0.15 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                    >
                        {/* Search input */}
                        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
                            <Search className="h-5 w-5 text-slate-400" />
                            <input
                                ref={inputRef}
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setSelected(0); }}
                                onKeyDown={handleKeyDown}
                                placeholder="Buscar página, acción..."
                                className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                            />
                            <kbd className="hidden sm:flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                                ESC
                            </kbd>
                        </div>

                        {/* Results */}
                        <div className="max-h-[50vh] overflow-y-auto p-2">
                            {filtered.length === 0 ? (
                                <div className="py-10 text-center">
                                    <p className="text-sm text-slate-500">No se encontraron resultados</p>
                                </div>
                            ) : (
                                Array.from(sections.entries()).map(([section, sectionItems]) => (
                                    <div key={section}>
                                        <p className="mb-1 mt-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                            {section}
                                        </p>
                                        {sectionItems.map((item) => {
                                            flatIndex++;
                                            const idx = flatIndex;
                                            return (
                                                <button
                                                    key={item.id}
                                                    onClick={() => execute(item)}
                                                    onMouseEnter={() => setSelected(idx)}
                                                    className={cn(
                                                        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                                                        selected === idx
                                                            ? 'bg-green-50 text-green-700'
                                                            : 'text-slate-700 hover:bg-slate-50'
                                                    )}
                                                >
                                                    <item.icon className="h-4 w-4 shrink-0" />
                                                    <span className="flex-1 text-left">{item.label}</span>
                                                    {item.href && (
                                                        <span className="text-[10px] text-slate-400">{item.href}</span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400">
                            <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1"><kbd className="rounded border border-slate-200 bg-slate-50 px-1">↑↓</kbd> Navegar</span>
                                <span className="flex items-center gap-1"><kbd className="rounded border border-slate-200 bg-slate-50 px-1">↵</kbd> Abrir</span>
                            </div>
                            <span className="flex items-center gap-1">
                                <Command className="h-3 w-3" /> K para abrir
                            </span>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
