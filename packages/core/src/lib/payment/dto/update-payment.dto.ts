import { OmitType } from '@nestjs/swagger';
import { IPaymentUpdateInput } from '@gauzy/contracts';
import { PaymentDTO } from './payment.dto';

/**
 * Update payment request DTO validation.
 */
export class UpdatePaymentDTO extends OmitType(PaymentDTO, ['employee', 'employeeId']) implements IPaymentUpdateInput {}
