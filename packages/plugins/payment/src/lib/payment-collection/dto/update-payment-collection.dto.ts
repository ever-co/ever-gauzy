import { OmitType, PartialType } from '@nestjs/mapped-types';
import { WithoutInitializers } from '@gauzy/common';
import { PAYMENT_COLLECTION_SERVER_OWNED_MEMBERS } from '../../payment.types';
import { CreatePaymentCollectionDTO } from './create-payment-collection.dto';

/**
 * Update PaymentCollection request: the members a caller may change, all of them optional.
 *
 * Two rules shape it (review R3-04):
 * - **No server-owned member.** The running totals (`authorizedAmount`, `capturedAmount`, `refundedAmount`,
 *   `canceledAmount`) are the only record of what the sessions moved, the status and the settlement time are derived
 *   from them, and the order or cart a collection was opened for is fixed when it is opened. The route mounts
 *   `forbidNonWhitelisted`, so a body naming one of them is refused with a 400 rather than written. The GraphQL
 *   `UpdatePaymentCollectionInput` admits none of them either (§3.1: REST is no wider than GraphQL); REST keeps the
 *   amount and the currency on top, which `updateCollection` refuses once money has moved.
 * - **No default.** Built through `WithoutInitializers`, so a partial update does not carry the create DTO's
 *   `'0'` totals and `NOT_PAID` status - `PUT /payment-collections/:id {metadata}` used to zero the four totals.
 */
export class UpdatePaymentCollectionDTO extends WithoutInitializers(
	PartialType(OmitType(CreatePaymentCollectionDTO, PAYMENT_COLLECTION_SERVER_OWNED_MEMBERS))
) {}
