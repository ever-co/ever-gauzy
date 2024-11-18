import { OmitType, PartialType } from '@nestjs/swagger';
import { ICommentUpdateInput } from '@gauzy/contracts';
import { CreateCommentDTO } from './create-comment.dto';

/**
 * Create Comment data validation request DTO
 */
export class UpdateCommentDTO
	extends PartialType(OmitType(CreateCommentDTO, ['entity', 'entityId']))
	implements ICommentUpdateInput {}
