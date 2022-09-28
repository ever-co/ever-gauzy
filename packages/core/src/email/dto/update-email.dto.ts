import { IEmailUpdateInput } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { TenantOrganizationBaseDTO } from './../../core/dto';

export class UpdateEmailDTO extends TenantOrganizationBaseDTO implements IEmailUpdateInput {

    @ApiProperty({ type: () => Boolean, readOnly: true })
	@IsOptional()
    readonly isArchived?: boolean;
}