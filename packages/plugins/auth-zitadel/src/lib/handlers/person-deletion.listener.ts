import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { In, MoreThan, Repository } from 'typeorm';
import { ZitadelAccount } from '../entities/zitadel-account.entity';
import { EverIdAccountLink, EverIdAccountsPort } from '../ports/ever-id-accounts.port';
import { ZitadelSessionService } from '../services/zitadel-session.service';

/** How many links one read of the table holds. */
const PAGE = 500;

/** A lower-case SHA-256 hex digest. */
const HASH_SHAPE = /^[0-9a-f]{64}$/;

/** `sha256(<issuer>#<subject>)`, as Ever Platform names an identity in a person's request. */
export const subjectHashOf = (issuer: string, subject: string): string =>
	createHash('sha256').update(`${issuer}#${subject}`, 'utf8').digest('hex');

/**
 * Answers a connected-instance plugin's questions about Ever ID links for a person's deletion or
 * export request ({@link EverIdAccountsPort}). The request names identities by their hash only, so
 * the links are read a page at a time and hashed here; nothing is read when no valid hash is given.
 *
 * `erase` ends the Gauzy sessions the matching users opened through Ever ID (the `zitadel_session`
 * rows, and the tokens they hold), removes the matching `zitadel_account` rows, then ends the sessions
 * once more (one a sign-in opened meanwhile): when ending the sessions fails, the links are still
 * there for the next attempt. The Gauzy users themselves are not touched: deleting or anonymising an
 * account is the account-deletion feature's decision.
 */
@Injectable()
export class ZitadelPersonDataListener implements EverIdAccountsPort {
	private readonly logger = new Logger('AuthZitadelPlugin');

	constructor(
		@InjectRepository(ZitadelAccount) private readonly accounts: Repository<ZitadelAccount>,
		private readonly sessions: ZitadelSessionService
	) {}

	async findUsers(subjectHashes: string[]): Promise<string[]> {
		return unique((await this.matching(subjectHashes)).map((row) => row.userId));
	}

	async erase(subjectHashes: string[]): Promise<string[]> {
		const rows = await this.matching(subjectHashes);
		if (!rows.length) {
			return [];
		}
		const userIds = unique(rows.map((row) => row.userId));
		await this.sessions.endSessionsOfUsers(userIds);
		await this.accounts.delete({ id: In(rows.map((row) => row.id)) });
		await this.sessions.endSessionsOfUsers(userIds);
		this.logger.log(`Ever ID links removed for a person's deletion request (${rows.length} link(s)).`);
		return userIds;
	}

	async endSessions(userIds: string[]): Promise<void> {
		await this.sessions.endSessionsOfUsers(unique(userIds.filter((id) => typeof id === 'string' && id)));
	}

	async links(tenantIds: string[], after: string | null, limit: number): Promise<EverIdAccountLink[]> {
		if (!tenantIds.length) {
			return [];
		}
		const rows = await this.accounts.find({
			where: { tenantId: In(tenantIds), ...(after ? { id: MoreThan(after) } : {}) },
			relations: { tenant: true },
			order: { id: 'ASC' },
			take: Math.max(1, Math.min(limit, PAGE))
		});
		return rows.map(toLink);
	}

	async findLink(userId: string, issuer: string, subject: string): Promise<EverIdAccountLink | null> {
		if (!userId || !issuer || !subject) {
			return null;
		}
		const row = await this.accounts.findOne({ where: { userId, issuer, subject }, relations: { tenant: true } });
		return row ? toLink(row) : null;
	}

	async linksOfUser(userId: string): Promise<EverIdAccountLink[]> {
		if (!userId) {
			return [];
		}
		const rows = await this.accounts.find({ where: { userId }, relations: { tenant: true }, order: { id: 'ASC' } });
		return rows.map(toLink);
	}

	/** The links whose identity hash is one of `subjectHashes`. */
	private async matching(subjectHashes: string[]): Promise<Array<Pick<ZitadelAccount, 'id' | 'userId'>>> {
		const wanted = new Set(subjectHashes.filter((hash) => typeof hash === 'string' && HASH_SHAPE.test(hash)));
		if (!wanted.size) {
			return [];
		}
		const found: Array<Pick<ZitadelAccount, 'id' | 'userId'>> = [];
		let after: string | null = null;
		for (;;) {
			const page: ZitadelAccount[] = await this.accounts.find({
				select: { id: true, userId: true, issuer: true, subject: true },
				where: after ? { id: MoreThan(after) } : {},
				order: { id: 'ASC' },
				take: PAGE
			});
			for (const row of page) {
				if (wanted.has(subjectHashOf(row.issuer, row.subject))) {
					found.push({ id: row.id, userId: row.userId });
				}
			}
			if (page.length < PAGE) {
				return found;
			}
			after = page[page.length - 1].id;
		}
	}
}

const unique = (values: string[]): string[] => [...new Set(values)];

const toLink = (row: ZitadelAccount): EverIdAccountLink => ({
	id: row.id,
	userId: row.userId,
	tenantId: row.tenantId ?? null,
	tenantName: row.tenant?.name ?? '',
	issuer: row.issuer,
	subject: row.subject,
	linkMethod: row.linkMethod
});
