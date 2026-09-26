import { PartialType } from '@nestjs/mapped-types';
import { CreatePaymentProviderDTO } from './create-payment-provider.dto';

/**
 * Update PaymentProvider request: every field of the create shape, all of them optional.
 */
export class UpdatePaymentProviderDTO extends PartialType(CreatePaymentProviderDTO) {}
