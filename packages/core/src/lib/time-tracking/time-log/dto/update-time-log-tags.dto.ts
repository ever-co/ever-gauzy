import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';
import { ID, ITimeLogTagsInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from './../../../core/dto';

/**
 * The tags a time log is filed under from now on (`PUT /timesheet/time-log/:id/tags`): tags of the log's organization
 * or of its whole tenant, by id. An empty list takes them all off.
 */
export class UpdateTimeLogTagsDTO extends TenantOrganizationBaseDTO implements ITimeLogTagsInput {
	@ApiProperty({ type: () => String, isArray: true })
	@IsArray()
	@IsUUID('all', { each: true })
	readonly tags: ID[];
}
