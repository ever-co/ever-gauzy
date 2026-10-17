import {
	BadRequestException,
	ConflictException,
	ForbiddenException,
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { Brackets, DataSource, EntityManager } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
	ID,
	IEmailProviderCapabilities,
	IEmailProviderDescriptor,
	IInboxProviderAccount,
	IInboxProviderAccountCheck,
	IInboxProviderAccountCreated,
	IInboxProviderAccountCreateInput,
	IInboxProviderAccountRemoved,
	IInboxProviderAccountUpdateInput,
	InboxProviderAccountScopeEnum,
	InboxProviderAccountStatusEnum,
	PermissionsEnum
} from '@gauzy/contracts';
import { describeEmailSendError, RequestContext } from '@gauzy/core';
import { InboxNamedLocks } from '../database/named-locks';
import { InboxProviderAccount } from '../entities/inbox-provider-account.entity';
import { INBOX_SECRET_BOX, inboundWebhookUrl, PROVIDER_ACCOUNT_ERROR_MAX } from '../inbox-email.constants';
import { InboxEmailScopeService } from '../inbox-email-scope.service';
import { EmailProviderRegistry } from '../providers/email-provider.registry';
import { IEmailProviderPlugin, IProviderAccountContext } from '../providers/email-provider.types';
import { ProviderConfigError, secretFields, splitProviderConfig } from '../providers/provider-config';
import { InboxSecretBox, InboxSecretError } from '../secrets/inbox-secret-box';

function parseJson<T>(value: string | null | undefined, fallback: T): T {
	if (!value) return fallback;
	try {
		const parsed = JSON.parse(value) as T;
		return parsed ?? fallback;
	} catch {
		return fallback;
	}
}

/** An error text safe to keep on the account and show an admin: addresses masked, one line, bounded. */
export function safeErrorText(error: unknown): string {
	return describeEmailSendError(error).slice(0, PROVIDER_ACCOUNT_ERROR_MAX);
}

/**
 * Provider accounts (plan 04 §2, §3 `/provider-accounts`): an organization's or a tenant's credentials with an
 * email provider plugin. Managed by holders of `INBOX_MAILBOX_MANAGE` who are members of the organization; a
 * tenant-wide account also needs `ALL_ORG_EDIT`.
 *
 * The configuration is checked against the provider's `configSchema`; its secret fields are sealed with the
 * `InboxSecretBox` (bound to the row) and never answered. The tenant is always the caller's; the organization is
 * the stated one after the membership check.
 */
@Injectable()
export class InboxProviderAccountService {
	private readonly logger = new Logger(InboxProviderAccountService.name);

	constructor(
		private readonly dataSource: DataSource,
		private readonly registry: EmailProviderRegistry,
		private readonly scope: InboxEmailScopeService,
		@Inject(INBOX_SECRET_BOX) private readonly secretBox: InboxSecretBox
	) {
		this.locks = new InboxNamedLocks(dataSource);
	}

	/** One named lock per account: its removal, and a mailbox being pointed at it, never overlap. */
	private readonly locks: InboxNamedLocks;

	/**
	 * Runs `work` while the account can be neither removed nor attached by another request (in this process and
	 * across the replicas). A mailbox is pointed at an account under this lock, after checking the account again, so a
	 * removal never leaves a mailbox receiving through a deleted account.
	 */
	whileAccountHeld<T>(accountId: ID, work: () => Promise<T>): Promise<T> {
		return this.locks.run(`provider-account:${accountId}`, work);
	}

	// ---------------------------------------------------------------- management API

	/** The registered provider plugins and their forms. */
	providers(): IEmailProviderDescriptor[] {
		return this.registry.describe();
	}

	/** The accounts the caller manages for an organization: the organization's, and the tenant's. */
	async list(organizationId?: ID): Promise<IInboxProviderAccount[]> {
		const { tenantId, organizationId: orgId } = await this.scope.resolve(organizationId);
		const rows = await this.dataSource
			.getRepository(InboxProviderAccount)
			.createQueryBuilder('account')
			.where('account.tenantId = :tenantId', { tenantId })
			.andWhere('account.deletedAt IS NULL')
			.andWhere(
				new Brackets((where) => {
					where.where('account.scope = :tenantScope', { tenantScope: InboxProviderAccountScopeEnum.TENANT });
					where.orWhere('(account.scope = :orgScope AND account.organizationId = :orgId)', {
						orgScope: InboxProviderAccountScopeEnum.ORGANIZATION,
						orgId
					});
				})
			)
			.orderBy('account.createdAt', 'ASC')
			.getMany();
		return rows.map((row) => this.toAccount(row));
	}

