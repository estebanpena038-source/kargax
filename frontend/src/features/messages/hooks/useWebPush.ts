'use client';

import { useState, useEffect } from 'react';

export function useWebPush() {
    const [isSupported, setIsSupported] = useState(false);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [permission, setPermission] = useState<NotificationPermission>('default');

    useEffect(() => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
            setIsSupported(true);
            setPermission(Notification.permission);
        }
    }, []);

    const requestPermission = async () => {
        if (!isSupported) {
            console.error('El navegador no soporta notificaciones Web Push.');
            return;
        }
        try {
            const result = await Notification.requestPermission();
            setPermission(result);
            if (result === 'granted') {
                await subscribe();
            } else {
                console.warn('Permiso para notificaciones denegado.');
            }
        } catch (error) {
            console.error('Error solicitando permisos:', error);
        }
    };

    const subscribe = async () => {
        if (!isSupported || permission !== 'granted') return;
        try {
            const registration = await navigator.serviceWorker.ready;
            
            // Get public key from env or constants
            const applicationServerKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
            
            if (applicationServerKey) {
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey
                });
                setIsSubscribed(true);
                console.log('Suscripción exitosa:', subscription);
                // Here we would normally send the subscription object to Supabase push_subscriptions table
            }
        } catch (error) {
            console.error('Error al suscribir a notificaciones:', error);
        }
    };

    const unsubscribe = async () => {
        if (!isSupported) return;
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            if (subscription) {
                await subscription.unsubscribe();
                setIsSubscribed(false);
                console.log('Desuscripción exitosa');
            }
        } catch (error) {
            console.error('Error al desuscribir:', error);
        }
    };

    return { isSupported, isSubscribed, permission, requestPermission, subscribe, unsubscribe };
}
