import { PartialType } from '@nestjs/mapped-types';
import { EntitlementDTO } from './entitlement.dto';

/**
 * An edit to a right.
 *
 * Everything is optional and the service refuses the parts that are not an edit at all: the
 * provenance, the number and the kind are what the right *is*, so they are ignored if a body carries
 * them, while the quantity, the term and the conditions may be changed — a quantity decrease is what
 * a partial refund lowers the ceiling with.
 */
export class UpdateEntitlementDTO extends PartialType(EntitlementDTO) {}
