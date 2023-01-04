import { IBasePerTenantEntityModel, ITenant, IUserCodeInput, IUserEmailInput, IUserTokenInput } from '@gauzy/contracts';
import { ApiProperty, IntersectionType } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { IsTenantBelongsToUser } from './../../shared/validators';
import { TenantBaseDTO } from './../../core/dto';
import { UserCodeDTO, UserEmailDTO, UserTokenDTO } from './../../user/dto';

/**
 * Email confirmation (By TOKEN) DTO request validation
 */
export class ConfirmEmailByTokenDTO extends IntersectionType(
    UserEmailDTO,
    UserTokenDTO,
) implements IUserEmailInput, IUserTokenInput {}

/**
 * Email confirmation (By CODE) DTO request validation
 */
export class ConfirmEmailByCodeDTO extends IntersectionType(
    UserEmailDTO,
    IntersectionType(UserCodeDTO, TenantBaseDTO)
) implements IUserEmailInput, IUserCodeInput, IBasePerTenantEntityModel {

    @ApiProperty({ type: () => String })
	@IsString()
	@IsTenantBelongsToUser()
	readonly tenantId: ITenant['id'];
}