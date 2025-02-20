import { IntersectionType } from '@nestjs/mapped-types';
import { IPayment } from '@gauzy/contracts';
import { PaymentDTO } from './payment.dto';

/**
 * Create payment request DTO validation
 *
 */
export class CreatePaymentDTO extends IntersectionType(PaymentDTO) implements IPayment {}
