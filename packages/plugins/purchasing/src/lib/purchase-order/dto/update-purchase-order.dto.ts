import { PartialType } from '@nestjs/mapped-types';
import { PurchaseOrderDTO } from './purchase-order.dto';

/**
 * An update to a purchase order that has not been sent yet.
 *
 * Everything is optional and the service refuses the update outright once the order has left `DRAFT`:
 * an order the supplier has already been told about cannot have its quantities rewritten underneath
 * the acknowledgement that is on its way back.
 */
export class UpdatePurchaseOrderDTO extends PartialType(PurchaseOrderDTO) {}
