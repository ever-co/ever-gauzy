import { DatabaseTypeEnum } from '@gauzy/config';
import * as chalk from 'chalk';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { PermissionsEnum } from '@gauzy/contracts';
import { RolePermissionUtils } from '../../role-permission/utils';
import { DEFAULT_ROLE_PERMISSIONS } from '../../role-permission/default-role-permissions';
import { prepareSQLQuery as p } from '../database.helper';
import { replacePlaceholders } from '../../core/utils';

/**
 * The first of the three data-only kernel migrations: the permission reload.
 *
 * `DEFAULT_ROLE_PERMISSIONS` now carries the commerce catalogue, and `PermissionsEnum` carries every
 * value of it. Neither of those facts reaches a tenant that is already provisioned, because a
 * `role_permission` row is per-tenant data that only a seed (at provisioning time) or a migration
 * (afterwards) writes. Without this migration an existing tenant keeps the grants it had, so every
 * commerce route answers 403 to every role — including its own owner — no matter how correct the
 * defaults are in code.
 *
 * `migrateRolePermissions` is the standing helper for exactly this: it reads the defaults from code,
 * matches roles by name, and inserts the rows that are missing. It only ever INSERTS. It never
 * removes, disables or re-enables a grant, so a tenant that switched a permission off keeps it off
 * and the migration can be re-run without destroying a customisation.
 *
 * That last property is why this migration does not stop at the helper. A row written **earlier** as
 * disabled is never picked up afterwards, and on an installation whose enum was extended before the
 * defaults were, most of the catalogue is exactly that: present, disabled, and therefore still 403
 * for the tenant's own owner. `grantProgrammePermissions` below closes that gap, and only for the
 * permissions this change is what makes administrable — see its own note for why that cannot
 * overwrite a decision a tenant made.
 *
 * MySQL goes through the same helper: every statement it issues passes through `prepareSQLQuery`
 * (double quotes to backticks) and `replacePlaceholders` (`$n` to `?`), and both `getInsertPayload`
 * and `insertRolePermissions` carry an explicit MySQL branch. Skipping MySQL would leave every role
 * without the catalogue on a MySQL deployment, which is the same outage this migration exists to end.
 *
 * The failure is deliberately NOT swallowed. The two older reloads catch and log, which marks the
 * migration applied even when nothing was inserted; a permissions migration that silently did nothing
 * is indistinguishable from the bug it was written to fix, and it is the one failure this whole change
 * is judged on. An error here surfaces at boot instead, where it can be seen.
 *
 * Timestamps: the appendix numbers these three data-only migrations 1791000000135, 1791000000140 and
 * 1791000000145. Those numbers are taken in this implementation, so the block uses the next free
 * range above the plugin sets (1791000000200–1791000000400 is the highest number any package
 * currently claims) and keeps the appendix's order and spacing: 500 reload, 510 features, 520
 * defaults. The runner orders the merged set by timestamp, so the relative order is what matters and
 * it is unchanged.
 */
export class CoreRolePermissionsReload1791000000500 implements MigrationInterface {
	name = 'CoreRolePermissionsReload1791000000500';

