import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
	IsObject,
	IsOptional,
	IsString,
	IsUUID,
	ValidateIf,
	ValidationArguments,
	registerDecorator
} from 'class-validator';
import { IOrganization, IBasePerTenantAndOrganizationEntityModel, ID } from '@gauzy/contracts';
import { TenantBaseDTO } from './tenant-base.dto';
import { IsOrganizationBelongsToUser } from './../../shared/validators';

/**
 * Whether the client actually sent a value for the field (`null`, `undefined` and `''` count as absent,
 * as they did for the falsy checks these conditions replace).
 */
const isSent = (value: unknown): boolean => value !== undefined && value !== null && value !== '';

/**
 * When `organizationId` is sent as well, the `organization` object must refer to the SAME organization.
 * Otherwise a request could clear the membership check with one field while the service reads the
 * other (GHSA-44pv-34gx-q9p4).
 */
function IsSameOrganizationAsOrganizationId(): PropertyDecorator {
	return (object: object, propertyName: string) => {
		registerDecorator({
			name: 'isSameOrganizationAsOrganizationId',
			target: object.constructor,
			propertyName,
			validator: {
				validate(value: unknown, args: ValidationArguments): boolean {
					const { organizationId } = args.object as { organizationId?: unknown };
					if (!isSent(organizationId)) {
						return true;
					}
					return !!value && typeof value === 'object' && (value as IOrganization).id === organizationId;
				},
				defaultMessage(): string {
					return 'organization.id must match organizationId.';
				}
			}
		});
	};
}

export class TenantOrganizationBaseDTO extends TenantBaseDTO implements IBasePerTenantAndOrganizationEntityModel {
	/**
	 * Validated whenever it is sent, and otherwise required unless `organizationId` or `sentTo` is sent.
	 * Each field used to be validated only when the OTHER was absent, so a request that sent both
	 * validated neither: `organization: { isActive: true }` next to any `organizationId` (or a bogus
	 * `organizationId` next to a real `organization`) skipped the membership check entirely.
	 */
	@ApiProperty({ type: () => Object })
	@ValidateIf((it) => isSent(it.organization) || (!it.organizationId && !it.sentTo))
	@IsObject()
	@IsOrganizationBelongsToUser()
	@IsSameOrganizationAsOrganizationId()
	readonly organization: IOrganization;

	@ApiProperty({ type: () => String })
	@ValidateIf((it) => isSent(it.organizationId) || (!it.organization && !it.sentTo))
	@IsUUID()
	@IsOrganizationBelongsToUser()
	readonly organizationId: ID;

	@ApiPropertyOptional({ type: () => String })
	@ValidateIf((it) => !it.organization && !it.organizationId)
	@IsOptional()
	@IsString()
	readonly sentTo?: ID;
}
