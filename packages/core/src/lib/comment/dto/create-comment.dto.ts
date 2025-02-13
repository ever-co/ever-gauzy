import { ApiPropertyOptional, IntersectionType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { ICommentCreateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../core/dto';
import { MentionEmployeeIdsDTO } from '../../mention/dto';
import { Comment } from '../comment.entity';

/**
 * Create Comment data validation request DTO
 */
export class CreateCommentDTO
	extends IntersectionType(TenantOrganizationBaseDTO, Comment, MentionEmployeeIdsDTO)
	implements ICommentCreateInput
{
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	entityName?: string;
}
