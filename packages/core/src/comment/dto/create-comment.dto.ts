import { IntersectionType, OmitType } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { ICommentCreateInput } from '@gauzy/contracts';
import { Comment } from '../comment.entity';

/**
 * Create Comment data validation request DTO
 */
export class CreateCommentDTO
	extends IntersectionType(TenantOrganizationBaseDTO, OmitType(Comment, ['creatorId', 'creator']))
	implements ICommentCreateInput {}
