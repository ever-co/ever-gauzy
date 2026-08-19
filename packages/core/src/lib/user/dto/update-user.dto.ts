import { ApiPropertyOptional, IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IUserUpdateInput } from '@gauzy/contracts';
import { User } from '../user.entity';
import { CreateUserDTO } from './create-user.dto';

/**
 * Base class for updating user-related fields.
 */
class UpdateUserBaseDTO extends PickType(User, [
	'defaultOrganizationId',
	'defaultTeamId',
	'lastOrganizationId',
	'lastTeamId',
	'isActive'
] as const) {}

/**
 * The credential half of a profile update.
 *
 * `hash` carries the NEW PASSWORD in clear text (`UserService.updateProfile` hashes it before the
 * write) — that is the long-standing contract the profile form uses. It is declared explicitly so the
 * route can validate with `whitelist: true`: every property the DTO does not declare is stripped, which
 * is what keeps identity/verification columns (`id`, `emailVerifiedAt`, `emailToken`, `refreshToken`, …)
 * out of a body that is otherwise spread straight onto the entity.
 */
class UpdateUserCredentialsDTO {
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsString()
	@IsNotEmpty()
	readonly hash?: string;
}

/**
 * Update User Data Transfer Object (DTO) validation.
 */
export class UpdateUserDTO
	extends IntersectionType(PartialType(CreateUserDTO), IntersectionType(UpdateUserBaseDTO, UpdateUserCredentialsDTO))
	implements IUserUpdateInput {}
