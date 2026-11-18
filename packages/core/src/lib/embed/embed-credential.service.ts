import {
	BadRequestException,
	ForbiddenException,
	HttpException,
	HttpStatus,
	Injectable,
	InternalServerErrorException,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
	UnauthorizedException
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { IsNull } from 'typeorm';
import { ID, IEmbedClientReport } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
import { TenantAwareCrudService } from '../core/crud/tenant-aware-crud.service';
import { DATABASE_UNAVAILABLE_MESSAGE, isDatabaseUnavailableError } from '../core/errors/database-unavailable';
import { MultiORMEnum, parseTypeORMFindToMikroOrm } from '../core/utils';
import { AuthService } from '../auth/auth.service';
import { Employee, User, UserOrganization } from '../core/entities/internal';
import { MikroOrmEmployeeRepository } from '../employee/repository/mikro-orm-employee.repository';
import { TypeOrmEmployeeRepository } from '../employee/repository/type-orm-employee.repository';
import { MikroOrmUserRepository } from '../user/repository/mikro-orm-user.repository';
import { TypeOrmUserRepository } from '../user/repository/type-orm-user.repository';
import { UNRESOLVED_THROTTLER_TRACKER } from '../throttler/tracker';
import { MikroOrmUserOrganizationRepository } from '../user-organization/repository/mikro-orm-user-organization.repository';
import { TypeOrmUserOrganizationRepository } from '../user-organization/repository/type-orm-user-organization.repository';
import { EmbedClientReportDTO } from './dto/embed-client-report.dto';
import {
	CreateEmbedCredentialDTO,
	EmbedCredentialResponseDTO,
	EmbedCredentialWithSecretResponseDTO,
	EmbedTokenExchangeResponseDTO,
	ExchangeEmbedCredentialDTO
} from './dto/embed-credential.dto';
import { EmbedClientService } from './embed-client.service';
import { EmbedCredential } from './embed-credential.entity';
import {
	EMBED_EXCHANGE_FAILURES_PER_ADDRESS,
	EmbedExchangeFailures,
	recentlyAcceptedEmbedCredentials
} from './embed-exchange-failures';
import {
	embedCredentialHashesMatch,
	embedTokenTtlSeconds,
	generateEmbedCredential,
	hashEmbedCredential,
	isWellFormedEmbedCredential
} from './embed.utils';
import { MikroOrmEmbedCredentialRepository } from './repository/mikro-orm-embed-credential.repository';
import { EmbedAllowedOriginService } from './embed-allowed-origin.service';
import { EmbedMemberAddition, EmbedMemberService, IEmbedNewMember, newMemberOf } from './embed-member.service';
import { normalizeOrigin } from './embed-origin';
import { TypeOrmEmbedCredentialRepository } from './repository/type-orm-embed-credential.repository';

/** A credential that does not earn a token, already logged with its reason. */
class CredentialRefused extends Error {}

/** A valid credential asked for a member it cannot act for, already logged with its reason. */
class MemberRefused extends Error {}

/** A valid credential asked for a page origin its organization does not allow, already logged. */
class OriginRefused extends Error {}

/** An address that had too many credentials refused, answered before any lookup (`EmbedExchangeFailures`). */
class AddressLimited extends Error {}

/** The code of the refusal of a client report to a credential of the whole organization. */
export const EMBED_CLIENT_REQUIRED = 'EMBED_CLIENT_REQUIRED';

/** The code of the refusal of a client report to a credential whose client was deleted. */
export const EMBED_CLIENT_GONE = 'EMBED_CLIENT_GONE';

/** A valid credential that reaches no client report, already logged with its reason. */
class ClientRefused extends Error {
	constructor(
		readonly code: string,
		message: string
	) {
		super(message);
	}
}

/** A client report that could not be read once its credential was accepted, already logged: a 500, never a 401. */
class ReportUnread extends Error {}

/** A member that could not be added once the credential was accepted, already logged: a 500, never a 401. */
class MemberNotAdded extends Error {}

/** The member an exchange body names: by employee id, or by address with the names of a person to add. */
type NamedMember = Pick<ExchangeEmbedCredentialDTO, 'employeeId' | 'email' | 'firstName' | 'lastName'>;

/** The message of what was thrown, for a log line. */
function messageOf(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}

/** The name of what was thrown, for a log line that must not quote its message. */
function nameOf(error: unknown): string {
	if (error instanceof Error) {
		return error.name;
	}
	return typeof error;
}

/** ` id=<id>` of the credential a log line is about; nothing before the credential is found. */
function idOf(row: EmbedCredential | undefined): string {
	if (!row) {
		return '';
	}
	return ` id=${row.id}`;
}

/** How long a credential's revocation may stay unseen by a running server: its tokens stop within that time. */
export const EMBED_REVOCATION_CACHE_MS = 30_000;

/** How often the last use of a credential is written: at most once a minute. */
const LAST_USED_RESOLUTION_MS = 60_000;

/** How many credentials a server remembers the revocation of; the least recently read is forgotten first. */
const REVOCATION_CACHE_MAX_ENTRIES = 10_000;

/**
 * Embed credentials: an organization's administrators create them for a host's backend, which exchanges one for a
 * short-lived token limited to one member and to the timer (`EmbedSessionGuard` holds such a token to its routes).
 */
@Injectable()
export class EmbedCredentialService extends TenantAwareCrudService<EmbedCredential> {
	private readonly logger = new Logger(EmbedCredentialService.name);
	private readonly revoked = new Map<ID, { revoked: boolean; readAt: number }>();
	/** Shares its memory of accepted credentials with the route's rate limiter (`embed-exchange-throttle.ts`). */
	private readonly exchangeFailures = new EmbedExchangeFailures(undefined, recentlyAcceptedEmbedCredentials);

	constructor(
		readonly typeOrmEmbedCredentialRepository: TypeOrmEmbedCredentialRepository,
		readonly mikroOrmEmbedCredentialRepository: MikroOrmEmbedCredentialRepository,
		private readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		private readonly mikroOrmEmployeeRepository: MikroOrmEmployeeRepository,
		private readonly typeOrmUserRepository: TypeOrmUserRepository,
		private readonly mikroOrmUserRepository: MikroOrmUserRepository,
		private readonly typeOrmUserOrganizationRepository: TypeOrmUserOrganizationRepository,
		private readonly mikroOrmUserOrganizationRepository: MikroOrmUserOrganizationRepository,
		private readonly authService: AuthService,
		private readonly embedAllowedOriginService: EmbedAllowedOriginService,
		private readonly embedClientService: EmbedClientService,
		private readonly embedMemberService: EmbedMemberService
	) {
		super(typeOrmEmbedCredentialRepository, mikroOrmEmbedCredentialRepository);
	}

	/** The organization's credentials that still work, newest first, without any secret. */
	async listForOrganization(organizationId: ID): Promise<EmbedCredentialResponseDTO[]> {
		const rows = await this.find({
			where: { organizationId, tenantId: RequestContext.currentTenantId(), revokedAt: IsNull() },
			order: { createdAt: 'DESC' }
		});
		return rows.map((row) => EmbedCredentialResponseDTO.from(row));
	}

	/** A new credential for the organization; the answer is the only one that holds its secret. */
	async createForOrganization(input: CreateEmbedCredentialDTO): Promise<EmbedCredentialWithSecretResponseDTO> {
		const organizationContactId = await this.clientOfNewCredential(input);
		const { secret, keyHash, prefix } = generateEmbedCredential();
		const row = await this.create({
			name: input.name,
			organizationId: input.organizationId,
			organizationContactId,
			canAddMembers: input.canAddMembers === true,
			tenantId: RequestContext.currentTenantId(),
			keyHash,
			prefix,
			lastUsedAt: null,
			revokedAt: null
		});
		this.logger.log(`Embed credential created: id=${row.id} organizationId=${row.organizationId}`);
		const answer = Object.assign(new EmbedCredentialWithSecretResponseDTO(), EmbedCredentialResponseDTO.from(row));
		answer.secret = secret;
		return answer;
	}

	/**
	 * The client a new credential is limited to: none when the input names none, else a contact of the credential's
	 * organization, in the caller's tenant, that is not deleted.
	 *
	 * @throws BadRequestException for any other contact.
	 */
	private async clientOfNewCredential(input: CreateEmbedCredentialDTO): Promise<ID | null> {
		const contactId = input.organizationContactId;
		if (!contactId) {
			return null;
		}
		const client = await this.embedClientService.findClient(contactId, {
			tenantId: RequestContext.currentTenantId(),
			organizationId: input.organizationId
		});
		if (!client) {
			throw new BadRequestException('The client must be a contact of the organization the credential is for.');
		}
		return client.id;
	}

	/** Revokes a credential of the caller's tenant: its tokens are refused within {@link EMBED_REVOCATION_CACHE_MS}. */
	async revoke(id: ID): Promise<void> {
		// A miss is a 404; a lookup that failed (the database out of reach) is not, and nothing was revoked.
		const row = await this.findOneByOptions({ where: { id, tenantId: RequestContext.currentTenantId() } }).catch(
			(error: unknown) => {
				if (error instanceof NotFoundException) {
					return null;
				}
				throw error;
			}
		);
		if (!row) {
			throw new NotFoundException();
		}
		if (!row.revokedAt) {
			await this.update(id, { revokedAt: new Date() });
		}
		this.remember(id, true, Date.now());
		this.exchangeFailures.forgetAccepted(row.keyHash);
		this.logger.log(`Embed credential revoked: id=${id}`);
	}

	/**
	 * Whether a credential no longer earns anything: revoked, deleted or unknown. Read at most every
	 * {@link EMBED_REVOCATION_CACHE_MS} per credential, so the guard costs no query on most requests.
	 */
	async isRevoked(id: ID): Promise<boolean> {
		const known = this.revoked.get(id);
		const now = Date.now();
		if (known && now - known.readAt < EMBED_REVOCATION_CACHE_MS) {
			return known.revoked;
		}
		const row = await this.findById(id);
		// A revocation this server recorded while the read was on its way wins over what the read found.
		const meanwhile = this.revoked.get(id);
		if (meanwhile?.revoked && meanwhile.readAt >= now) {
			return true;
		}
		const revoked = !row || !!row.revokedAt;
		this.remember(id, revoked, now);
		return revoked;
	}

	/** Records what a read found, within {@link REVOCATION_CACHE_MAX_ENTRIES}: the map keeps the order of the reads. */
	private remember(id: ID, revoked: boolean, readAt: number): void {
		this.revoked.delete(id);
		if (this.revoked.size >= REVOCATION_CACHE_MAX_ENTRIES) {
			this.revoked.delete(this.revoked.keys().next().value);
		}
		this.revoked.set(id, { revoked, readAt });
	}

	/**
	 * Exchanges a credential for a token limited to one member of its organization and to the timer.
	 *
	 * A credential that does not earn a token gets one 401, whatever the reason (malformed, unknown, revoked). A good
	 * credential that names a member it cannot act for gets a 403 with a code: only a host's backend holds a
	 * credential, and it needs to know why. A database that cannot be reached answers 503. An address that had too many
	 * credentials refused within a minute gets a 429 with a code, before any lookup (`EmbedExchangeFailures`).
	 *
	 * A credential that may add members (`canAddMembers`) adds the person an exchange names by address when the address
	 * has no active member in its organization, then answers the token as for any member (see {@link memberOf}).
	 *
	 * @param input The credential and the member.
	 * @param address The client address, as the rate limiter resolves it; without one, the shared unresolved bucket.
	 */
	async exchange(
		input: ExchangeEmbedCredentialDTO,
		address: string = UNRESOLVED_THROTTLER_TRACKER
	): Promise<EmbedTokenExchangeResponseDTO> {
		try {
			return await this.judgeAndMint(input ?? ({} as ExchangeEmbedCredentialDTO), address);
		} catch (error) {
			throw this.refusalOf(error, 'exchange');
		}
	}

	/**
	 * The spent time of the client a credential is limited to, for its portal's server: today, this week, and this week
	 * by project (`EmbedClientService.reportOf`).
	 *
	 * The credential is judged as the exchange judges it, with the same answers (401, 429, 503) and the same count of
	 * refused credentials per address. A credential of the whole organization gets a 403 `EMBED_CLIENT_REQUIRED`, and
	 * one whose client was deleted a 403 `EMBED_CLIENT_GONE` (a client deleted for good takes its credentials with it,
	 * which then get the 401 of an unknown credential). A report that could not be read once the credential was
	 * accepted gets a 500, or the 503 of a database out of reach, never a 401.
	 *
	 * @param input The credential.
	 * @param address The client address, as the rate limiter resolves it; without one, the shared unresolved bucket.
	 */
	async clientReport(
		input: EmbedClientReportDTO,
		address: string = UNRESOLVED_THROTTLER_TRACKER
	): Promise<IEmbedClientReport> {
		try {
			const row = await this.acceptCredential(input?.credential, address, 'client report');
			return await this.reportOfClient(row);
		} catch (error) {
			throw this.refusalOf(error, 'client report');
		}
	}

	/** The report of the credential's client; refused when the credential has no client, or its client is gone. */
	private async reportOfClient(row: EmbedCredential): Promise<IEmbedClientReport> {
		if (!row.organizationContactId) {
			this.logger.warn(`Embed client report refused: no client credential=${row.id}`);
			throw new ClientRefused(
				EMBED_CLIENT_REQUIRED,
				'This credential is not limited to a client. Create one for the client whose time it reports.'
			);
		}
		const now = new Date();
		const scope = { tenantId: row.tenantId, organizationId: row.organizationId };
		let report: IEmbedClientReport | null;
		try {
			report = await this.embedClientService.reportOf(row.organizationContactId, scope, now);
		} catch (error) {
			// The credential was accepted: a failure of the read is the server's, never a refused credential.
			if (isDatabaseUnavailableError(error)) {
				throw error;
			}
			this.logger.error(`Embed client report could not be read: credential=${row.id} ${messageOf(error)}`);
			throw new ReportUnread();
		}
		if (!report) {
			this.logger.warn(`Embed client report refused: the client is gone credential=${row.id}`);
			throw new ClientRefused(
				EMBED_CLIENT_GONE,
				"This credential's client was deleted. Restore the client, or create a credential for another one."
			);
		}
		await this.recordUse(row, now);
		return report;
	}

	/**
	 * What a request whose credential did not get it through is answered: a 503 when the database is out of reach, a
	 * 403 with a code for a page origin the organization does not allow, a member the credential cannot act for or a
	 * client report it cannot read (the report is asked server to server, with no origin), a 500 for a client
	 * report or a member addition that failed after its credential was accepted, a 429 with a code for a capped
	 * address, and one 401 for every refused credential.
	 *
	 * @param error What stopped the request.
	 * @param route The route, as its log lines name it.
	 */
	private refusalOf(error: unknown, route: string): HttpException {
		// Already a 503 (the mint could not reach the database): never answered as a refused credential.
		if (error instanceof ServiceUnavailableException) {
			return error;
		}
		if (isDatabaseUnavailableError(error)) {
			this.logger.error(`Embed ${route} could not reach the database: ${messageOf(error)}`);
			return new ServiceUnavailableException(DATABASE_UNAVAILABLE_MESSAGE, { cause: error });
		}
		if (error instanceof OriginRefused) {
			return new ForbiddenException({
				statusCode: 403,
				code: 'EMBED_ORIGIN_NOT_ALLOWED',
				message: "This site is not allowed to embed the organization's timer."
			});
		}
		if (error instanceof MemberRefused) {
			return new ForbiddenException({
				statusCode: 403,
				code: 'EMBED_MEMBER_NOT_ALLOWED',
				message: 'This member cannot track time through an embed.'
			});
		}
		if (error instanceof ClientRefused) {
			return new ForbiddenException({ statusCode: 403, code: error.code, message: error.message });
		}
		const isUnreadReport = error instanceof ReportUnread;
		const isMemberNotAdded = error instanceof MemberNotAdded;
		if (isUnreadReport || isMemberNotAdded) {
			return new InternalServerErrorException();
		}
		if (error instanceof AddressLimited) {
			return new HttpException(
				{
					statusCode: HttpStatus.TOO_MANY_REQUESTS,
					code: 'EMBED_EXCHANGE_LIMITED',
					message: 'Too many refused credentials from this address. Try again in a minute.'
				},
				HttpStatus.TOO_MANY_REQUESTS
			);
		}
		if (!(error instanceof CredentialRefused)) {
			this.logger.warn(`Embed ${route} refused: ${messageOf(error)}`);
		}
		return new UnauthorizedException();
	}

	/**
	 * The working credential a request presents. A malformed, unknown or revoked one is refused (`CredentialRefused`)
	 * and counted against the address it came from; an address at the cap is refused before any lookup
	 * (`AddressLimited`, `EmbedExchangeFailures`).
	 *
	 * @param credential The credential, as the body holds it.
	 * @param address The client address, as the rate limiter resolves it.
	 * @param route The route, as its log lines name it.
	 */
	private async acceptCredential(credential: string, address: string, route: string): Promise<EmbedCredential> {
		// Whether the lookup below was counted against the address up front (`EmbedExchangeFailures.admit`).
		let counted = false;
		const refuseCredential = (reason: string, row?: EmbedCredential): never => {
			this.logger.warn(`Embed ${route} refused: ${reason}${idOf(row)}`);
			if (!counted) {
				this.countRefusal(address);
			}
			throw new CredentialRefused(reason);
		};

		if (!isWellFormedEmbedCredential(credential)) {
			refuseCredential('malformed credential');
		}
		const presented = hashEmbedCredential(credential);
		// Counted before the lookup, so lookups running at the same time cannot all pass the cap.
		const admission = this.exchangeFailures.admit(address, presented);
		if (!admission.allowed) {
			throw new AddressLimited();
		}
		counted = admission.counted;
		if (admission.reachesCap) {
			this.logCap();
		}
		let row: EmbedCredential | null;
		try {
			row = await this.findByHash(presented);
		} catch (error) {
			// Not judged (the database out of reach): the lookup is given back.
			this.exchangeFailures.release(address, admission);
			throw error;
		}
		if (!row || !embedCredentialHashesMatch(row.keyHash, presented)) {
			refuseCredential('unknown credential');
		}
		// A revocation this server recorded while the lookup was on its way wins over what the lookup found.
		if (row.revokedAt || this.revoked.get(row.id)?.revoked) {
			this.exchangeFailures.forgetAccepted(presented);
			refuseCredential('revoked', row);
		}
		if (!row.tenantId || !row.organizationId) {
			refuseCredential('no organization', row);
		}
		this.exchangeFailures.release(address, admission);
		this.exchangeFailures.recordAccepted(presented);
		return row;
	}

	private async judgeAndMint(input: ExchangeEmbedCredentialDTO, address: string) {
		const { credential, origin } = input;
		const row = await this.acceptCredential(credential, address, 'exchange');

		// The page the widget runs in must be one of the organization's allowed origins; the token is bound to it.
		const pageOrigin = normalizeOrigin(origin);
		const allowed =
			!!pageOrigin && (await this.embedAllowedOriginService.isAllowed(row.tenantId, row.organizationId, pageOrigin));
		if (!allowed) {
			this.logger.warn(`Embed exchange refused: origin not allowed credential=${row.id}`);
			throw new OriginRefused('origin not allowed');
		}

		const employee = await this.memberOf(row, input);
		if (!employee) {
			this.refuseMember('not an active member of the organization', row);
		}
		if (!employee.userId || employee.isPlaceholder) {
			this.refuseMember('a member without an account', row);
		}
		if (!employee.isTrackingEnabled) {
			this.refuseMember('time tracking is off for this member', row);
		}
		// The token names the organization, and JwtStrategy refuses it without an active membership there.
		if (!(await this.isActiveMember(employee.userId, row))) {
			this.refuseMember('no active membership of the organization', row);
		}

		const now = new Date();
		const expiresAt = new Date(now.getTime() + embedTokenTtlSeconds() * 1000);
		const token = await this.authService.issueEmbedSession({
			userId: employee.userId,
			tenantId: row.tenantId,
			organizationId: row.organizationId,
			credentialId: row.id,
			employeeId: employee.id,
			origin: pageOrigin,
			clientId: row.organizationContactId,
			expiresAt
		});
		await this.recordUse(row, now);
		this.logger.log(`Embed token issued: credential=${row.id} employee=${employee.id}`);

		const answer = new EmbedTokenExchangeResponseDTO();
		answer.token = token;
		answer.expiresAt = expiresAt.toISOString();
		return answer;
	}

	/** Refuses the member an exchange names (`MemberRefused`, a 403 with a code), with the reason in the log. */
	private refuseMember(reason: string, row: EmbedCredential): never {
		this.logger.warn(`Embed exchange refused: ${reason} credential=${row.id}`);
		throw new MemberRefused(reason);
	}

	/**
	 * The member an exchange is for: the active member of the organization it names, or else, for a credential that may
	 * add members and an exchange that names a valid address and no employee id, the person of that address, added
	 * (`EmbedMemberService.add`). Two exchanges that would add the same person take turns, and the second finds the
	 * member the first added.
	 */
	private async memberOf(row: EmbedCredential, named: NamedMember): Promise<Employee | null> {
		const found = await this.findMember(row, named);
		if (found) {
			return found;
		}
		const person = this.personToAdd(row, named);
		if (!person) {
			return null;
		}
		try {
			return await this.embedMemberService.inTurn(row.tenantId, person.email, () => this.addMember(row, person));
		} catch (error) {
			throw this.additionFailureOf(error, row);
		}
	}

	/**
	 * What an addition that did not end with a member is answered, its credential accepted: a refusal (of the member,
	 * or of a credential revoked while the exchange waited for its turn) and a database out of reach stay as they
	 * are. Any other failure, of the addition, of the reads around it or of its turn, is logged by its name (a
	 * database's message may quote the address) and answered 500, never the 401 of a refused credential.
	 */
	private additionFailureOf(error: unknown, row: EmbedCredential): unknown {
		const isAnswered =
			error instanceof MemberRefused ||
			error instanceof CredentialRefused ||
			error instanceof MemberNotAdded ||
			error instanceof ServiceUnavailableException;
		if (isAnswered || isDatabaseUnavailableError(error)) {
			return error;
		}
		this.logger.error(`Embed member could not be added: credential=${row.id} ${nameOf(error)}`);
		return new MemberNotAdded();
	}

	/** The person to add: none unless the credential may add members and the exchange names an address alone. */
	private personToAdd(row: EmbedCredential, named: NamedMember): IEmbedNewMember | null {
		const addsMembers = row.canAddMembers === true;
		const namesEmployee = Boolean(named.employeeId);
		if (!addsMembers || namesEmployee) {
			return null;
		}
		return newMemberOf(named);
	}

	/**
	 * Adds the person, unless the exchange that held the turn before added them already. The credential was accepted
	 * before the turn: one revoked meanwhile adds no one, and gets the 401 of a revoked credential.
	 */
	private async addMember(row: EmbedCredential, person: IEmbedNewMember): Promise<Employee | null> {
		if (!(await this.stillAddsMembers(row))) {
			this.logger.warn(`Embed exchange refused: revoked before the member was added credential=${row.id}`);
			throw new CredentialRefused('revoked');
		}
		const meanwhile = await this.findMember(row, { email: person.email });
		if (meanwhile) {
			return meanwhile;
		}
		const scope = { tenantId: row.tenantId, organizationId: row.organizationId };
		let addition: EmbedMemberAddition;
		try {
			addition = await this.embedMemberService.add(scope, person);
		} catch (error) {
			if (isDatabaseUnavailableError(error)) {
				throw error;
			}
			// The error's name only: a database's message may quote the address.
			this.logger.error(`Embed member could not be added: credential=${row.id} ${nameOf(error)}`);
			throw new MemberNotAdded();
		}
		if ('refused' in addition) {
			this.refuseMember(addition.refused, row);
		}
		this.logger.log(`Embed member added: credential=${row.id} employee=${addition.employeeId}`);
		return await this.findMember(row, { employeeId: addition.employeeId });
	}

	/** Whether the credential, read again, still may add members: not revoked or deleted since it was accepted. */
	private async stillAddsMembers(row: EmbedCredential): Promise<boolean> {
		if (this.revoked.get(row.id)?.revoked) {
			return false;
		}
		const current = await this.findById(row.id);
		if (!current || current.revokedAt) {
			return false;
		}
		return current.canAddMembers === true;
	}

	/** Counts a refused credential against the address it came from, and says so once the address reaches the cap. */
	private countRefusal(address: string): void {
		if (this.exchangeFailures.recordFailure(address)) {
			this.logCap();
		}
	}

	private logCap(): void {
		this.logger.warn(
			`Embed exchange: an address had ${EMBED_EXCHANGE_FAILURES_PER_ADDRESS} credentials refused or pending within a minute; until the minute ends, it gets 429 for any credential this server has not accepted recently`
		);
	}

	/** An active, unarchived employee of the credential's organization, by id or by their account's email. */
	private async findMember(
		row: EmbedCredential,
		{ employeeId, email }: { employeeId?: ID; email?: string }
	): Promise<Employee | null> {
		const scope = { tenantId: row.tenantId, organizationId: row.organizationId, isActive: true, isArchived: false };
		if (employeeId) {
			if (!isUUID(employeeId)) {
				return null;
			}
			return await this.findOneEmployee({ ...scope, id: employeeId });
		}
		if (typeof email !== 'string' || !email.trim()) {
			return null;
		}
		// Addresses are stored as registered, and every sign-in matches them exactly: the account of the address as sent
		// first, then of the address in lower case; the first one that is a member of the credential's organization.
		const typed = email.trim();
		const addresses = typed === typed.toLowerCase() ? [typed] : [typed, typed.toLowerCase()];
		for (const address of addresses) {
			const user = await this.findOneUser({ tenantId: row.tenantId, email: address });
			const employee = user ? await this.findOneEmployee({ ...scope, userId: user.id }) : null;
			if (employee) {
				return employee;
			}
		}
		return null;
	}

	/** Whether the user is an active, unarchived member of the credential's organization. */
	private async isActiveMember(userId: ID, row: EmbedCredential): Promise<boolean> {
		const where = {
			userId,
			tenantId: row.tenantId,
			organizationId: row.organizationId,
			isActive: true,
			isArchived: false
		};
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const parsed = parseTypeORMFindToMikroOrm<UserOrganization>({ where } as any);
				return !!(await this.mikroOrmUserOrganizationRepository.findOne(parsed.where, parsed.mikroOptions));
			}
			case MultiORMEnum.TypeORM:
				return !!(await this.typeOrmUserOrganizationRepository.findOne({ where }));
			default:
				throw new Error(`ORM type not implemented: ${this.ormType}`);
		}
	}

	private async findOneEmployee(where: Record<string, unknown>): Promise<Employee | null> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const parsed = parseTypeORMFindToMikroOrm<Employee>({ where } as any);
				return (await this.mikroOrmEmployeeRepository.findOne(parsed.where, parsed.mikroOptions)) as Employee | null;
			}
			case MultiORMEnum.TypeORM:
				return await this.typeOrmEmployeeRepository.findOne({ where });
			default:
				throw new Error(`ORM type not implemented: ${this.ormType}`);
		}
	}

	private async findOneUser(where: Record<string, unknown>): Promise<User | null> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const parsed = parseTypeORMFindToMikroOrm<User>({ where } as any);
				return (await this.mikroOrmUserRepository.findOne(parsed.where, parsed.mikroOptions)) as User | null;
			}
			case MultiORMEnum.TypeORM:
				return await this.typeOrmUserRepository.findOne({ where });
			default:
				throw new Error(`ORM type not implemented: ${this.ormType}`);
		}
	}

	/** Straight from the repository: the exchange is public, so the tenant comes from the row. */
	private async findByHash(keyHash: string): Promise<EmbedCredential | null> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const { where, mikroOptions } = parseTypeORMFindToMikroOrm<EmbedCredential>({ where: { keyHash } });
				return (await this.mikroOrmEmbedCredentialRepository.findOne(where, mikroOptions)) as EmbedCredential | null;
			}
			case MultiORMEnum.TypeORM:
				return await this.typeOrmEmbedCredentialRepository.findOne({ where: { keyHash } });
			default:
				throw new Error(`ORM type not implemented: ${this.ormType}`);
		}
	}

	/** By id, from the repository: the guard runs before the request's tenant is known. */
	private async findById(id: ID): Promise<EmbedCredential | null> {
		if (!isUUID(id)) {
			return null;
		}
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const { where, mikroOptions } = parseTypeORMFindToMikroOrm<EmbedCredential>({ where: { id } });
				return (await this.mikroOrmEmbedCredentialRepository.findOne(where, mikroOptions)) as EmbedCredential | null;
			}
			case MultiORMEnum.TypeORM:
				return await this.typeOrmEmbedCredentialRepository.findOne({ where: { id } });
			default:
				throw new Error(`ORM type not implemented: ${this.ormType}`);
		}
	}

	/** Records the use, at most once a minute. It never fails an exchange. */
	private async recordUse(row: EmbedCredential, now: Date): Promise<void> {
		const last = row.lastUsedAt ? new Date(row.lastUsedAt).getTime() : 0;
		if (now.getTime() - last < LAST_USED_RESOLUTION_MS) {
			return;
		}
		try {
			switch (this.ormType) {
				case MultiORMEnum.MikroORM:
					await this.mikroOrmEmbedCredentialRepository.nativeUpdate({ id: row.id } as any, { lastUsedAt: now } as any);
					break;
				case MultiORMEnum.TypeORM:
					await this.typeOrmEmbedCredentialRepository.update({ id: row.id }, { lastUsedAt: now });
					break;
				default:
					throw new Error(`ORM type not implemented: ${this.ormType}`);
			}
		} catch (error) {
			this.logger.warn(`Could not record the use of embed credential ${row.id}: ${error?.message}`);
		}
	}
}
