import { IBasePerTenantEntityModel, ITenant, IUserCodeInput, IUserEmailInput, IUserTokenInput } from '@gauzy/contracts';
import { ApiProperty, IntersectionType } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';
import { UserCodeDTO, UserEmailDTO, UserTokenDTO } from './../../user/dto';

/**
 * Email confirmation (By TOKEN) DTO request validation
 */
export class ConfirmEmailByTokenDTO extends IntersectionType(
    UserEmailDTO,
    UserTokenDTO,
) implements IUserEmailInput, IUserTokenInput { }

/**
 * Email confirmation (By CODE) DTO request validation
 */
export class ConfirmEmailByCodeDTO extends IntersectionType(
    UserEmailDTO,
    UserCodeDTO
) implements IUserEmailInput, IUserCodeInput, IBasePerTenantEntityModel {

    @ApiProperty({ type: () => String })
    @IsNotEmpty()
    @IsUUID()
    readonly tenantId: ITenant['id'];
}
