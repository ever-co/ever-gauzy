import { PartialType } from '@nestjs/mapped-types';
import { CreatePaymentCaptureDTO } from './create-payment-capture.dto';

/**
 * Update PaymentCapture request: every field of the create shape, all of them optional.
 */
export class UpdatePaymentCaptureDTO extends PartialType(CreatePaymentCaptureDTO) {}
