import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Query,
	UseGuards
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IContactCredential, IContactCredentialFindInput, IContactCredentialPublic, ID, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { paginateRows, resolveRestPage } from '../api/graphql-connection';
import { UUIDValidationPipe, UseValidationPipe } from '../shared/pipes';
import { Permissions } from '../shared/decorators';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { PasswordHashService } from '../password-hash/password-hash.service';
import { ContactCredentialService } from './contact-credential.service';
import { ContactCredentialQueryDTO, CreateContactCredentialDTO } from './dto';
import { UseCredentialSecretRefusal } from './contact-credential.secret.pipe';

/**
 * A party's login over REST.
 *
 * **This is the one resource of the kernel that holds a secret, and every rule in this file follows
 * from that.** `ContactCredentialService.toPublicCredential` is the only shape a credential is answered
 * in, and every response below goes through it: the hash, the authenticator secret and the two
 * single-use tokens are absent from that projection's *type*, not null in it, so a route cannot leak one
 * by forgetting. A body that carries one of the four is refused before validation, with the platform's
 * own `CONTACT_CREDENTIAL_SECRET_NOT_ACCEPTED` and the member named — the same refusal the service
 * raises for the same member, so the two paths cannot drift.
 *
 * **The password is hashed at this boundary.** `POST /contact-credentials` takes the password the party
 * chose and hands the platform's password hasher's output to the service, which is the contract the
 * service states when it demands a hash and refuses a plaintext: the route is where a plaintext may
 * exist, and it exists for exactly as long as it takes to hash it.
 *
 * **This class does not extend `CrudController`, and that is a security property rather than a
 * preference.** The base class maps two routes that answer raw entity rows — `GET /pagination` and
 * `PUT /:id/recover` — and a raw credential row is a row carrying `passwordHash`, `mfaSecret` and both
 * tokens. Overriding them would work until somebody adds a third, so the surface is declared explicitly
 * instead: three routes, every one of which projects.
 *
 * **What is deliberately not delivered.** §7.7's credential rows also name a per-contact listing
 * (`/organization-contacts/:id/credentials`), a reset that sends a message, and a revoke that
 * invalidates refresh hashes. The per-contact read is this resource's list with `filter[customerId]`
 * stated — the parent-scoped path belongs to the contact resource's controller, which is the core
 * contact domain's and not part of this delivery. The reset and the revoke cannot be delivered as the
 * table describes them: the delivered kernel ships no message transport and no refresh-hash store, and
 * `setResetToken` takes a **hashed** token with the instant it lapses, so a route would have to invent
 * both the token and its delivery. Removal is delivered for what the table means by revoking — the
 * credential stops authenticating — through `DELETE /:id`, which is a soft removal and is reported as
 * the departure it is.
 *
 * **The contact-token half of the authorisation column cannot be implemented.** The six
 * `/contact-credentials/*` rows of the endpoint table are guarded by an API key or by a contact token,
 * and there is no contact subject in `RequestContext` and no decorator that establishes one; issuing
 * one would be inventing a second authentication path, which this delivery does not do. The three
 * routes below are therefore the staff-facing surface of the resource, on
 * `CONTACT_CREDENTIALS_VIEW` to read and `CONTACT_CREDENTIALS_MANAGE` to write — the pair the
 * permission catalogue assigns to reading a contact's credential and to resetting, revoking or
 * re-inviting one.
 */
@ApiTags('ContactCredential')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.CONTACT_CREDENTIALS_VIEW)
@Controller('/contact-credentials')
export class ContactCredentialController {
	constructor(
		private readonly contactCredentialService: ContactCredentialService,
		private readonly passwordHashService: PasswordHashService
	) {}

	/**
	 * Lists the credentials of the caller's organization, newest first, with no secret in any row.
	 *
	 * @param query The narrowing and the page to read.
	 * @returns One page of public credential projections.
	 */
	@ApiOperation({ summary: 'List contact credentials' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Credentials retrieved, with no secret in any row' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'QUERY_PAGE_LIMIT_EXCEEDED' })
	@Permissions(PermissionsEnum.CONTACT_CREDENTIALS_VIEW)
	@Get()
	@UseValidationPipe({ transform: true, whitelist: true })
	async findAll(@Query() query?: ContactCredentialQueryDTO): Promise<IPagination<IContactCredentialPublic>> {
		const rows = await this.contactCredentialService.listCredentials(this.narrowing(query));
		const { take, skip } = resolveRestPage(query?.take, query?.skip);
		const page = paginateRows(rows, take, skip);

		return { items: page.items.map((row) => this.contactCredentialService.toPublicCredential(row)), total: page.total };
	}

	/**
	 * Records a party's login.
	 *
	 * The password is hashed before the service is reached, and the answer is the projection: even the
	 * credential just created is never answered as the row it is.
	 *
	 * @param entity The credential as the caller states it.
	 * @returns The stored credential, projected.
	 */
	@ApiOperation({ summary: 'Create a contact credential' })
	@ApiResponse({ status: HttpStatus.CREATED, description: 'Credential created' })
	@ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'CONTACT_CREDENTIAL_SECRET_NOT_ACCEPTED, CONTACT_CREDENTIAL_EMAIL_TAKEN' })
	@Permissions(PermissionsEnum.CONTACT_CREDENTIALS_MANAGE)
	@HttpCode(HttpStatus.CREATED)
	@Post()
	@UseValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true })
	@UseCredentialSecretRefusal()
	async create(@Body() entity: CreateContactCredentialDTO): Promise<IContactCredentialPublic> {
		const credential: IContactCredential = await this.contactCredentialService.createCredential({
			customerId: entity.customerId,
			email: entity.email,
			passwordHash: await this.passwordHashService.hash(entity.password),
			...(entity.metadata !== undefined ? { metadata: entity.metadata } : {})
		} as never);

		return this.contactCredentialService.toPublicCredential(credential);
	}

	/**
	 * Revokes a credential, which is the only removal path there is.
	 *
	 * The row is kept rather than deleted: the sessions, the audit entries and the export archive that
	 * referenced it stay readable, and a party that registers again is attached to the same contact
	 * rather than duplicated. What the caller observes is the projected row, so a revocation never
	 * answers with the secrets of the credential it just retired.
	 *
	 * @param id The credential to revoke.
	 * @returns The stored credential, projected.
	 */
	@ApiOperation({ summary: 'Revoke a contact credential' })
	@ApiResponse({ status: HttpStatus.OK, description: 'Credential revoked' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'CONTACT_CREDENTIAL_NOT_FOUND' })
	@Permissions(PermissionsEnum.CONTACT_CREDENTIALS_MANAGE)
	@HttpCode(HttpStatus.OK)
	@Delete(':id')
	async revoke(@Param('id', UUIDValidationPipe) id: ID): Promise<IContactCredentialPublic> {
		const credential = await this.contactCredentialService.removeCredential(id);

		return this.contactCredentialService.toPublicCredential(credential);
	}

	/**
	 * The equality members of the list query, from whichever spelling stated them.
	 *
	 * @param query The query as stated.
	 * @returns The narrowing to hand the read.
	 */
	private narrowing(query?: ContactCredentialQueryDTO): IContactCredentialFindInput {
		const stated: IContactCredentialFindInput = {};

		for (const member of ['customerId', 'email', 'isVerified'] as const) {
			const value = query?.[member] ?? query?.filter?.[member];

			if (value !== undefined && value !== null) {
				stated[member] = value as never;
			}
		}

		return stated;
	}
}
