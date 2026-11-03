import { BadRequestException, Inject, Injectable, Logger, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { CommandBus } from '@nestjs/cqrs';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import {
	CurrenciesEnum,
	ITermsAcceptanceClaim,
	ITermsAcceptanceDocument,
	IUser,
	LanguagesEnum
} from '@gauzy/contracts';
import {
	Employee,
	EmployeeCreateCommand,
	Organization,
	OrganizationCreateCommand,
	OrganizationTeam,
	OrganizationTeamCreateCommand,
	RequestContext,
	RoleAuthorizationService,
	TenantService,
	User
} from '@gauzy/core';
import { ZitadelAccount } from '../entities/zitadel-account.entity';
import { ZitadelOrganization } from '../entities/zitadel-organization.entity';
import {
	CreateUserPreLinkedHooks,
	CreateUserPreLinkedInput,
	CreateUserPreLinkedResult,
	ZitadelProvisionerPort
} from '../ports/create-user-pre-linked.port';
import { GAUZY_AUTH, GauzyAuthPort } from '../ports/gauzy-auth.port';
import { TERMS_DOCUMENTS, TermsDocumentsPort } from '../ports/terms-documents.port';
import { ZitadelConfigService } from './zitadel-config.service';
import { absoluteDocumentUrl } from './zitadel-signup.service';

/** Longest name of a tenant, an organization or a team created here. */
const MAX_NAME_LENGTH = 200;

/** Longest first or last name. */
const MAX_PERSON_NAME_LENGTH = 100;

const clean = (value: unknown, max: number): string | undefined => {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim().slice(0, max);
	return trimmed || undefined;
};

/** The currency of a new organization: the one asked for when Gauzy knows it, else US dollars. */
function currencyOf(value: string | undefined): CurrenciesEnum {
	const upper = (value ?? '').toUpperCase();
	return (Object.values(CurrenciesEnum) as string[]).includes(upper) ? (upper as CurrenciesEnum) : CurrenciesEnum.USD;
}

/** An https (or http) address for the organization's website, or `undefined`. */
function websiteOf(value: string | undefined): string | undefined {
	if (!value) return undefined;
	try {
		const url = new URL(value);
		return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password
			? url.toString().slice(0, 2048)
			: undefined;
	} catch {
		return undefined;
	}
}

/**
 * Creates a Gauzy workspace for a person who confirmed it with their own Ever ID, already linked to
 * that Ever ID and to the Ever organization it was asked for (`ZITADEL_PROVISIONER`).
 *
 * The workspace is made by Gauzy's own paths, in the order of a normal sign-up: the owner through
 * Gauzy's register path (e-mail from the person's Ever ID, marked verified), the tenant through
 * `TenantService.onboardTenant` (roles, permissions, settings, the owner as `SUPER_ADMIN`), the
 * organization through `OrganizationCreateCommand`, then the owner's employee and a team through their
 * own commands. Each of those writes on its own, so the creation is resumable rather than one
 * transaction: after every step the caller keeps the ids (`checkpoint`) and a retry with the same key
 * continues with the same user, tenant and organization (`resume`), never a second one. The last step is
 * one transaction: the organization link (`zitadel_organization`, unique by the key) and the owner's
 * Ever ID link (`zitadel_account`, method `provisioned`), with the caller's own rows. Until it commits
 * nobody can sign in to the new workspace with Ever ID, and once it has, the same key answers the ids
 * of that workspace without creating anything.
 *
 * Organization `profile_link` is never set (Gauzy derives it from the name), and no role beyond the
 * owner's `SUPER_ADMIN` is given.
 */
@Injectable()
export class ZitadelProvisionService implements ZitadelProvisionerPort {
	private readonly logger = new Logger('AuthZitadelPlugin');

	constructor(
		private readonly dataSource: DataSource,
		private readonly moduleRef: ModuleRef,
		private readonly config: ZitadelConfigService,
		@Inject(GAUZY_AUTH) private readonly gauzyAuth: GauzyAuthPort,
		@Inject(TERMS_DOCUMENTS) private readonly termsDocuments: TermsDocumentsPort
	) {}

	requiredTerms(locale: LanguagesEnum = LanguagesEnum.ENGLISH): ITermsAcceptanceDocument[] {
		const clientBaseUrl = this.config.settings.clientBaseUrl;
		return this.termsDocuments.getRequiredDocuments(locale).map((document) => ({
			...document,
			url: absoluteDocumentUrl(document.url, clientBaseUrl)
		}));
	}

	async findProvisioned(idempotencyKey: string): Promise<CreateUserPreLinkedResult | null> {
		if (!idempotencyKey) return null;
		const link = await this.dataSource
			.getRepository(ZitadelOrganization)
			.findOne({ where: { provisionKey: idempotencyKey } });
		if (!link) return null;
		const userId = link.linkedByUserId;
		const employee = userId
			? await this.dataSource.getRepository(Employee).findOne({
					where: { userId, organizationId: link.organizationId },
					select: { id: true }
				})
			: null;
		// The team is not looked up: an organization may hold teams made later; the caller keeps the id it was answered.
		return {
			userId,
			tenantId: link.tenantId,
			organizationId: link.organizationId,
			employeeId: employee?.id,
			existing: true
		};
	}

	async isLinkedElsewhere(everOrgId: string, idempotencyKey: string): Promise<boolean> {
		if (!everOrgId) return false;
		const links = await this.dataSource
			.getRepository(ZitadelOrganization)
			.find({ where: { everOrgId }, select: { id: true, provisionKey: true } });
		return links.some((link) => link.provisionKey !== idempotencyKey);
	}

	async createUserPreLinked(
		input: CreateUserPreLinkedInput,
		hooks: CreateUserPreLinkedHooks = {}
	): Promise<CreateUserPreLinkedResult> {
		this.assertInput(input);
		const finished = await this.findProvisioned(input.idempotencyKey);
		if (finished) {
			return finished;
		}
		const ids: Partial<CreateUserPreLinkedResult> = { ...(hooks.resume ?? {}) };
		delete ids.existing;
		const checkpoint = async () => {
			await hooks.checkpoint?.({ ...ids });
		};

		// 1. The owner: Gauzy's register path (which checks and records the accepted documents). The
		// address is marked verified (Ever ID verified it), and the account usable, only in the last
		// transaction: until then no sign-in path (Ever ID, Gauzy's e-mail code) reaches the new workspace.
		// Its id is kept at once; an attempt that stopped before that leaves an unusable account (no tenant,
		// no password, no link, not verified), never a second workspace.
		let user = ids.userId ? await this.loadUser(ids.userId) : null;
		if (ids.userId && !user) {
			// The owner an earlier attempt made is gone: its tenant and organization are not reused.
			throw new Error('The owner of this workspace creation no longer exists.');
		}
		if (!user) {
			this.assertRequiredTermsAccepted(input.terms ?? []);
			const created = await this.gauzyAuth.register(
				{
					user: {
						email: input.email,
						firstName: clean(input.firstName, MAX_PERSON_NAME_LENGTH),
						lastName: clean(input.lastName, MAX_PERSON_NAME_LENGTH),
						// Not usable before the last step, whatever the installation does with new accounts.
						isActive: false
					},
					terms: input.terms?.length ? input.terms : undefined
				},
				LanguagesEnum.ENGLISH
			);
			ids.userId = created.id;
			await checkpoint();
			user = await this.loadUser(created.id);
			if (!user) {
				throw new Error('The new owner could not be read back.');
			}
		}
		// An owner a stopped attempt left that became usable meanwhile (its address confirmed through Gauzy's
		// own link) is made unusable again until the last step, but only while this attempt still holds the
		// creation: the checkpoint renews the caller's claim and fails once another attempt took it over, so a
		// workspace another attempt finished is never touched.
		if (user.isActive !== false && hooks.checkpoint) {
			await checkpoint();
			await this.dataSource.getRepository(User).update({ id: user.id }, { isActive: false } as never);
		}

		// 2. The tenant, with the owner as its SUPER_ADMIN (Gauzy finishes a tenant a failed attempt left).
		if (!user.tenantId) {
			const owner = user;
			await this.asUser(owner.id, () =>
				this.service(TenantService).onboardTenant(
					{ name: clean(input.tenant.name, MAX_NAME_LENGTH) ?? input.handle },
					owner
				)
			);
			user = await this.loadUser(owner.id);
			if (!user?.tenantId) {
				throw new Error('The new tenant could not be read back.');
			}
		}
		ids.tenantId = user.tenantId;
		await checkpoint();
		const tenantId = user.tenantId;
		const userId = user.id;

		// 3. The organization (the tenant is new: an organization it holds was made by an earlier attempt).
		if (!ids.organizationId) {
			const existing = await this.dataSource
				.getRepository(Organization)
				// The ordered column must be selected too: these entities have eager relations, and TypeORM's
				// paged query (a one-row find with joins) orders by a column of its own selection.
				.findOne({ where: { tenantId }, order: { createdAt: 'ASC' }, select: { id: true, createdAt: true } });
			if (existing) {
				ids.organizationId = existing.id;
			} else {
				const organization = await this.asUser(userId, () =>
					this.service(CommandBus).execute(
						new OrganizationCreateCommand({
							name: clean(input.organization.name, MAX_NAME_LENGTH) ?? input.handle,
							officialName: clean(input.organization.officialName, MAX_NAME_LENGTH),
							currency: currencyOf(input.organization.currency),
							website: websiteOf(input.organization.website),
							contact: input.organization.country ? { country: input.organization.country } : undefined,
							isActive: true
						} as never)
					)
				);
				ids.organizationId = (organization as { id: string }).id;
			}
			await checkpoint();
		}
		const organizationId = ids.organizationId;

		// 4. The owner's employee in it.
		if (input.options.createEmployee && !ids.employeeId) {
			ids.employeeId = (await this.findEmployee(userId, organizationId))?.id;
			if (!ids.employeeId) {
				await this.asUser(userId, () =>
					this.service(CommandBus).execute(
						new EmployeeCreateCommand({ userId, organizationId, startedWorkOn: new Date() } as never)
					)
				);
				ids.employeeId = (await this.findEmployee(userId, organizationId))?.id;
				if (!ids.employeeId) {
					throw new Error('The owner employee could not be created.');
				}
			}
			await checkpoint();
		}

		// 5. A team named after the organization, with the owner's employee as its manager.
		if (input.options.createTeam && !ids.teamId) {
			const name = clean(input.organization.name, MAX_NAME_LENGTH) ?? input.handle;
			ids.teamId = (await this.findTeam(organizationId, name))?.id;
			if (!ids.teamId) {
				const members = ids.employeeId ? [ids.employeeId] : [];
				const team = await this.asUser(userId, () =>
					this.service(CommandBus).execute(
						new OrganizationTeamCreateCommand({
							name,
							organizationId,
							tenantId,
							memberIds: [...members],
							managerIds: [...members]
						} as never)
					)
				);
				ids.teamId = (team as { id: string }).id;
			}
			await checkpoint();
		}

		// 6. The links, in one transaction with the caller's own rows: the last write.
		const result: CreateUserPreLinkedResult = {
			userId,
			tenantId,
			organizationId,
			employeeId: ids.employeeId,
			teamId: ids.teamId
		};
		const written = await this.dataSource.transaction((manager) => this.writeLinks(manager, input, result, hooks));
		if (!written) {
			// Another attempt with the same key finished first: its workspace is the answer.
			const other = await this.findProvisioned(input.idempotencyKey);
			if (other) return other;
		}
		this.logger.log('A workspace was created and linked from an Ever ID sign-in the owner confirmed.');
		return result;
	}

	/** Writes the organization and Ever ID links; `false` when another attempt with the key wrote them. */
	private async writeLinks(
		manager: EntityManager,
		input: CreateUserPreLinkedInput,
		ids: CreateUserPreLinkedResult,
		hooks: CreateUserPreLinkedHooks
	): Promise<boolean> {
		if (
			await manager.getRepository(ZitadelOrganization).exists({ where: { provisionKey: input.idempotencyKey } })
		) {
			return false;
		}
		const now = new Date();
		// The owner becomes usable here, with the links: the address Ever ID verified, the account active.
		// The owner becomes usable here, with the links: active (an account archived meanwhile stops the
		// creation: nothing is linked), and its address verified unless it was already.
		const activated = await manager
			.getRepository(User)
			.update({ id: ids.userId, isArchived: false }, { isActive: true } as never);
		if (!activated.affected) {
			throw new Error('The owner of this workspace creation can no longer be activated.');
		}
		await manager
			.getRepository(User)
			.update({ id: ids.userId, emailVerifiedAt: IsNull() }, { emailVerifiedAt: now } as never);
		await manager.getRepository(ZitadelOrganization).insert({
			tenantId: ids.tenantId,
			organizationId: ids.organizationId,
			everOrgId: input.everOrgId,
			everTenantId: input.everTenantId,
			handle: input.handle,
			tenantLinkId: input.tenantLinkId ?? null,
			ssoEnforced: false,
			linkedAt: now,
			linkedByUserId: ids.userId,
			provisionKey: input.idempotencyKey,
			isActive: true,
			isArchived: false
		} as never);
		await manager
			.createQueryBuilder()
			.insert()
			.into(ZitadelAccount)
			.values({
				issuer: input.issuer,
				subject: input.subject,
				userId: ids.userId,
				tenantId: ids.tenantId,
				everPersonId: input.everPersonId ?? null,
				emailAtLink: input.email,
				linkMethod: 'provisioned',
				linkedAt: now
			} as never)
			.orIgnore()
			.execute();
		await hooks.finalize?.({ query: (sql, params) => manager.query(sql, params) }, ids);
		return true;
	}

	/**
	 * Every document Gauzy currently requires must be accepted, as on the register form; the claims
	 * themselves are checked against the published text by Gauzy's register path.
	 */
	private assertRequiredTermsAccepted(terms: ITermsAcceptanceClaim[]): void {
		const missing = this.termsDocuments
			.getRequiredDocuments(LanguagesEnum.ENGLISH)
			.filter(
				(document) =>
					!terms.some(
						(claim) => claim.documentId === document.documentId && claim.version === document.version
					)
			);
		if (missing.length) {
			throw new BadRequestException({
				statusCode: 400,
				code: 'terms_required',
				message: 'The required terms must be accepted.'
			});
		}
	}

	private assertInput(input: CreateUserPreLinkedInput): void {
		const missing = ['issuer', 'subject', 'email', 'everOrgId', 'everTenantId', 'handle', 'idempotencyKey'].filter(
			(field) =>
				typeof input?.[field as keyof CreateUserPreLinkedInput] !== 'string' ||
				!input[field as keyof CreateUserPreLinkedInput]
		);
		// A team is made with the owner's employee in it: no employee, no team.
		const teamWithoutEmployee = input.options?.createTeam && !input.options?.createEmployee;
		if (missing.length || !input.tenant?.name || !input.organization?.name || teamWithoutEmployee) {
			throw new BadRequestException('The workspace request is incomplete.');
		}
	}

	private loadUser(id: string): Promise<User | null> {
		return this.dataSource.getRepository(User).findOne({ where: { id } });
	}

	private findEmployee(userId: string, organizationId: string): Promise<Pick<Employee, 'id'> | null> {
		return this.dataSource
			.getRepository(Employee)
			.findOne({ where: { userId, organizationId }, select: { id: true } });
	}

	private findTeam(organizationId: string, name: string | undefined): Promise<Pick<OrganizationTeam, 'id'> | null> {
		return this.dataSource.getRepository(OrganizationTeam).findOne({
			where: name ? { organizationId, name } : { organizationId },
			order: { createdAt: 'ASC' },
			select: { id: true, createdAt: true }
		});
	}

	/**
	 * Runs Gauzy's own creation paths as the owner (with the role and permissions they hold now), in a
	 * request context of their own: the paths read the tenant, the role and the permissions from it.
	 */
	private async asUser<T>(userId: string, work: () => Promise<T>): Promise<T> {
		const user = (await this.dataSource.getRepository(User).findOne({ where: { id: userId } })) as unknown as IUser;
		if (!user) {
			throw new Error('The owner could not be read.');
		}
		await this.service(RoleAuthorizationService).attachAuthorizationState(user as never);
		const request = { user, headers: {}, query: {}, params: {}, body: {} };
		return RequestContext.runWithRequest(request as never, work);
	}

	/** A platform service of the running application (resolved when first needed). */
	private service<T>(type: Type<T>): T {
		return this.moduleRef.get(type, { strict: false });
	}
}
