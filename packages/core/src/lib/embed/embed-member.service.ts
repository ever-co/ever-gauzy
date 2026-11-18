import { createHash } from 'node:crypto';
import { HttpException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { isEmail } from 'class-validator';
import { DataSource, In, Raw } from 'typeorm';
import { ID, IEmployee, IEmployeeCreateInput, IUser, IUserCreateInput, RolesEnum } from '@gauzy/contracts';
import { extractNameFromEmail } from '@gauzy/utils';
import { RequestContext } from '../core/context/request-context';
import { Employee, Role, User, UserOrganization } from '../core/entities/internal';
import { EmployeeCreateCommand } from '../employee/commands/employee.create.command';
import { UserCreateCommand } from '../user/commands/user.create.command';

/** The longest first or last name an exchange gives a new account; a longer one is cut. */
export const EMBED_MEMBER_NAME_MAX_LENGTH = 100;

/** The longest address a member is added for. */
const EMAIL_MAX_LENGTH = 254;

/** The roles whose accounts an embed never touches. */
const ADMINISTRATOR_ROLES: readonly string[] = [RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN];

/** The tenant and organization of the credential that adds a member. */
export interface IEmbedMemberScope {
	tenantId: ID;
	organizationId: ID;
}

/** The person an exchange names, to add: the address as sent, trimmed, and the names its body gives. */
export interface IEmbedNewMember {
	email: string;
	firstName?: string;
	lastName?: string;
}

/** What an addition came to: the new employee, or why the person was not added, for the exchange's log line. */
export type EmbedMemberAddition = { employeeId: ID } | { refused: string };

/** A name of the body, trimmed and cut; none for a blank one or one that is not a string. */
function nameOf(value: unknown): string | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}
	const cut = value.trim().slice(0, EMBED_MEMBER_NAME_MAX_LENGTH);
	const name = cut.trim();
	if (!name) {
		return undefined;
	}
	return name;
}

/**
 * The person an exchange body names, to add as a member: null without a valid address. A name is trimmed and cut at
 * {@link EMBED_MEMBER_NAME_MAX_LENGTH} characters; a blank one, or one that is not a string, is none.
 */
export function newMemberOf(body: {
	email?: unknown;
	firstName?: unknown;
	lastName?: unknown;
}): IEmbedNewMember | null {
	if (typeof body.email !== 'string') {
		return null;
	}
	const email = body.email.trim();
	const isShortEnough = email.length <= EMAIL_MAX_LENGTH;
	if (!isShortEnough || !isEmail(email)) {
		return null;
	}
	return { email, firstName: nameOf(body.firstName), lastName: nameOf(body.lastName) };
}

/** The first name the body gave, else the part of the address before the @, as the platform names a person by it. */
function firstNameOf(person: IEmbedNewMember, email: string): string {
	if (person.firstName) {
		return person.firstName;
	}
	return extractNameFromEmail(email);
}

/** Whether the account holds a role an embed never touches. */
function isAdministrator(account: User): boolean {
	const roleName = account.role?.name;
	if (!roleName) {
		return false;
	}
	return ADMINISTRATOR_ROLES.includes(roleName);
}

/**
 * Whether an account or a membership is live: active, not archived and not deleted, as `JwtStrategy` holds the account
 * and the membership of a token.
 */
function isLive(record: { isActive?: boolean; isArchived?: boolean; deletedAt?: Date }): boolean {
	const isActive = record.isActive === true;
	const isArchived = record.isArchived !== false;
	const isDeleted = Boolean(record.deletedAt);
	return isActive && !isArchived && !isDeleted;
}

/** The status of a refusal the platform answered (a 4xx), or null for any other failure. */
function refusalStatusOf(error: unknown): number | null {
	if (!(error instanceof HttpException)) {
		return null;
	}
	const status = error.getStatus();
	const isClientError = status >= 400 && status < 500;
	if (!isClientError) {
		return null;
	}
	return status;
}

/**
 * Runs `work` as the credential: nobody, in its tenant and organization, with no role, employee or permission, on a
 * request context of its own. The platform's creation commands read the tenant they file the account, the employee
 * and the membership under from the request context, and the exchange is a public request without one. Refuses to run
 * `work` when this process opens no such context.
 */
async function asCredential<T>(scope: IEmbedMemberScope, work: () => Promise<T>): Promise<T> {
	const user = { tenantId: scope.tenantId, lastOrganizationId: scope.organizationId, permissions: [] as string[] };
	const request = { user, headers: {}, query: {}, params: {}, body: {} };
	return await RequestContext.runWithRequest(request as never, async () => {
		if (RequestContext.currentTenantId() !== scope.tenantId) {
			throw new Error(
				"An embed exchange cannot open a request context of its credential's tenant in this process."
			);
		}
		return await work();
	});
}

/** How long a MySQL server waits for another exchange that adds the same person, in seconds. */
const MYSQL_TURN_WAIT_SECONDS = 10;