	/**
	 * The resources this programme introduces, by the prefix their permission values share.
	 *
	 * Used by the repair pass below to answer one question: *is this permission one the platform could
	 * already administer before this change?* A permission whose resource is in this list was not in
	 * `PermissionGroups` before this change, so no role editor could display it and no administrator
	 * could have made a decision about it. A permission outside the list was administrable, and a
	 * disabled row for one of those is left exactly as the tenant left it.
	 */
	private static readonly PROGRAMME_RESOURCE_PREFIXES: string[] = [
		'CHANNELS',
		'REGIONS',
		'RULES',
		'SEQUENCES',
		'OPERATIONS',
		'EVENT_OUTBOX',
		'IDEMPOTENCY_KEYS',
		'UNITS',
		'PAYMENT_TERMS',
		'PRODUCTS',
		'COLLECTIONS',
		'PRICE_LISTS',
		'PRODUCT_PRICES',
		'EXCHANGE_RATES',
		'TAX_CATEGORIES',
		'TAX_RATES',
		'TAX_REGIMES',
		'CONTACT_GROUPS',
		'CONTACT_CREDENTIALS',
		'CONTACT_CREDITS',
		'CONTACT_TAX_IDENTITY',
		'STOCK',
		'STOCK_TRANSFER',
		'WAREHOUSE_ZONES',
		'WAREHOUSE_BINS',
		'PICK_LISTS',
		'FULFILLMENTS',
		'SHIPPING_OPTIONS',
		'RETURNS',
		'CLAIMS',
		'EXCHANGES',
		'ORDERS',
		'CARTS',
		'PROMOTIONS',
		'COUPONS',
		'GIFT_CARDS',
		'PAYMENT_PROVIDERS',
		'PAYMENT_SESSIONS',
		'PAYMENT_CALLBACKS',
		'PAYMENT_ACCOUNT_HOLDERS',
		'PAYMENT_METHOD_TOKENS',
		'REFUNDS',
		'PROVIDERS',
		'SUBSCRIPTIONS',
		'PURCHASE_ORDERS',
		'GOODS_RECEIPTS',
		'VENDOR_TERMS',
		'ENTITLEMENTS',
		'SELLERS',
		'SELLER_OFFERINGS',
		'SELLER_COMMISSIONS',
		'SELLER_TRANSACTIONS',
		'SELLER_SETTLEMENTS',
		'SELLER_PAYOUTS',
		'SEARCH',
		'WEBHOOKS',
		'WEBHOOK_DELIVERIES'
	];

