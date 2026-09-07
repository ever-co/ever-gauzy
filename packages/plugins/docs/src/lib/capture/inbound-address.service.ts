import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { resolveTxt } from 'node:dns/promises';
import {
	DocumentInboundAddressKindEnum,
	DocumentInboundDomainStatusEnum,
	ID,
	IDocumentInboundAddressCreateInput,
	IDocumentInboundAddressSecret,
	IDocumentInboundAddressUpdateInput,
	IDocumentInboundDomainVerification
} from '@gauzy/contracts';
import { DocumentInboundAddress } from '../entities/document-inbound-address.entity';
import { IInboundAddressResolver } from './inbound-email.types';
import {
	isSenderAllowedBy,
	normalizeInboundDomain,
	normalizeInboundLocalPart,
	normalizeRecipientAddress
} from './inbound-address.util';
import { getDocsConfig } from '../docs.config';
import {
	DOCS_INBOUND_DNS_TIMEOUT_MS,
	DOCS_INBOUND_DOMAIN_TXT_PREFIX,
	DOCS_INBOUND_LOCAL_PART_PATTERN,
	DOCS_INBOUND_PLATFORM_LOCAL_PREFIX
} from '../docs.constants';

/**
 * Owns the lifecycle of an organization's inbound capture address — minting, resolving, verifying
 * and rotating it.
 *
 * ## Why this exists
 *
 * The capture channel shipped with a resolver but no provisioner: `inbound-email.service.ts` read a
 * `tenant_setting` row named `docs.<organizationId>.inboundToken` that **nothing in the codebase
 * ever wrote**. Every real delivery therefore 404'd at the unknown-recipient gate; the feature only
 * appeared to work in a unit test that stubbed the lookup. This service is the missing half.
 *
 * ## Two kinds of address
 *
 * - **PLATFORM** — zero-config. Minted on first read for any organization, on the deployment-wide
 *   `GAUZY_DOCS_INBOUND_DOMAIN`, distinguished by 128 bits of CSPRNG entropy:
 *   `docs-<token>@<platform domain>`. The address itself is the credential, so it is unguessable
 *   by construction.
 * - **CUSTOM_DOMAIN** — the organization publishes its own domain. The local part is theirs to
 *   choose (`docs@acme.com`), which makes the address guessable, so it is inert until a DNS TXT
 *   record proves they control the domain.
 *
 * ## The per-address secret
 *
 * Each address carries its own relay secret, stored only as SHA-256. A single deployment-wide
 * `GAUZY_DOCS_INBOUND_WEBHOOK_SECRET` means one leak lets an attacker post mail *as any tenant*;
 * a per-address secret contains that blast radius to one organization. The global secret remains
 * supported so existing relays keep working.
 */
@Injectable()
export class InboundAddressService implements IInboundAddressResolver {
	private readonly logger = new Logger(InboundAddressService.name);

	constructor(
		@InjectRepository(DocumentInboundAddress)
		private readonly repository: Repository<DocumentInboundAddress>
	) {}

	/**
	 * Returns the organization's addresses, minting the PLATFORM one on first call.
	 *
	 * Provisioning on read (rather than at organization-creation time) means every existing
	 * organization gets an address the moment someone looks, with no backfill migration over the
	 * `organization` table.
	 */
	public async listForOrganization(tenantId: ID, organizationId: ID): Promise<DocumentInboundAddress[]> {
		const existing = await this.repository.find({
			where: { tenantId, organizationId },
			order: { createdAt: 'ASC' }
		});

		if (existing.some((row) => row.kind === DocumentInboundAddressKindEnum.PLATFORM)) {
			return existing;
		}

		// No platform address yet. Mint one — unless the deployment has no inbound domain
		// configured, in which case there is no address to mint and we say so honestly rather
		// than fabricating one that could never receive mail.
		if (!getDocsConfig().inboundDomain) {
			return existing;
		}

		const minted = await this.mintPlatformAddress(tenantId, organizationId);
		return [minted, ...existing];
	}

