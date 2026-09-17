import { PartialType } from '@nestjs/mapped-types';
import { EntitlementActivationDTO } from './entitlement-activation.dto';

/**
 * An edit to an activation.
 *
 * Only descriptive fields are open: the device identity is what the seat count is taken over, and a
 * body that could rewrite it would let a client move a slot to a different machine without going
 * through the activation path the limit is enforced on.
 */
export class UpdateEntitlementActivationDTO extends PartialType(EntitlementActivationDTO) {}