/** The answer to an exchange that waited too long for another one adding the same person. */
export const EMBED_MEMBER_ADDITION_BUSY_MESSAGE =
	'This person is being added by another request. Try again in a moment.';

/**
 * The name of the turn of one address of a tenant, for this process and for the database's lock: a digest, never the
 * address itself. The address counts in lower case, as the exchange finds a member by it in either case.
 */
function turnNameOf(tenantId: ID, email: string): string {
	const address = email.trim().toLowerCase();
	const digest = createHash('sha256').update(`${tenantId}:${address}`).digest('hex');
	return `gauzy:embed-member:${digest.slice(0, 32)}`;
}

/**
 * Adds the people embed exchanges name as employees of a credential's organization, for a credential that may add
 * members (`canAddMembers`): the tenant's account of the address when it has one, else a new account with the employee
 * role and no password, through the platform's own creation commands. Nothing is sent to the person: the portal that
 * exchanges the credential has signed them in, and they can sign in to the apps later with a code sent to the address.
 *
 * The tenant's accounts and the organization's records are read through TypeORM whichever ORM the server runs, as
 * `EmbedClientService` reads, so both answer the same.
 */
@Injectable()
export class EmbedMemberService {
	/** The turns running in this process, by name: each one waits for the one before it to end. */
	private readonly turns = new Map<string, Promise<void>>();

	constructor(
		private readonly dataSource: DataSource,
		private readonly commandBus: CommandBus
	) {}

	/**
	 * Adds the person as an employee of the credential's organization, unless the address belongs to an administrator,
	 * to an account that is inactive, archived or deleted, to an account stored in another case than the exchange finds,
	 * or to someone the organization archived, deactivated or removed (an employee or a membership of theirs left
	 * there): an exchange never brings such a person back. The caller looked for an active member of the address first,
	 * in its turn ({@link inTurn}).
	 *
	 * A refusal the platform's commands answer (a 4xx: the account stands behind an agent or a member without an
	 * account, the tenant has no employee role) is a refusal too. Any other failure is thrown.
	 *
	 * @param scope The credential's tenant and organization.
	 * @param person The address and the names the exchange gives.
	 * @returns The new employee, or the reason the person was not added.
	 */
	async add(scope: IEmbedMemberScope, person: IEmbedNewMember): Promise<EmbedMemberAddition> {
		const accounts = await this.accountsOf(scope.tenantId, person.email);
		const refusal = await this.refusalOf(scope, person.email, accounts);
		if (refusal) {
			return { refused: refusal };
		}
		try {
			const employee = await asCredential(scope, () => this.file(scope, person, accounts[0]));
			return { employeeId: employee.id };
		} catch (error) {
			const status = refusalStatusOf(error);
			if (status === null) {
				throw error;
			}
			return { refused: `the platform refused to add the account (${status})` };
		}
	}

	/**
	 * The tenant's accounts of the address in any case, deleted ones included, with their role: those of the address
	 * as sent first.
	 */
	private async accountsOf(tenantId: ID, email: string): Promise<User[]> {
		const address = email.toLowerCase();
		const accounts = await this.dataSource.getRepository(User).find({
			where: { tenantId, email: Raw((column) => `LOWER(${column}) = :address`, { address }) },
			relations: { role: true },
			withDeleted: true
		});
		const isAsSent = (account: User) => account.email === email;
		const asSent = accounts.filter(isAsSent);
		const others = accounts.filter((account) => !isAsSent(account));
		return [...asSent, ...others];
	}

	/** Why none of the accounts may be added, or null when the person may be. */
	private async refusalOf(scope: IEmbedMemberScope, email: string, accounts: User[]): Promise<string | null> {
		// The exchange finds a member by the address as sent or in lower case, as every sign-in matches it: an account
		// stored in another case would be added once and refused at every exchange after, and another account for the
		// address would make two people of one.
		const isFound = (account: User) => account.email === email || account.email === email.toLowerCase();
		if (!accounts.every(isFound)) {
			return 'the address has an account in another case';
		}
		if (accounts.some(isAdministrator)) {
			return 'the address belongs to an administrator';
		}
		const isOff = accounts.some((account) => !isLive(account));
		if (isOff) {
			return 'the account is inactive, archived or deleted';
		}
		if (await this.wasInOrganization(scope, accounts)) {
			return 'archived, deactivated or removed in the organization';
		}
		return null;
	}

	/**
	 * Whether one of the accounts has an employee in the organization, deleted ones included, or a membership there
	 * that is not active. The caller found no active member of the address, so any such employee is one the
	 * organization archived, deactivated or removed.
	 */
	private async wasInOrganization(scope: IEmbedMemberScope, accounts: User[]): Promise<boolean> {
		if (accounts.length === 0) {
			return false;
		}
		const where = {
			tenantId: scope.tenantId,
			organizationId: scope.organizationId,
			userId: In(accounts.map((account) => account.id))
		};
		const employees = await this.dataSource.getRepository(Employee).count({ where, withDeleted: true });
		if (employees > 0) {
			return true;
		}
		const memberships = await this.dataSource.getRepository(UserOrganization).find({ where, withDeleted: true });
		return memberships.some((membership) => !isLive(membership));
	}

