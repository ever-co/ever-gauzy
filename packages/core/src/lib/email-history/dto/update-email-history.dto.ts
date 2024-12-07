import { IEmailUpdateInput } from '@gauzy/contracts';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { TenantOrganizationBaseDTO } from './../../core/dto';

export class UpdateEmailHistoryDTO extends TenantOrganizationBaseDTO implements IEmailUpdateInput {

    @ApiPropertyOptional({ type: () => Boolean })
    @IsOptional()
    @IsBoolean()
    readonly isArchived?: boolean;
}
