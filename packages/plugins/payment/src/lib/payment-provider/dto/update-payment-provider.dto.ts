import { PartialType } from '@nestjs/mapped-types';
import { WithoutInitializers } from '@gauzy/common';
import { CreatePaymentProviderDTO } from './create-payment-provider.dto';

/**
 * Update PaymentProvider request: every field of the create shape, all of them optional.
 *
 * Built through `WithoutInitializers`, so a partial update does not carry the create DTO's defaults back over the
 * stored values (review R3-04/R3-05).
 */
export class UpdatePaymentProviderDTO extends WithoutInitializers(PartialType(CreatePaymentProviderDTO)) {}
