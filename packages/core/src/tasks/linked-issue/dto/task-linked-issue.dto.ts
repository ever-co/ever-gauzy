import { TaskRelatedIssuesRelationEnum } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { TenantOrganizationBaseDTO } from '../../../core/dto';
import { IsEnum, IsUUID } from 'class-validator';

export class TaskLinkedIssueDTO extends TenantOrganizationBaseDTO {
	@ApiProperty({ type: () => String, enum: TaskRelatedIssuesRelationEnum })
	@IsEnum(TaskRelatedIssuesRelationEnum)
	action: TaskRelatedIssuesRelationEnum;

	@ApiProperty({ type: () => String })
	@IsUUID()
	taskFromId: string;

	@ApiProperty({ type: () => String })
	@IsUUID()
	taskToId: string;
}
