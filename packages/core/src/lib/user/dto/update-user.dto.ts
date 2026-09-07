import { ApiPropertyOptional, IntersectionType, PartialType, PickType } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { IUserUpdateInput } from '@gauzy/contracts';
import { User } from '../user.entity';
import { CreateUserDTO } from './create-user.dto';

/**
 * Base class for updating user-related fields.
 *
 * `imageId` is declared because the route validates with `whitelist: true`, which strips every
 * undeclared property. Without it a client could upload an avatar (creating the ImageAsset) and then
 * fail to attach it: `PUT /user/:id` with `{ imageId }` answered `202 Accepted` while silently
 * dropping the value, so the avatar never changed — and `{ imageId: null }` never cleared one.
 * It carries `@IsOptional()` + `@IsUUID()` from the entity, so `null` is accepted (clearing the
 * avatar) while a malformed id is still rejected.
 */
class UpdateUserBaseDTO extends PickType(User, [
	'defaultOrganizationId',
	'defaultTeamId',
	'lastOrganizationId',
	'lastTeamId',
	'imageId',
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
	// Same floor as registration (`RegisterUserDTO` uses MinLength(8)). Without it this route was the
	// one way into the system to set a one-character password: `updateProfile` hashes whatever it is
	// given, so the weak value is stored just as happily as a strong one.
	@MinLength(8, { message: 'Password should be at least 8 characters long.' })
	readonly hash?: string;
}

/**
 * Update User Data Transfer Object (DTO) validation.
 */
export class UpdateUserDTO
	extends IntersectionType(PartialType(CreateUserDTO), IntersectionType(UpdateUserBaseDTO, UpdateUserCredentialsDTO))
	implements IUserUpdateInput {}
