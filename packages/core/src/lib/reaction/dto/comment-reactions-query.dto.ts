import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';
import { BaseEntityEnum, ICommentReactionsFindInput, ID } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../core/dto';

/**
 * The record whose comments' reactions `GET /reaction/comments` summarizes. The organization is checked against the
 * caller's own, as on every tenant-and-organization query.
 */
export class CommentReactionsQueryDTO extends TenantOrganizationBaseDTO implements ICommentReactionsFindInput {
	@ApiProperty({ enum: BaseEntityEnum })
	@IsEnum(BaseEntityEnum)
	readonly entity: BaseEntityEnum;

	@ApiProperty({ type: () => String })
	@IsUUID()
	readonly entityId: ID;
}