	/**
	 * Up Migration
	 *
	 * @param queryRunner
	 */
	public async up(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' start running!'));

		switch (queryRunner.connection.options.type as DatabaseTypeEnum) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
			case DatabaseTypeEnum.postgres:
			case DatabaseTypeEnum.mysql:
				await RolePermissionUtils.migrateRolePermissions(queryRunner);
				await this.grantProgrammePermissions(queryRunner);
				break;
			default:
				throw Error(`Unsupported database: ${queryRunner.connection.options.type}`);
		}
	}

	/**
	 * Down Migration
	 *
	 * Deliberate no-op. Removing the rows would destroy tenant customisations — an administrator who
	 * switched a permission off, or granted one to a role this migration never touched, would lose
	 * that decision — and the permissions are inert on their own: what a role may actually do is
	 * decided by the guards, and the `FEATURE_*` flags of `SeedCoreFeatures1791000000510` are the
	 * rollback lever for the capabilities themselves.
	 *
	 * @param queryRunner
	 */
	public async down(queryRunner: QueryRunner): Promise<void> {
		console.log(chalk.yellow(this.name + ' reverting changes!'));
	}

	/**
	 * Enables the programme's permissions for the roles the defaults grant them to, where the row
	 * exists disabled.
	 *
	 * **Why the reload alone is not enough.** `migrateRolePermissions` inserts a row only when none
	 * exists, and never changes one that does — which is exactly right for a tenant's own decision and
	 * is why `down` here removes nothing. But it means a permission whose row was written **earlier**
	 * as disabled is never picked up afterwards. That is not a hypothetical: the plugin catalogues
	 * declared these values before `DEFAULT_ROLE_PERMISSIONS` granted them, and both the provisioning
	 * seed and an earlier reload wrote a row for every declared value with `enabled` decided by the
	 * defaults *of that moment*. The catalogue's precondition is that the enum and the defaults ship
	 * together; where they did not, the leftover rows are machinery residue, and leaving them alone
	 * would leave most of the capability answering 403 to the tenant's own owner.
	 *
	 * **Why this cannot overwrite a decision.** The pass only touches permissions whose resource is in
	 * `PROGRAMME_RESOURCE_PREFIXES` — the resources this change is what makes administrable in the
	 * first place. Before it, none of them appeared in `PermissionGroups`, so a role editor could not
	 * show them and a tenant could neither grant nor revoke them; a disabled row for one of them is
	 * therefore machinery residue rather than anybody's decision. Every permission outside the list is
	 * out of scope and is left exactly as it was, which is what keeps "a tenant that switched a
	 * permission off keeps it off" true for everything the tenant could actually switch.
	 *
	 * @param queryRunner
	 */
	private async grantProgrammePermissions(queryRunner: QueryRunner): Promise<void> {
		const dbType = queryRunner.connection.options.type as DatabaseTypeEnum;
		const permissions = Object.values(PermissionsEnum).filter((permission) =>
			CoreRolePermissionsReload1791000000500.PROGRAMME_RESOURCE_PREFIXES.some(
				(prefix) => permission === prefix || permission.startsWith(`${prefix}_`)
			)
		);

		for (const { role, defaultEnabledPermissions } of DEFAULT_ROLE_PERMISSIONS) {
			const granted = permissions.filter((permission) => defaultEnabledPermissions.includes(permission));
			if (granted.length === 0) {
				continue;
			}

			for (const permission of granted) {
				await this.run(
					queryRunner,
					dbType,
					`UPDATE "role_permission" SET "enabled" = ${this.trueLiteral(
						queryRunner
					)} WHERE "permission" = $1 AND "enabled" = ${this.falseLiteral(
						queryRunner
					)} AND "roleId" IN (SELECT "id" FROM "role" WHERE "name" = $2)`,
					[permission, role]
				);
			}

			const placeholders = granted.map((_, index) => `$${index + 2}`).join(', ');
			const rows: Array<{ total: number }> =
				(await this.run(
					queryRunner,
					dbType,
					`SELECT COUNT(*) AS "total" FROM "role_permission" "rp"
					 INNER JOIN "role" "r" ON "r"."id" = "rp"."roleId"
					 WHERE "r"."name" = $1 AND "rp"."enabled" = ${this.trueLiteral(
						queryRunner
					)} AND "rp"."permission" IN (${placeholders})`,
					[role, ...granted]
				)) ?? [];

			console.log(
				chalk.green(
					`${this.name}: ${role} holds ${rows[0]?.total ?? 0} of the ${granted.length} programme permission(s) it is granted by default.`
				)
			);
		}
	}

	/**
	 * The dialect's literal for `true` / `false`.
	 *
	 * A literal rather than a parameter because each of these appears twice in one statement, and a
	 * parameter used twice cannot be bound positionally once `$n` has become `?`.
	 *
	 * @param queryRunner
	 * @returns `true` / `false` on Postgres, `1` / `0` elsewhere.
	 */
	private trueLiteral(queryRunner: QueryRunner): string {
		return (queryRunner.connection.options.type as DatabaseTypeEnum) === DatabaseTypeEnum.postgres
			? 'true'
			: '1';
	}

	/**
	 * @param queryRunner
	 * @returns The dialect's literal for `false`.
	 */
	private falseLiteral(queryRunner: QueryRunner): string {
		return (queryRunner.connection.options.type as DatabaseTypeEnum) === DatabaseTypeEnum.postgres
			? 'false'
			: '0';
	}

	/**
	 * Issues one statement, translated to the connection's dialect.
	 *
	 * The SQL is written once with double-quoted identifiers and `$n` placeholders; `prepareSQLQuery`
	 * quotes for MySQL and `replacePlaceholders` turns the placeholders into `?` where the driver
	 * needs them. Every placeholder appears exactly once, which is what keeps the positional binding
	 * correct after the translation.
	 *
	 * @param queryRunner
	 * @param dbType
	 * @param sql
	 * @param parameters
	 * @returns The driver's result.
	 */
	private async run(
		queryRunner: QueryRunner,
		dbType: DatabaseTypeEnum,
		sql: string,
		parameters: any[]
	): Promise<any> {
		let query = p(sql);
		query = replacePlaceholders(query, dbType);
		return await queryRunner.query(query, parameters);
	}
}
