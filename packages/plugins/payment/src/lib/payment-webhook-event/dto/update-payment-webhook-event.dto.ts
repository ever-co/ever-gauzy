import { PartialType } from '@nestjs/mapped-types';
import { CreatePaymentWebhookEventDTO } from './create-payment-webhook-event.dto';

/**
 * Update PaymentWebhookEvent request: every field of the create shape, all of them optional.
 */
export class UpdatePaymentWebhookEventDTO extends PartialType(CreatePaymentWebhookEventDTO) {}
