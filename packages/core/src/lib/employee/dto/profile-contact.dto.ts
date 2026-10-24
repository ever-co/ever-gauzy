import { ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { ID } from '@gauzy/contracts';
import { Contact } from './../../contact/contact.entity';

/**
 * The contact members a profile edit may write (`PUT /employee/:id/profile`, `PUT /employee/:id`, and
 * `PUT /candidate/:id` through `UpdateCandidateDTO`): the postal, geographic and fiscal facts of the profile's own
 * contact row.
 *
 * There is no tenant, organization or relation member, because the handler stamps the profile's own (see
 * `ownContactPatch`). `contact` used to be a bare `@IsObject()`, so the whitelist never reached inside it, and a
 * nested `id` re-pointed the employee's cascading one-to-one at any contact of the tenant: an organization's, a
 * client's or a candidate's. That contact was then overwritten. An `id` is still accepted so that a client
 * naming the profile's own contact updates it in place, but the handler drops any other.
 */
export class ProfileContactDTO extends PickType(Contact, [
	'name',
	'firstName',
	'lastName',
	'country',
	'city',
	'address',
	'address2',
	'postcode',
	'latitude',
	'longitude',
	'regionCode',
	'fax',
	'fiscalInformation',
	'website'
] as const) {
	/** The profile's own contact row. The handler drops an id that is not the profile's stored `contactId`. */
	@ApiPropertyOptional({ type: () => String })
	@IsOptional()
	@IsUUID()
	readonly id?: ID;
}
