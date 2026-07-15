export type PinDeliverySide = 'pickup' | 'delivery';

export function getPickupPinMessage(pin: string) {
    return `KargaX: tu PIN de SALIDA es ${pin}. Entregalo solo al conductor verificado.`;
}

export function getDeliveryPinMessage(pin: string) {
    return `KargaX: tu PIN de ENTREGA es ${pin}. Entregalo solo al conductor verificado.`;
}

export function getPinMessage(side: PinDeliverySide, pin: string) {
    return side === 'pickup'
        ? getPickupPinMessage(pin)
        : getDeliveryPinMessage(pin);
}