	/**
	 * Files the person in the organization: the account given, or a new one, then its employee and its membership. The
	 * employee starts work today, which turns their time tracking on, as accepting an invitation does.
	 */
	private async file(scope: IEmbedMemberScope, person: IEmbedNewMember, account?: User): Promise<IEmployee> {
		let holder: IUser | undefined = account;
		if (!holder) {
			holder = await this.createAccount(scope.tenantId, person);
		}
		// By the address, never by the account's id: the command then takes its branch for an existing account, which
		// refuses the account of an agent or of a member without an account, adds the membership and sends no email.
		// Its branch for a new account requires a password and sends a welcome email.
		const input: IEmployeeCreateInput = {
			organizationId: scope.organizationId,
			user: { email: holder.email },
			startedWorkOn: new Date()
		};
		return await this.commandBus.execute(new EmployeeCreateCommand(input));
	}

	/**
	 * A new account of the tenant for the address, in lower case so that every later exchange finds it, with the
	 * tenant's employee role, decided here, and no password.
	 */
	private async createAccount(tenantId: ID, person: IEmbedNewMember): Promise<IUser> {
		const role = await this.dataSource.getRepository(Role).findOne({
			where: { tenantId, name: RolesEnum.EMPLOYEE }
		});
		if (!role) {
			throw new NotFoundException('The tenant has no employee role.');
		}
		const email = person.email.toLowerCase();
		const input: IUserCreateInput = {
			email,
			firstName: firstNameOf(person, email),
			lastName: person.lastName,
			role,
			roleId: role.id
		};
		return await this.commandBus.execute(new UserCreateCommand(input));
	}

	/**
	 * Runs `work` alone for an address of a tenant, so that two exchanges that would add the same person run one after
	 * the other and the second finds the member the first added. Nothing in the database stops a second account of an
	 * address, or a second employee of an account in an organization.
	 *
	 * - in this process, the turns of one address run in the order they were asked for;
	 * - Postgres: a transaction-scoped advisory lock, held by a connection of its own, which the other API processes
	 *   wait for too;
	 * - MySQL: a named lock (`GET_LOCK`) held by a connection of its own; an exchange that waits for it longer than
	 *   {@link MYSQL_TURN_WAIT_SECONDS} gets a 503;
	 * - SQLite: the process's own order (it runs a single API process).
	 *
	 * @param tenantId The credential's tenant.
	 * @param email The address, as the exchange names it.
	 * @param work What runs alone.
	 */
	async inTurn<T>(tenantId: ID, email: string, work: () => Promise<T>): Promise<T> {
		const name = turnNameOf(tenantId, email);
		const previous = this.turns.get(name) ?? Promise.resolve();
		let end: () => void = () => undefined;
		const ended = new Promise<void>((resolve) => {
			end = resolve;
		});
		const last = previous.then(() => ended);
		this.turns.set(name, last);
		try {
			await previous;
			return await this.underDatabaseLock(name, work);
		} finally {
			end();
			if (this.turns.get(name) === last) {
				this.turns.delete(name);
			}
		}
	}

	/** `work` under the database's lock of the name, where the database has one. */
	private async underDatabaseLock<T>(name: string, work: () => Promise<T>): Promise<T> {
		const type = this.dataSource.options.type;
		if (type === 'postgres') {
			return await this.underPostgresLock(name, work);
		}
		if (type === 'mysql') {
			return await this.underMysqlLock(name, work);
		}
		return await work();
	}

	/**
	 * `work` while a transaction of a connection of its own holds the advisory lock; ending the transaction releases
	 * it. The work writes on other connections, so what it wrote is committed before the next holder reads.
	 */
	private async underPostgresLock<T>(name: string, work: () => Promise<T>): Promise<T> {
		const runner = this.dataSource.createQueryRunner();
		await runner.connect();
		try {
			await runner.startTransaction();
			try {
				await runner.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [name]);
				const result = await work();
				await runner.commitTransaction();
				return result;
			} catch (error) {
				if (runner.isTransactionActive) {
					await runner.rollbackTransaction();
				}
				throw error;
			}
		} finally {
			await runner.release();
		}
	}

	/** `work` while a connection of its own holds the named lock, which it releases after. */
	private async underMysqlLock<T>(name: string, work: () => Promise<T>): Promise<T> {
		const runner = this.dataSource.createQueryRunner();
		await runner.connect();
		try {
			const [row] = await runner.query('SELECT GET_LOCK(?, ?) AS `acquired`', [name, MYSQL_TURN_WAIT_SECONDS]);
			const isAcquired = Number(row?.acquired) === 1;
			if (!isAcquired) {
				throw new ServiceUnavailableException(EMBED_MEMBER_ADDITION_BUSY_MESSAGE);
			}
			try {
				return await work();
			} finally {
				await runner.query('SELECT RELEASE_LOCK(?)', [name]);
			}
		} finally {
			await runner.release();
		}
	}
}
