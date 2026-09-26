import { PartialType } from '@nestjs/mapped-types';
import { CreatePaymentCollectionDTO } from './create-payment-collection.dto';

/**
 * Update PaymentCollection request: every field of the create shape, all of them optional.
 */
export class UpdatePaymentCollectionDTO extends PartialType(CreatePaymentCollectionDTO) {}
