import { IntersectionType } from '@nestjs/mapped-types';
import { IPaymentCreateInput } from '@gauzy/contracts';
import { PaymentDTO } from './payment.dto';

/**
 * Create payment request DTO validation
 *
 */
export class CreatePaymentDTO extends IntersectionType(PaymentDTO) implements IPaymentCreateInput {}
