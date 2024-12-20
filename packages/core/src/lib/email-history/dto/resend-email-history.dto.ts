import { IEmailHistory, IResendEmailInput } from '@gauzy/contracts';
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { TenantOrganizationBaseDTO } from '../../core/dto';

export class ResendEmailHistoryDTO extends TenantOrganizationBaseDTO implements IResendEmailInput {

    @ApiProperty({ type: () => String })
    @IsUUID()
    readonly id: IEmailHistory['id'];

}
