import { RefundReasonDTO } from './refund-reason.dto';

/**
 * Create RefundReason request.
 *
 * The writable surface is the aggregate's own DTO; the tenant, the organization and the audit
 * columns come from the request context, never from the body.
 */
export class CreateRefundReasonDTO extends RefundReasonDTO {}
