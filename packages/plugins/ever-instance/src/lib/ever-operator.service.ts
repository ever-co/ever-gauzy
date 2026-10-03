import { Inject, Injectable, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RolesEnum } from '@gauzy/contracts';
import { EVER_INSTANCE_ENV, EverInstanceService } from './ever-instance.service';
import { parseInstallSource } from './install-source';
import { boolLiteral, dialectOf, placeholder, quote, runSql, SqlDialect, toBool, toNumber } from './sql';

/** The parts of a signed-in user the operator check reads. */
export interface EverOperatorCandidate {
	id?: string | null;
	email?: string | null;
}

/** A user as the operator check reads it from the database. */
interface StoredUser {
	id: string;
	email: string | null;
	emailVerified: boolean;
	usable: boolean;
	superAdmin: boolean;
}

/**
 * Who operates this installation.
 *
 * In Gauzy a super admin is an administrator of one tenant, anyone can register a tenant, and an
 * e-mail address is neither unique nor proven at registration. So neither "super admin" nor "has
 * this address" identifies the person who runs the server. The operator is a super admin (now, in the
 * database: not deleted, active, not archived) who is also:
 *
 * - listed by user id in `EVER_OPERATOR_USER_IDS` (comma separated); or
 * - listed by address in `EVER_OPERATOR_EMAILS` (comma separated, case-insensitive), where an address
 *   names one account only: the first account ever created with it (deleted ones included), and only
 *   once that account has confirmed the address. An account registered later with the same address,
 *   in any tenant, is never the operator; or
 * - when neither list is set and the installation has exactly one tenant: that tenant's first super
 *   admin, pinned in `ever_instance.operatorUserId` (and pinned again when the pinned user is deleted,
 *   deactivated or no longer a super admin).
 *
 * With more than one tenant and no list, nobody is the operator. On Ever's own cloud
 * (`EVER_INSTALL_SOURCE=cloud`) nobody is, whatever the lists say.
 */
@Injectable()
export class EverOperatorService {
	private readonly env: Record<string, string | undefined>;

	constructor(
		private readonly dataSource: DataSource,
		private readonly instance: EverInstanceService,
		@Optional() @Inject(EVER_INSTANCE_ENV) env?: Record<string, string | undefined>
	) {
		this.env = env ?? process.env;
	}

	private list(name: string): string[] | null {
		const list = (this.env[name] ?? '')
			.split(',')
			.map((value) => value.trim().toLowerCase())
			.filter((value) => value.length > 0);
		return list.length ? list : null;
	}

	/** The addresses of `EVER_OPERATOR_EMAILS`, lower-cased, or `null` when it is unset or empty. */
	operatorEmails(): string[] | null {
		return this.list('EVER_OPERATOR_EMAILS');
	}

	/** The user ids of `EVER_OPERATOR_USER_IDS`, lower-cased, or `null` when it is unset or empty. */
	operatorUserIds(): string[] | null {
		return this.list('EVER_OPERATOR_USER_IDS');
	}

	/** Whether an operator list (by user id or by address) is set. */
	private listed(): boolean {
		return this.operatorUserIds() !== null || this.operatorEmails() !== null;
	}

	/** Whether `user`, holding the role `roleName` right now, is the operator of this installation. */
	async isOperator(user: EverOperatorCandidate | null | undefined, roleName: string | null | undefined): Promise<boolean> {
		if (!user?.id || roleName !== RolesEnum.SUPER_ADMIN) {
			return false;
		}
		if (parseInstallSource(this.env) === 'cloud') {
			return false;
		}
		const stored = await this.readUser(String(user.id));
		if (!stored || !stored.usable || !stored.superAdmin) {
			return false;
		}
		const ids = this.operatorUserIds();
		const emails = this.operatorEmails();
		if (ids || emails) {
			if (ids?.includes(stored.id.toLowerCase())) {
				return true;
			}
			return emails !== null && (await this.designatedByEmail(stored, emails));
		}
		if ((await this.countTenants()) !== 1) {
			return false;
		}
		return (await this.currentPinnedOperator()) === stored.id;
	}

	/**
	 * A listed address names the first account ever created with it, and only once that account has
	 * confirmed it.
	 */
	private async designatedByEmail(stored: StoredUser, emails: string[]): Promise<boolean> {
		const address = stored.email?.trim().toLowerCase();
		if (!address || !emails.includes(address) || !stored.emailVerified) {
			return false;
		}
		const d = dialectOf(this.dataSource);
		const q = (name: string) => quote(d, name);
		const { rows } = await runSql<{ id: unknown }>(
			this.dataSource,
			`SELECT ${q('id')} AS ${q('id')} FROM ${q('user')} WHERE LOWER(${q('email')}) = ${placeholder(d, 1)} ` +
				`ORDER BY ${q('createdAt')} ASC, ${q('id')} ASC LIMIT 1`,
			[address]
		);
		return rows[0]?.id !== undefined && String(rows[0].id) === stored.id;
	}