	async get(id: ID, organizationId?: ID): Promise<IInboxProviderAccount> {
		return this.toAccount(await this.managed(id, organizationId));
	}

	async create(input: IInboxProviderAccountCreateInput): Promise<IInboxProviderAccountCreated> {
		const { tenantId, organizationId } = await this.scope.resolve(input?.organizationId);
		const provider = this.provider(input?.providerId);
		const scope = input?.scope ?? InboxProviderAccountScopeEnum.ORGANIZATION;
		if (!Object.values(InboxProviderAccountScopeEnum).includes(scope)) {
			throw new BadRequestException('The scope must be TENANT or ORGANIZATION.');
		}
		this.assertScopeAllowed(scope);
		const name = this.name(input?.name);
		this.assertSecretsStorable();
		const split = this.split(provider, input?.config ?? {});
		if (input?.isDefaultOutbound && !provider.capabilities.outbound) {
			throw new BadRequestException(
				`${provider.displayName} does not send mail, so it cannot be the outbound account.`
			);
		}

		const repository = this.dataSource.getRepository(InboxProviderAccount);
		const saved = await this.inTransaction(async (manager) => {
			const row = await manager.getRepository(InboxProviderAccount).save(
				manager.getRepository(InboxProviderAccount).create({
					tenantId,
					// A tenant-wide account still records the organization it was created from (for audit).
					organizationId,
					providerId: provider.id,
					name,
					scope,
					status: InboxProviderAccountStatusEnum.ACTIVE,
					isDefaultOutbound: false,
					config: JSON.stringify(split.config),
					configEncrypted: null,
					capabilities: JSON.stringify(provider.capabilities)
				} as InboxProviderAccount)
			);
			// The ciphertext is bound to the row id, so it is written once the row has one.
			await manager
				.getRepository(InboxProviderAccount)
				.update({ id: row.id }, { configEncrypted: this.seal(split.secrets, row.id as ID) });
			if (input?.isDefaultOutbound) {
				await this.makeDefaultOutbound(manager, row);
			}
			return row;
		});

		const stored = (await repository.findOne({ where: { id: saved.id } })) as InboxProviderAccount;
		const account = this.toAccount(stored);
		const context = this.context(stored);
		const oneTimeWebhookUrl =
			Object.keys(split.generated).length > 0 && provider.inbound?.webhookUrl
				? provider.inbound.webhookUrl(inboundWebhookUrl(provider.id, stored.id as ID), context)
				: null;
		return { ...account, oneTimeSecrets: split.generated, oneTimeWebhookUrl };
	}