	/**
	 * Mints the PLATFORM address. Retries once on a unique-index collision, which can only happen
	 * if two requests race — the database, not the read-then-write, is what makes this safe.
	 */
	private async mintPlatformAddress(tenantId: ID, organizationId: ID): Promise<DocumentInboundAddress> {
		const domain = this.requirePlatformDomain();

		for (let attempt = 0; attempt < 3; attempt++) {
			const token = randomBytes(16).toString('hex'); // 128 bits, lower-case hex
			const address = `${DOCS_INBOUND_PLATFORM_LOCAL_PREFIX}${token}@${domain}`.toLowerCase();
			try {
				const row = this.repository.create({
					tenantId,
					organizationId,
					kind: DocumentInboundAddressKindEnum.PLATFORM,
					token,
					address,
					// The platform owns this domain; there is nothing for the tenant to prove.
					domainStatus: DocumentInboundDomainStatusEnum.VERIFIED,
					domainVerifiedAt: new Date(),
					isActive: true
				});
				return await this.repository.save(row);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				if (!/unique|duplicate/i.test(message) || attempt === 2) {
					throw error;
				}
				this.logger.warn(`Inbound address token collision, retrying (attempt ${attempt + 1}).`);
			}
		}
		/* istanbul ignore next — the loop either returns or throws above. */
		throw new BadRequestException('Could not mint an inbound address.');
	}

	/**
	 * Registers a tenant-owned domain. The address is created PENDING and rejects mail until
	 * {@link verifyDomain} observes the TXT record.
	 *
	 * @returns the row plus the one-time plaintext relay secret.
	 */
	public async createCustomDomain(
		tenantId: ID,
		organizationId: ID,
		input: IDocumentInboundAddressCreateInput
	): Promise<{ row: DocumentInboundAddress; secret: IDocumentInboundAddressSecret }> {
		const domain = this.normalizeDomain(input.domain);
		const localPart = this.normalizeLocalPart(input.localPart);
		const address = `${localPart}@${domain}`;

		// A tenant must not be able to claim the platform's own domain and thereby intercept
		// another organization's platform address.
		const platformDomain = getDocsConfig().inboundDomain?.trim().toLowerCase();
		if (platformDomain && (domain === platformDomain || domain.endsWith(`.${platformDomain}`))) {
			throw new BadRequestException('That domain is reserved by the platform.');
		}

		const clash = await this.repository.findOne({ where: { address } });
		if (clash) {
			throw new BadRequestException('That address is already registered.');
		}

		const { secret, hash } = this.mintSecret();
		const row = this.repository.create({
			tenantId,
			organizationId,
			kind: DocumentInboundAddressKindEnum.CUSTOM_DOMAIN,
			domain,
			localPart,
			address,
			domainStatus: DocumentInboundDomainStatusEnum.PENDING,
			domainVerificationToken: `gauzy-docs-verify=${randomBytes(16).toString('hex')}`,
			webhookSecretHash: hash,
			senderAllowlistRaw: input.senderAllowlist?.length ? JSON.stringify(input.senderAllowlist) : null,
			importBodyAsNote: input.importBodyAsNote ?? false,
			isActive: true
		});

		const saved = await this.repository.save(row);
		return { row: saved, secret: { address: saved.address, webhookSecret: secret } };
	}

	/**
	 * The DNS record the organization must publish, plus current status.
	 */
	public describeVerification(row: DocumentInboundAddress): IDocumentInboundDomainVerification {
		return {
			recordType: 'TXT',
			recordName: `${DOCS_INBOUND_DOMAIN_TXT_PREFIX}.${row.domain}`,
			recordValue: row.domainVerificationToken ?? '',
			status: row.domainStatus,
			verifiedAt: row.domainVerifiedAt ?? null,
			lastCheckedAt: row.domainLastCheckedAt ?? null
		};
	}

