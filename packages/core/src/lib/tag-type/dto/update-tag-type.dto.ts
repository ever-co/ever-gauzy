import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { ID, ITagTypeUpdateInput } from '@gauzy/contracts';
import { TenantOrganizationBaseDTO } from '../../core';

export class UpdateTagTypeDTO extends TenantOrganizationBaseDTO implements ITagTypeUpdateInput {
	@ApiProperty({ type: () => String })
	@IsString()
	readonly type: string;
}
