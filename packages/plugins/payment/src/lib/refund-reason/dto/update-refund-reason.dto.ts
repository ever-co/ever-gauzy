import { ApiPropertyOptional } from '@nestjs/swagger';
import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateRefundReasonDTO } from './create-refund-reason.dto';

/**
 * Update RefundReason request: every field of the create shape, all of them optional, and the active state.
 *
 * `isActive` is declared here rather than on the create shape (a reason is created active). The route says it
 * "changes a reason: its label, its description, its parent or its active state" and the GraphQL
 * `UpdateRefundReasonInput` carries `isActive`, but the DTO did not, so under `forbidNonWhitelisted` a REST body
 * stating it was refused with a 400, and a deactivated reason could be reactivated over GraphQL only (R2-G12).
 */
export class UpdateRefundReasonDTO extends PartialType(CreateRefundReasonDTO) {
	/**
	 * Whether the reason is offered for new refunds. `false` is what `POST /refund-reasons/:id/deactivate` writes.
	 */
	@ApiPropertyOptional({ type: () => Boolean })
	@IsOptional()
	@IsBoolean()
	readonly isActive?: boolean;
}
