import { ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsIn, IsOptional, IsUUID } from 'class-validator';
import { ID, ITaskMetadataBootstrapQuery, TASK_METADATA_SECTIONS, TaskMetadataSection } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../../core/dto/tenant-organization-base.dto';

export class TaskMetadataBootstrapQueryDTO
	extends PickType(TenantOrganizationBaseDTO, ['organizationId'] as const)
	implements ITaskMetadataBootstrapQuery
{
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly organizationTeamId?: ID;

	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly projectId?: ID;

	@ApiPropertyOptional({ enum: TASK_METADATA_SECTIONS, isArray: true })
	@Transform(
		({ value }: TransformFnParams) => {
			if (value === undefined) {
				return undefined;
			}

			const values = Array.isArray(value) ? value : [value];
			const sections = values.flatMap((entry) =>
				typeof entry === 'string' ? entry.split(',').map((section) => section.trim()) : [entry]
			);

			return [...new Set(sections)];
		},
		{ toClassOnly: true }
	)
	@IsOptional()
	@IsArray()
	@ArrayNotEmpty()
	@IsIn(TASK_METADATA_SECTIONS, { each: true })
	readonly include?: TaskMetadataSection[];
}
