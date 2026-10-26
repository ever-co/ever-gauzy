import { PartialType } from '@nestjs/mapped-types';
import { PurchaseOrderLineDTO } from './purchase-order-line.dto';

/**
 * An update to a purchase-order line.
 *
 * The received counters are on the read shape and stay unreachable from here: the service writes the
 * columns it accepts explicitly, so an update can change what was ordered and never what arrived.
 */
export class UpdatePurchaseOrderLineDTO extends PartialType(PurchaseOrderLineDTO) {}
