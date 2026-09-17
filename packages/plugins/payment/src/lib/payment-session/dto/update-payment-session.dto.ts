import { PartialType } from '@nestjs/mapped-types';
import { CreatePaymentSessionDTO } from './create-payment-session.dto';

/**
 * Update PaymentSession request: every field of the create shape, all of them optional.
 */
export class UpdatePaymentSessionDTO extends PartialType(CreatePaymentSessionDTO) {}