	/**
	 * Changes an account. The configuration is merged with the stored one under a row lock (two overlapping edits of
	 * different fields both survive). A `generated` secret sent as `null` is regenerated; the new value (and the
	 * webhook URL that carries it) is answered this once, in `oneTimeSecrets`.
	 */
	async update(
		id: ID,
		input: IInboxProviderAccountUpdateInput,
		organizationId?: ID
	): Promise<IInboxProviderAccountCreated> {
		const row = await this.managed(id, organizationId, true);
		const provider = this.provider(row.providerId);
		const change: QueryDeepPartialEntity<InboxProviderAccount> = {};
		if (input?.name !== undefined) change.name = this.name(input.name);
		if (input?.status !== undefined) {
			if (
				input.status !== InboxProviderAccountStatusEnum.ACTIVE &&
				input.status !== InboxProviderAccountStatusEnum.DISABLED
			) {
				throw new BadRequestException('The status can be set to ACTIVE or DISABLED.');
			}
			change.status = input.status;
		}
		if (input?.config !== undefined) {
			this.assertSecretsStorable();
			// Checked against the form now (a refusal needs no lock); merged again with the latest row below.
			this.split(provider, input.config, this.halves(row));
		}
		if (input?.isDefaultOutbound === true && !provider.capabilities.outbound) {
			throw new BadRequestException(
				`${provider.displayName} does not send mail, so it cannot be the outbound account.`
			);
		}

		let generated: Record<string, string> = {};
		await this.inTransaction(async (manager) => {
			// The scope lock first, the row lock second, in every writer: two edits of different accounts of one scope
			// can then never hold one lock each and wait for the other's.
			if (input?.isDefaultOutbound === true) {
				await this.lockScope(manager, row);
			}
			if (input?.config !== undefined) {
				const latest = (await this.lockedRow(manager, row.id as ID)) ?? row;
				const split = this.split(provider, input.config, this.halves(latest));
				change.config = JSON.stringify(split.config);
				change.configEncrypted = this.seal(split.secrets, row.id as ID);
				generated = split.generated;
			}
			if (Object.keys(change).length > 0) {
				await manager.getRepository(InboxProviderAccount).update({ id: row.id }, change);
			}
			if (input?.isDefaultOutbound === true) {
				await this.makeDefaultOutbound(manager, row);
			} else if (input?.isDefaultOutbound === false) {
				await manager.getRepository(InboxProviderAccount).update({ id: row.id }, { isDefaultOutbound: false });
			}
		});
		const stored = (await this.dataSource
			.getRepository(InboxProviderAccount)
			.findOne({ where: { id: row.id as ID } })) as InboxProviderAccount;
		const oneTimeWebhookUrl =
			Object.keys(generated).length > 0 && provider.inbound?.webhookUrl
				? provider.inbound.webhookUrl(inboundWebhookUrl(provider.id, stored.id as ID), this.context(stored))
				: null;
		return { ...this.toAccount(stored), oneTimeSecrets: generated, oneTimeWebhookUrl };
	}

	/** "Test connection": the provider plugin checks the account's credentials; the result is kept on the account. */
	async verify(id: ID, organizationId?: ID): Promise<IInboxProviderAccountCheck> {
		const row = await this.managed(id, organizationId, true);
		const provider = this.provider(row.providerId);
		const checkedAt = new Date();
		if (typeof provider.verifyAccount !== 'function') {
			return { ok: true, message: `${provider.displayName} has no connection test.`, checkedAt };
		}
		let result: Omit<IInboxProviderAccountCheck, 'checkedAt'>;
		try {
			result = await provider.verifyAccount(this.context(row));
		} catch (error) {
			result = { ok: false, message: safeErrorText(error) };
		}
		const message =
			typeof result?.message === 'string' ? result.message.slice(0, PROVIDER_ACCOUNT_ERROR_MAX) : undefined;
		const repository = this.dataSource.getRepository(InboxProviderAccount);
		await repository.update(
			{ id: row.id },
			{ lastVerifiedAt: checkedAt, lastError: result?.ok ? null : (message ?? 'The connection test failed.') }
		);
		// The test decides between ACTIVE and ERROR, unless the account is (or became, while the test ran) disabled.
		await repository
			.createQueryBuilder()
			.update(InboxProviderAccount)
			.set({ status: result?.ok ? InboxProviderAccountStatusEnum.ACTIVE : InboxProviderAccountStatusEnum.ERROR })
			.where('id = :id AND status != :disabled', {
				id: row.id,
				disabled: InboxProviderAccountStatusEnum.DISABLED
			})
			.execute();
		return {
			ok: !!result?.ok,
			...(message ? { message } : {}),
			checkedAt,
			...(result?.details ? { details: result.details } : {})
		};
	}

	/**
	 * Removes an account (Settings → Inbox → Providers, "Delete"). Soft, as everywhere in Gauzy: the row stays, marked
	 * deleted, disabled and no longer the scope's outbound default, so nothing is received or sent through it and it
	 * leaves every list. Refused (409) while a mailbox still receives through it: those mailboxes are pointed at another
	 * account first. A tenant-wide account also needs `ALL_ORG_EDIT`.
	 */
	async remove(id: ID, organizationId?: ID): Promise<IInboxProviderAccountRemoved> {
		const row = await this.managed(id, organizationId, true);
		await this.whileAccountHeld(row.id as ID, () => this.removeHeld(row));
		return { id: row.id as ID, deleted: true };
	}

