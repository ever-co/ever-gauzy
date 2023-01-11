import { IGetTaskOptions, IOrganizationProject } from '@gauzy/contracts';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { TenantOrganizationBaseDTO } from '../../core/dto';

/**
 * GET task max number DTO validation
 */
export class TaskMaxNumberQueryDTO extends TenantOrganizationBaseDTO implements IGetTaskOptions {

    @ApiPropertyOptional({ type : () => String })
    @IsOptional()
    @IsUUID()
    readonly projectId: IOrganizationProject['id'];
}