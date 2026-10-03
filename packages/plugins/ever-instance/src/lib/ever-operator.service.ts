import { Inject, Injectable, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RolesEnum } from '@gauzy/contracts';
import { EVER_INSTANCE_ENV, EverInstanceService } from './ever-instance.service';
import { parseInstallSource } from './install-source';
import { dialectOf, quote, runSql, toNumber } from './sql';

/** The parts of a signed-in user the operator check reads. */
export interface EverOperatorCandidate {
	id?: string | null;
	email?: string | null;
}

/**
 * Who operates this installation.
 *
 * In Gauzy a super admin is an administrator of one tenant, and anyone can register a tenant, so
 * "super admin" alone does not identify the person who runs the server. The operator is a super
 * admin who is also:
 *
 * - listed in `EVER_OPERATOR_EMAILS` (comma separated, case-insensitive), when it is set; or
 * - when it is not set and the installation has exactly one tenant: that tenant's first super admin,
 *   pinned once in `ever_instance.operatorUserId`.
 *
 * With more than one tenant and no list, nobody is the operator. On Ever's own cloud
 * (`EVER_INSTALL_SOURCE=cloud`) nobody is, whatever the list says.
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

	/** The addresses of `EVER_OPERATOR_EMAILS`, lower-cased, or `null` when it is unset or empty. */
	operatorEmails(): string[] | null {
		const list = (this.env['EVER_OPERATOR_EMAILS'] ?? '')
			.split(',')
			.map((value) => value.trim().toLowerCase())
			.filter((value) => value.length > 0);
		return list.length ? list : null;
	}

	/** Whether `user`, holding the role `roleName` right now, is the operator of this installation. */
	async isOperator(user: EverOperatorCandidate | null | undefined, roleName: string | null | undefined): Promise<boolean> {
		if (!user?.id || roleName !== RolesEnum.SUPER_ADMIN) {
			return false;
		}
		if (parseInstallSource(this.env) === 'cloud') {
			return false;
		}
		const list = this.operatorEmails();
		if (list) {
			return typeof user.email === 'string' && list.includes(user.email.trim().toLowerCase());
		}
		if ((await this.countTenants()) !== 1) {
			return false;
		}
		const pinned = (await this.instance.get())?.operatorUserId ?? (await this.pinFirstSuperAdmin());
		return pinned === user.id;
	}

	/**
	 * On an installation with one tenant and no `EVER_OPERATOR_EMAILS`, pins its first super admin as
	 * the operator (once). Returns the pinned operator, or `null` when there is none to pin.
	 */
	async pinFirstSuperAdmin(): Promise<string | null> {
		if (this.operatorEmails() || parseInstallSource(this.env) === 'cloud' || (await this.countTenants()) !== 1) {
			return (await this.instance.get())?.operatorUserId ?? null;
		}
		const d = dialectOf(this.dataSource);
		const q = (name: string) => quote(d, name);
		const { rows } = await runSql<{ id: string }>(
			this.dataSource,
			`SELECT u.${q('id')} AS ${q('id')} FROM ${q('user')} u INNER JOIN ${q('role')} r ON r.${q('id')} = u.${q('roleId')} ` +
				`WHERE r.${q('name')} = '${RolesEnum.SUPER_ADMIN}' AND u.${q('deletedAt')} IS NULL ` +
				`ORDER BY u.${q('createdAt')} ASC, u.${q('id')} ASC LIMIT 1`
		);
		const first = rows[0]?.id ? String(rows[0].id) : null;
		if (!first) {
			return null;
		}
		return this.instance.pinOperator(first);
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