	/** The removal itself, under the account's named lock (no mailbox can be pointed at it meanwhile). */
	private async removeHeld(row: InboxProviderAccount): Promise<void> {
		await this.inTransaction(async (manager) => {
			// Under the row lock too (where the database has one), so a parallel edit of the account waits for it.
			const latest = await this.lockedRow(manager, row.id as ID);
			if (!latest || latest.deletedAt) {
				throw new NotFoundException('The provider account does not exist.');
			}
			const mailboxes = await manager
				.createQueryBuilder()
				.select('m.id', 'id')
				.from('inbox_mailbox', 'm')
				.where('m.providerAccountId = :id', { id: row.id })
				.andWhere('m.deletedAt IS NULL')
				.getRawMany<{ id: ID }>();
			if (mailboxes.length > 0) {
				throw new ConflictException(
					mailboxes.length === 1
						? 'A mailbox receives through this account: point it at another account first.'
						: `${mailboxes.length} mailboxes receive through this account: point them at another account first.`
				);
			}
			await manager.getRepository(InboxProviderAccount).update(
				{ id: row.id },
				{
					deletedAt: new Date(),
					status: InboxProviderAccountStatusEnum.DISABLED,
					isDefaultOutbound: false
				}
			);
		});
	}

	// ---------------------------------------------------------------- for the pipeline and the transport

	/**
	 * An account that may receive or send: not deleted, not disabled, of a registered provider, in the stated tenant
	 * when one is stated. `null` otherwise (never an error: callers fall back).
	 */
	async findUsable(id: ID, tenantId?: ID | null): Promise<InboxProviderAccount | null> {
		if (!isUUID(id)) return null;
		const row = await this.dataSource.getRepository(InboxProviderAccount).findOne({ where: { id } });
		if (!row || row.deletedAt || row.status === InboxProviderAccountStatusEnum.DISABLED) return null;
		if (tenantId && row.tenantId !== tenantId) return null;
		return this.registry.get(row.providerId) ? row : null;
	}

	/**
	 * The scope's default outbound accounts, in the order they are tried: the organization's, then the tenant's (both
	 * usable: not deleted, not disabled, of a registered provider that sends).
	 */
	async defaultOutboundCandidates(tenantId: ID, organizationId?: ID | null): Promise<InboxProviderAccount[]> {
		const repository = this.dataSource.getRepository(InboxProviderAccount);
		const candidates: InboxProviderAccount[] = [];
		if (organizationId) {
			const org = await repository.findOne({
				where: {
					tenantId,
					organizationId,
					scope: InboxProviderAccountScopeEnum.ORGANIZATION,
					isDefaultOutbound: true
				},
				order: { updatedAt: 'DESC' }
			});
			if (org) candidates.push(org);
		}
		const tenant = await repository.findOne({
			where: { tenantId, scope: InboxProviderAccountScopeEnum.TENANT, isDefaultOutbound: true },
			order: { updatedAt: 'DESC' }
		});
		if (tenant) candidates.push(tenant);
		return candidates.filter(
			(row) =>
				!row.deletedAt &&
				row.status !== InboxProviderAccountStatusEnum.DISABLED &&
				!!this.registry.get(row.providerId)?.capabilities.outbound
		);
	}

	/** The first of {@link defaultOutboundCandidates}, or `null`. */
	async defaultOutbound(tenantId: ID, organizationId?: ID | null): Promise<InboxProviderAccount | null> {
		return (await this.defaultOutboundCandidates(tenantId, organizationId))[0] ?? null;
	}

	/** The account with its configuration decrypted, for the provider plugin. Throws when it cannot be read. */
	context(row: InboxProviderAccount): IProviderAccountContext {
		const { config, secrets } = this.halves(row);
		return {
			id: row.id as ID,
			providerId: row.providerId,
			tenantId: (row.tenantId as ID) ?? null,
			organizationId: (row.organizationId as ID) ?? null,
			scope: row.scope,
			config: { ...config, ...secrets }
		};
	}

