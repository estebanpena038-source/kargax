/**
 * =============================================================================
 * KARGAX - PICKING COMPONENTS BARREL EXPORT
 * /components/picking/index.ts
 * 
 * Exporta todos los componentes del sistema de picking para uso fácil.
 * 
 * USAGE:
 * import { PickingChecklist, GPSVerification, PinInput } from '@/components/picking';
 * 
 * =============================================================================
 */

// =============================================================================
// COMPONENT EXPORTS
// =============================================================================

export { PickingChecklist } from './PickingChecklist';
export type { PickingChecklistProps, ChecklistMode } from './PickingChecklist';

export { GPSVerification } from './GPSVerification';
export type { GPSVerificationProps, LocationType, VerificationStatus } from './GPSVerification';

export { PinInput } from './PinInput';
export type { PinInputProps, PinStatus } from './PinInput';

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

import { PickingChecklist } from './PickingChecklist';
import { GPSVerification } from './GPSVerification';
import { PinInput } from './PinInput';

const PickingComponents = {
    PickingChecklist,
    GPSVerification,
    PinInput,
};

export default PickingComponents;