	/**
	 * The pinned operator of a single-tenant installation. A pinned user who can no longer be the
	 * operator (deleted, deactivated, archived or no longer a super admin) is replaced by the first
	 * super admin who can.
	 */
	private async currentPinnedOperator(): Promise<string | null> {
		const pinned = (await this.instance.get())?.operatorUserId ?? null;
		if (!pinned) {
			return this.pinFirstSuperAdmin();
		}
		const user = await this.readUser(pinned);
		if (user?.usable && user.superAdmin) {
			return pinned;
		}
		return this.instance.repinOperator(pinned, await this.firstSuperAdmin());
	}

	/**
	 * On an installation with one tenant and no operator list, pins its first super admin as the
	 * operator (once). Returns the pinned operator, or `null` when there is none to pin.
	 */
	async pinFirstSuperAdmin(): Promise<string | null> {
		if (this.listed() || parseInstallSource(this.env) === 'cloud' || (await this.countTenants()) !== 1) {
			return (await this.instance.get())?.operatorUserId ?? null;
		}
		const first = await this.firstSuperAdmin();
		if (!first) {
			return null;
		}
		return this.instance.pinOperator(first);
	}

	/** The earliest-created super admin who is not deleted, active and not archived. */
	private async firstSuperAdmin(): Promise<string | null> {
		const d = dialectOf(this.dataSource);
		const q = (name: string) => quote(d, name);
		const { rows } = await runSql<{ id: string }>(
			this.dataSource,
			`SELECT u.${q('id')} AS ${q('id')} FROM ${q('user')} u INNER JOIN ${q('role')} r ON r.${q('id')} = u.${q('roleId')} ` +
				`WHERE r.${q('name')} = '${RolesEnum.SUPER_ADMIN}' AND ${this.usableUser(d, 'u')} ` +
				`ORDER BY u.${q('createdAt')} ASC, u.${q('id')} ASC LIMIT 1`
		);
		return rows[0]?.id ? String(rows[0].id) : null;
	}

	/** Not deleted, not deactivated, not archived (a missing flag counts as the default). */
	private usableUser(d: SqlDialect, alias: string): string {
		const c = (name: string) => `${alias}.${quote(d, name)}`;
		return (
			`${c('deletedAt')} IS NULL AND (${c('isActive')} IS NULL OR ${c('isActive')} = ${boolLiteral(d, true)}) ` +
			`AND (${c('isArchived')} IS NULL OR ${c('isArchived')} = ${boolLiteral(d, false)})`
		);
	}

	/** The user `id` as the database holds it now, or `null` when there is no such user. */
	private async readUser(id: string): Promise<StoredUser | null> {
		const d = dialectOf(this.dataSource);
		const q = (name: string) => quote(d, name);
		const { rows } = await runSql<Record<string, unknown>>(
			this.dataSource,
			`SELECT u.${q('id')} AS ${q('id')}, u.${q('email')} AS ${q('email')}, u.${q('emailVerifiedAt')} AS ${q('emailVerifiedAt')}, ` +
				`CASE WHEN ${this.usableUser(d, 'u')} THEN 1 ELSE 0 END AS ${q('usable')}, r.${q('name')} AS ${q('roleName')} ` +
				`FROM ${q('user')} u LEFT JOIN ${q('role')} r ON r.${q('id')} = u.${q('roleId')} WHERE u.${q('id')} = ${placeholder(d, 1)}`,
			[id]
		);
		const row = rows[0];
		if (!row) {
			return null;
		}
		return {
			id: String(row['id']),
			email: typeof row['email'] === 'string' ? row['email'] : null,
			emailVerified: row['emailVerifiedAt'] !== null && row['emailVerifiedAt'] !== undefined,
			usable: toBool(row['usable']),
			superAdmin: row['roleName'] === RolesEnum.SUPER_ADMIN
		};
	}

	/** The number of tenants (not counting deleted ones). */
	async countTenants(): Promise<number> {
		const d = dialectOf(this.dataSource);
		const { rows } = await runSql<{ n: unknown }>(
			this.dataSource,
			`SELECT COUNT(*) AS ${quote(d, 'n')} FROM ${quote(d, 'tenant')} WHERE ${quote(d, 'deletedAt')} IS NULL`
		);
		return toNumber(rows[0]?.n) ?? 0;
	}
}