	/**
	 * Looks up `_gauzy-docs.<domain>` IN TXT and arms the address if the expected value is present.
	 *
	 * Re-checking a VERIFIED domain that has lost its record moves it to FAILED, so a domain that is
	 * transferred away stops accepting mail rather than remaining armed forever.
	 */
	public async verifyDomain(
		tenantId: ID,
		organizationId: ID,
		id: ID
	): Promise<IDocumentInboundDomainVerification> {
		const row = await this.findOneOrFail(tenantId, organizationId, id);
		if (row.kind !== DocumentInboundAddressKindEnum.CUSTOM_DOMAIN) {
			throw new BadRequestException('Only a custom domain requires verification.');
		}

		const recordName = `${DOCS_INBOUND_DOMAIN_TXT_PREFIX}.${row.domain}`;
		let observed: string[] = [];
		let message: string | undefined;

		try {
			observed = (await this.resolveTxtWithTimeout(recordName)).map((entry) => entry.trim());
		} catch (error) {
			// NXDOMAIN and a timeout are both "not proven yet" — never a 500. The tenant sees why.
			message = error instanceof Error ? error.message : String(error);
		}

		const expected = row.domainVerificationToken ?? '';
		const matched = Boolean(expected) && observed.some((value) => value === expected);

		row.domainLastCheckedAt = new Date();
		if (matched) {
			row.domainStatus = DocumentInboundDomainStatusEnum.VERIFIED;
			row.domainVerifiedAt = row.domainVerifiedAt ?? new Date();
		} else {
			// PENDING stays PENDING (never proven); VERIFIED degrades to FAILED (proof withdrawn).
			row.domainStatus =
				row.domainStatus === DocumentInboundDomainStatusEnum.VERIFIED
					? DocumentInboundDomainStatusEnum.FAILED
					: DocumentInboundDomainStatusEnum.PENDING;
			message = message ?? 'The expected TXT record was not found.';
		}
		await this.repository.save(row);

		return { ...this.describeVerification(row), message };
	}

	/**
	 * Issues a fresh relay secret, invalidating the previous one. Returned in plaintext exactly once.
	 */
	public async rotateSecret(tenantId: ID, organizationId: ID, id: ID): Promise<IDocumentInboundAddressSecret> {
		const row = await this.findOneOrFail(tenantId, organizationId, id);
		const { secret, hash } = this.mintSecret();
		row.webhookSecretHash = hash;
		await this.repository.save(row);
		return { address: row.address, webhookSecret: secret };
	}

	/**
	 * Rotates a PLATFORM address itself (new token ⇒ new address), for when an address leaks and
	 * starts receiving junk. The old address stops resolving immediately.
	 */
	public async rotateAddress(tenantId: ID, organizationId: ID, id: ID): Promise<DocumentInboundAddress> {
		const row = await this.findOneOrFail(tenantId, organizationId, id);
		if (row.kind !== DocumentInboundAddressKindEnum.PLATFORM) {
			throw new BadRequestException('Only a platform address is rotated by changing its token.');
		}
		const domain = this.requirePlatformDomain();
		const token = randomBytes(16).toString('hex');
		row.token = token;
		row.address = `${DOCS_INBOUND_PLATFORM_LOCAL_PREFIX}${token}@${domain}`.toLowerCase();
		return this.repository.save(row);
	}

	public async update(
		tenantId: ID,
		organizationId: ID,
		id: ID,
		input: IDocumentInboundAddressUpdateInput
	): Promise<DocumentInboundAddress> {
		const row = await this.findOneOrFail(tenantId, organizationId, id);
		if (input.senderAllowlist !== undefined) {
			row.senderAllowlistRaw = input.senderAllowlist.length ? JSON.stringify(input.senderAllowlist) : null;
		}
		if (input.importBodyAsNote !== undefined) {
			row.importBodyAsNote = input.importBodyAsNote;
		}
		if (input.isActive !== undefined) {
			row.isActive = input.isActive;
		}
		return this.repository.save(row);
	}

	/**
	 * Resolves a recipient address to its owning scope — the hot path, run on every delivery.
	 *
	 * Replaces the previous untenanted `LIKE 'docs.%.inboundToken'` scan of `tenant_setting` with a
	 * single lookup on a unique index. Deliberately matches on the **whole address**, not just the
	 * local part: the old parser discarded the domain entirely, so `docs-<token>@anything-at-all`
	 * resolved just as well as the real domain.
	 *
	 * Returns `null` for anything not armed — unknown, inactive, or an unverified custom domain —
	 * so the caller answers with the same 404 it gives an unknown route.
	 */
	public async resolveByAddress(recipient?: string): Promise<DocumentInboundAddress | null> {
		const address = this.normalizeRecipient(recipient);
		if (!address) {
			return null;
		}

		const row = await this.repository.findOne({ where: { address } });
		if (!row || row.isActive === false) {
			return null;
		}
		if (row.domainStatus !== DocumentInboundDomainStatusEnum.VERIFIED) {
			this.logger.warn(`Inbound delivery to an unverified address was rejected: ${address}`);
			return null;
		}
		return row;
	}