	/** Records a failure the pipeline or the transport met with an account (best effort). */
	async recordError(id: ID, error: unknown): Promise<void> {
		try {
			await this.dataSource
				.getRepository(InboxProviderAccount)
				.update({ id }, { lastError: safeErrorText(error) });
		} catch (failure) {
			this.logger.warn(`Could not record the error of provider account ${id}: ${(failure as Error)?.name}`);
		}
	}

	// ---------------------------------------------------------------- helpers

	private provider(providerId: unknown): IEmailProviderPlugin {
		const provider = typeof providerId === 'string' ? this.registry.get(providerId) : undefined;
		if (!provider) {
			throw new BadRequestException('There is no email provider with that id on this server.');
		}
		return provider;
	}

	private name(value: unknown): string {
		const name = typeof value === 'string' ? value.trim() : '';
		if (!name || name.length > 120) {
			throw new BadRequestException('An account needs a name of at most 120 characters.');
		}
		return name;
	}

	private split(
		provider: IEmailProviderPlugin,
		input: Record<string, unknown>,
		previous?: { config: Record<string, unknown>; secrets: Record<string, string> }
	) {
		try {
			return splitProviderConfig(provider.configSchema, input, previous);
		} catch (error) {
			if (error instanceof ProviderConfigError) {
				throw new BadRequestException({ message: error.message, field: error.field });
			}
			throw error;
		}
	}

	private assertScopeAllowed(scope: InboxProviderAccountScopeEnum): void {
		if (
			scope === InboxProviderAccountScopeEnum.TENANT &&
			!RequestContext.hasPermission(PermissionsEnum.ALL_ORG_EDIT)
		) {
			throw new ForbiddenException(
				'A tenant-wide provider account needs the permission to edit all organizations.'
			);
		}
	}

	private assertSecretsStorable(): void {
		const problem = this.secretBox.problem();
		if (problem) {
			throw new ServiceUnavailableException(new InboxSecretError(problem).message);
		}
	}

	private seal(secrets: Record<string, string>, rowId: ID): string | null {
		return Object.keys(secrets).length === 0
			? null
			: this.secretBox.seal(JSON.stringify(secrets), 'provider_config', rowId);
	}

	/** The stored public and secret halves. Throws {@link InboxSecretError} when the secrets cannot be read. */
	private halves(row: InboxProviderAccount): { config: Record<string, unknown>; secrets: Record<string, string> } {
		const config = parseJson<Record<string, unknown>>(row.config, {});
		const secrets = row.configEncrypted
			? parseJson<Record<string, string>>(
					this.secretBox.open(row.configEncrypted, 'provider_config', row.id as ID),
					{}
				)
			: {};
		return { config, secrets };
	}

	/**
	 * An account of the caller's tenant the caller may see (404 for anything else, so ids are not probed). Changing
	 * or testing a tenant-wide account also needs `ALL_ORG_EDIT` (`forWrite`).
	 */
	private async managed(id: ID, organizationId?: ID, forWrite = false): Promise<InboxProviderAccount> {
		const { tenantId, organizationId: orgId } = await this.scope.resolve(organizationId);
		const row = isUUID(id)
			? await this.dataSource.getRepository(InboxProviderAccount).findOne({ where: { id, tenantId } })
			: null;
		const visible =
			!!row &&
			!row.deletedAt &&
			(row.scope === InboxProviderAccountScopeEnum.TENANT || row.organizationId === orgId);
		if (!row || !visible) {
			throw new NotFoundException('The provider account does not exist.');
		}
		if (forWrite && row.scope === InboxProviderAccountScopeEnum.TENANT) {
			this.assertScopeAllowed(row.scope);
		}
		return row;
	}

