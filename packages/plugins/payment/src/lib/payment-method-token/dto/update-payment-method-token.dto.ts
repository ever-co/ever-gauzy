import { PartialType } from '@nestjs/mapped-types';
import { PaymentMethodTokenDTO } from './payment-method-token.dto';

/**
 * Update PaymentMethodToken request: the descriptive fields of the instrument, all optional.
 *
 * The provider's reference, the account it belongs to, the provider key and the kind are not among
 * them, because none of the four is a descriptive fact: a reference is what the provider issued, an
 * instrument never moves between accounts or providers, and the kind decides both the default rule
 * and whether a mandate is required before an off-session charge. A body that states one is refused by
 * the whitelisting pipe rather than accepted and ignored.
 */
export class UpdatePaymentMethodTokenDTO extends PartialType(PaymentMethodTokenDTO) {}