	/**
	 * Constant-time check of a presented relay secret against the address's stored hash.
	 *
	 * @returns `false` when the address has no per-address secret — the caller then falls back to
	 * the deployment-wide secret, so this returning `false` is "not proven here", not "rejected".
	 */
	public verifySecret(row: DocumentInboundAddress, presented?: string): boolean {
		if (!row.webhookSecretHash || !presented) {
			return false;
		}
		const expected = Buffer.from(row.webhookSecretHash, 'utf8');
		const actual = Buffer.from(createHash('sha256').update(presented).digest('hex'), 'utf8');
		// Length check first — timingSafeEqual throws on a length mismatch.
		if (expected.length !== actual.length) {
			return false;
		}
		return timingSafeEqual(expected, actual);
	}

	/**
	 * Is this sender permitted for this address? An empty/absent allowlist means "any sender that
	 * passed the SPF/DKIM gate". Matches a bare address (`ceo@acme.com`) or a whole domain
	 * (`@acme.com` / `acme.com`).
	 */
	public isSenderAllowed(row: DocumentInboundAddress, sender?: string): boolean {
		return isSenderAllowedBy(row.senderAllowlist, sender);
	}

	/**
	 * Records a successful delivery. Best-effort — a counter must never fail an accepted message.
	 */
	public async recordDelivery(row: DocumentInboundAddress): Promise<void> {
		try {
			await this.repository.update(row.id, {
				lastMessageAt: new Date(),
				messageCount: (row.messageCount ?? 0) + 1
			});
		} catch (error) {
			this.logger.warn(`Could not record inbound delivery stats: ${error}`);
		}
	}

	private async findOneOrFail(tenantId: ID, organizationId: ID, id: ID): Promise<DocumentInboundAddress> {
		// Scoped by tenant AND organization so an id from another tenant is a 404, not a leak.
		const row = await this.repository.findOne({ where: { id, tenantId, organizationId } });
		if (!row) {
			throw new NotFoundException('Inbound address not found.');
		}
		return row;
	}

	private mintSecret(): { secret: string; hash: string } {
		const secret = randomBytes(32).toString('hex');
		return { secret, hash: createHash('sha256').update(secret).digest('hex') };
	}

	private requirePlatformDomain(): string {
		const domain = getDocsConfig().inboundDomain?.trim().toLowerCase();
		if (!domain) {
			throw new BadRequestException(
				'No platform inbound domain is configured (GAUZY_DOCS_INBOUND_DOMAIN).'
			);
		}
		return domain;
	}

	private normalizeDomain(value?: string): string {
		const domain = normalizeInboundDomain(value);
		if (!domain) {
			throw new BadRequestException('That is not a valid domain.');
		}
		return domain;
	}

	private normalizeLocalPart(value?: string): string {
		const localPart = normalizeInboundLocalPart(value);
		if (!localPart) {
			throw new BadRequestException('That is not a valid mailbox name.');
		}
		return localPart;
	}

	/**
	 * Lower-cases the address and strips any `+tag` suffix, so `docs+invoices@acme.com` resolves to
	 * `docs@acme.com` — senders routinely add tags and each one must not look like a new address.
	 */
	private normalizeRecipient(recipient?: string): string | null {
		return normalizeRecipientAddress(recipient);
	}

	private async resolveTxtWithTimeout(name: string): Promise<string[]> {
		const timeout = new Promise<never>((_, reject) =>
			setTimeout(
				() => reject(new Error('DNS lookup timed out.')),
				DOCS_INBOUND_DNS_TIMEOUT_MS
			).unref?.()
		);
		const records = await Promise.race([resolveTxt(name), timeout]);
		// resolveTxt returns chunked strings per record; a long TXT value arrives split.
		return (records as string[][]).map((chunks) => chunks.join(''));
	}
}