	/**
	 * Makes `row` its scope's only default outbound account. Two overlapping requests for one scope are serialised
	 * (Postgres: a transaction advisory lock per scope; MySQL: the tenant row's lock; SQLite has one writer), and the
	 * partial unique indexes of the migration refuse a second default where the database supports them.
	 */
	private async makeDefaultOutbound(manager: EntityManager, row: InboxProviderAccount): Promise<void> {
		await this.lockScope(manager, row);
		const repository = manager.getRepository(InboxProviderAccount);
		const others = repository
			.createQueryBuilder()
			.update(InboxProviderAccount)
			.set({ isDefaultOutbound: false })
			.where('tenantId = :tenantId', { tenantId: row.tenantId })
			.andWhere('scope = :scope', { scope: row.scope })
			.andWhere('id != :id', { id: row.id });
		if (row.scope === InboxProviderAccountScopeEnum.ORGANIZATION) {
			others.andWhere('organizationId = :organizationId', { organizationId: row.organizationId });
		}
		await others.execute();
		await repository.update({ id: row.id }, { isDefaultOutbound: true });
	}

	/** A transaction whose unique-index refusal (a second default outbound account) answers 409. */
	private async inTransaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
		try {
			return await this.dataSource.transaction(work);
		} catch (error) {
			const text = `${(error as { code?: unknown })?.code ?? ''} ${(error as Error)?.message ?? ''}`;
			if (
				/UQ_inbox_provider_account_default|23505|ER_DUP_ENTRY|SQLITE_CONSTRAINT_UNIQUE|UNIQUE constraint/i.test(
					text
				)
			) {
				throw new ConflictException(
					'Another default outbound account was saved for this scope at the same time.'
				);
			}
			throw error;
		}
	}

	private get dialect(): string {
		return String(this.dataSource.options.type);
	}

	/** The account row, locked for the rest of the transaction where the database locks rows. */
	private async lockedRow(manager: EntityManager, id: ID): Promise<InboxProviderAccount | null> {
		const query = manager
			.getRepository(InboxProviderAccount)
			.createQueryBuilder('account')
			.where('account.id = :id', { id });
		if (this.dialect === 'postgres' || this.dialect === 'mysql' || this.dialect === 'mariadb') {
			query.setLock('pessimistic_write');
		}
		return query.getOne();
	}

	/** Serialises the default-outbound changes of one scope (see {@link makeDefaultOutbound}). */
	private async lockScope(manager: EntityManager, row: InboxProviderAccount): Promise<void> {
		const scopeKey =
			row.scope === InboxProviderAccountScopeEnum.TENANT
				? `gauzy-inbox:outbound:${row.tenantId}`
				: `gauzy-inbox:outbound:${row.tenantId}:${row.organizationId}`;
		if (this.dialect === 'postgres') {
			await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [scopeKey]);
		} else if (this.dialect === 'mysql' || this.dialect === 'mariadb') {
			await manager.query('SELECT `id` FROM `tenant` WHERE `id` = ? FOR UPDATE', [row.tenantId]);
		}
	}

	/** The account as the API answers it: the public configuration, which secrets are set, the webhook URL. */
	private toAccount(row: InboxProviderAccount): IInboxProviderAccount {
		const provider = this.registry.get(row.providerId);
		const config = parseJson<Record<string, unknown>>(row.config, {});
		let secretsSet: string[] = [];
		let webhookUrl: string | null = null;
		try {
			const { secrets } = this.halves(row);
			secretsSet = Object.keys(secrets).filter((name) => !!secrets[name]);
			if (provider?.capabilities.inbound) {
				const base = inboundWebhookUrl(row.providerId, row.id as ID);
				// A provider whose URL carries a credential (Postmark) shows it only once, when it is created.
				webhookUrl = provider.inbound?.webhookUrl ? null : base;
			}
		} catch (error) {
			// The secrets cannot be read with this process's key: the account answers without them.
			this.logger.warn(`Provider account ${row.id}: ${(error as Error)?.message}`);
		}
		const known = provider ? new Set(secretFields(provider.configSchema)) : null;
		return {
			id: row.id,
			tenantId: row.tenantId,
			organizationId: row.organizationId,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
			providerId: row.providerId,
			name: row.name,
			scope: row.scope,
			status: row.status,
			isDefaultOutbound: !!row.isDefaultOutbound,
			config,
			secretsSet: known ? secretsSet.filter((name) => known.has(name)) : secretsSet,
			capabilities: parseJson<IEmailProviderCapabilities | null>(row.capabilities, null),
			lastVerifiedAt: row.lastVerifiedAt ?? null,
			lastError: row.lastError ?? null,
			webhookUrl
		} as IInboxProviderAccount;
	}
}
