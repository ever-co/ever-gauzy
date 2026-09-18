import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IContactCredentialPublic, ID as Id, PermissionsEnum } from '@gauzy/contracts';
import {
	ConnectionFilter,
	ConnectionPageRequest,
	ConnectionSortKey,
	GraphqlConnection,
	buildConnection
} from '../api/graphql-connection';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { PasswordHashService } from '../password-hash/password-hash.service';
import { ContactCredentialService } from './contact-credential.service';

/**
 * The members `CreateContactCredentialInput` declares in the schema.
 *
 * `password` is the only secret-shaped member, and it is not a secret: it is hashed by the platform's
 * password hasher here, at the boundary, before the service is reached. The four members the row
 * stores are absent by construction, and the schema itself refuses them — an input type is closed, so
 * a document that states `passwordHash` is rejected before a resolver runs.
 */
export interface ICreateContactCredentialInput {
	organizationId: Id;
	customerId: Id;
	email: string;
	password: string;
	metadata?: Record<string, unknown>;
}

/**
 * The fields a credential list may be filtered and sorted by, and the order it is returned in when the
 * caller states none.
 *
 * The declaration is deliberately made over the **projection** rather than over the row: every field
 * here is a field `toPublicCredential` answers, so the four secret members of the table are not
 * filterable, not sortable and not selectable — not because they are excluded, but because they are not
 * part of the shape this resolver ever holds.
 */
const CONTACT_CREDENTIAL_FILTERABLE = {
	id: 'ID',
	customerId: 'ID',
	email: 'STRING',
	isVerified: 'BOOLEAN',
	hasMfa: 'BOOLEAN',
	lastLoginAt: 'DATE',
	lockedUntil: 'DATE',
	createdAt: 'DATE',
	updatedAt: 'DATE'
} as const;

/** The fields the sort enum offers. */
const CONTACT_CREDENTIAL_SORTABLE = ['createdAt', 'updatedAt', 'email', 'isVerified', 'lastLoginAt'] as const;

/**
 * The order the delivered list method means: newest first. The connection reproduces it rather than
 * replacing it, so the REST answer and this one list the same rows in the same order when neither
 * caller states a sort.
 */
const CONTACT_CREDENTIAL_DEFAULT_SORT: readonly ConnectionSortKey[] = [
	{ field: 'createdAt', direction: 'DESC' },
	{ field: 'id', direction: 'DESC' }
];

/**
 * A party's login over GraphQL.
 *
 * REST and GraphQL are two views of the same operations, so this resolver owns no business logic of its
 * own: every field below calls the same `ContactCredentialService` the `/api/contact-credentials` routes
 * call, under the same guard chain and the same permission.
 *
 * **A credential never leaves this resolver as a secret.** `toPublicCredential` is the projection, and
 * it is applied to the rows *before* the connection is built rather than to the answer afterwards: the
 * connection filters, sorts and cursors over the public shape, so there is no moment in which a row
 * carrying `passwordHash`, `mfaSecret` or either token exists inside this resolver's page — and the four
 * members are absent from the schema's input and output types as well, so a document that names one is
 * refused by the schema before a resolver is reached.
 *
 * **The password is hashed at this boundary**, exactly as the REST route hashes it: one route and one
 * mutation produce the same row, because both hand the platform's password hasher's output to the same
 * service method.
 *
 * **The contact-token half of the authorisation column cannot be implemented.** There is no contact
 * subject in `RequestContext` and no decorator that establishes one, and the login, refresh, logout,
 * verification and reset rows the endpoint table names all assume one. Issuing a token for a contact
 * would be inventing a second authentication path, which this delivery does not do; what it delivers is
 * the staff-facing surface of the resource, on the permissions the catalogue assigns it.
 */
@Resolver('ContactCredential')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.CONTACT_CREDENTIALS_VIEW)
export class ContactCredentialResolver {
	constructor(
		private readonly contactCredentialService: ContactCredentialService,
		private readonly passwordHashService: PasswordHashService
	) {}

	/**
	 * The credentials of the caller's organization, newest first.
	 */
	@Query('contactCredentials')
	@Permissions(PermissionsEnum.CONTACT_CREDENTIALS_VIEW)
	async contactCredentials(
		@Args('filter') filter?: ConnectionFilter,
		@Args('sort') sort?: ConnectionSortKey[],
		@Args('page') page?: ConnectionPageRequest,
		@Args('first', { type: () => Int, nullable: true }) first?: number,
		@Args('after', { type: () => String, nullable: true }) after?: string,
		@Args('last', { type: () => Int, nullable: true }) last?: number,
		@Args('before', { type: () => String, nullable: true }) before?: string,
		@Args('limit', { type: () => Int, nullable: true }) limit?: number,
		@Args('offset', { type: () => Int, nullable: true }) offset?: number
	): Promise<GraphqlConnection<IContactCredentialPublic>> {
		// Projected first, connected second: the protocol never sees the row the secrets live on.
		const rows = (await this.contactCredentialService.listCredentials()).map((row) =>
			this.contactCredentialService.toPublicCredential(row)
		);

		return buildConnection<IContactCredentialPublic>({
			rows,
			filterable: CONTACT_CREDENTIAL_FILTERABLE,
			sortable: CONTACT_CREDENTIAL_SORTABLE,
			defaultSort: CONTACT_CREDENTIAL_DEFAULT_SORT,
			request: { filter, sort, page, first, after, last, before, limit, offset }
		});
	}

	/**
	 * Records a party's login.
	 */
	@Mutation('createContactCredential')
	@Permissions(PermissionsEnum.CONTACT_CREDENTIALS_MANAGE)
	async createContactCredential(
		@Args('input') input: ICreateContactCredentialInput
	): Promise<IContactCredentialPublic> {
		const credential = await this.contactCredentialService.createCredential({
			customerId: input.customerId,
			email: input.email,
			passwordHash: await this.passwordHashService.hash(input.password),
			...(input.metadata !== undefined ? { metadata: input.metadata } : {})
		} as never);

		return this.contactCredentialService.toPublicCredential(credential);
	}

	/**
	 * Revokes a credential, which is the only removal path there is.
	 */
	@Mutation('revokeContactCredential')
	@Permissions(PermissionsEnum.CONTACT_CREDENTIALS_MANAGE)
	async revokeContactCredential(
		@Args('id', { type: () => ID }) id: Id
	): Promise<IContactCredentialPublic> {
		const credential = await this.contactCredentialService.removeCredential(id);

		return this.contactCredentialService.toPublicCredential(credential);
	}
}
