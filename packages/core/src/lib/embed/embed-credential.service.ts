import {
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
	UnauthorizedException
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { IsNull } from 'typeorm';
import { ID } from '@gauzy/contracts';
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
import { MikroOrmUserOrganizationRepository } from '../user-organization/repository/mikro-orm-user-organization.repository';
import { TypeOrmUserOrganizationRepository } from '../user-organization/repository/type-orm-user-organization.repository';
import {
	CreateEmbedCredentialDTO,
	EmbedCredentialResponseDTO,
	EmbedCredentialWithSecretResponseDTO,
	EmbedTokenExchangeResponseDTO,
	ExchangeEmbedCredentialDTO
} from './dto/embed-credential.dto';
import { EmbedCredential } from './embed-credential.entity';
import {
	embedCredentialHashesMatch,
	embedTokenTtlSeconds,
	generateEmbedCredential,
	hashEmbedCredential,
	isWellFormedEmbedCredential
} from './embed.utils';
import { MikroOrmEmbedCredentialRepository } from './repository/mikro-orm-embed-credential.repository';
import { TypeOrmEmbedCredentialRepository } from './repository/type-orm-embed-credential.repository';

/** A credential that does not earn a token, already logged with its reason. */
class CredentialRefused extends Error {}

/** A valid credential asked for a member it cannot act for, already logged with its reason. */
class MemberRefused extends Error {}

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

	constructor(
		readonly typeOrmEmbedCredentialRepository: TypeOrmEmbedCredentialRepository,
		readonly mikroOrmEmbedCredentialRepository: MikroOrmEmbedCredentialRepository,
		private readonly typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		private readonly mikroOrmEmployeeRepository: MikroOrmEmployeeRepository,
		private readonly typeOrmUserRepository: TypeOrmUserRepository,
		private readonly mikroOrmUserRepository: MikroOrmUserRepository,
		private readonly typeOrmUserOrganizationRepository: TypeOrmUserOrganizationRepository,
		private readonly mikroOrmUserOrganizationRepository: MikroOrmUserOrganizationRepository,
		private readonly authService: AuthService
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
		const { secret, keyHash, prefix } = generateEmbedCredential();
		const row = await this.create({
			name: input.name,
			organizationId: input.organizationId,
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
	 * credential, and it needs to know why. A database that cannot be reached answers 503.
	 */
	async exchange(input: ExchangeEmbedCredentialDTO): Promise<EmbedTokenExchangeResponseDTO> {
		try {
			return await this.judgeAndMint(input ?? ({} as ExchangeEmbedCredentialDTO));
		} catch (error) {
			// Already a 503 (the mint could not reach the database): never answered as a refused credential.
			if (error instanceof ServiceUnavailableException) {
				throw error;
			}
			if (isDatabaseUnavailableError(error)) {
				this.logger.error(`Embed exchange could not reach the database: ${error?.message}`);
				throw new ServiceUnavailableException(DATABASE_UNAVAILABLE_MESSAGE, { cause: error });
			}
			if (error instanceof MemberRefused) {
				throw new ForbiddenException({
					statusCode: 403,
					code: 'EMBED_MEMBER_NOT_ALLOWED',
					message: 'This member cannot track time through an embed.'
				});
			}
			if (!(error instanceof CredentialRefused)) {
				this.logger.warn(`Embed exchange refused: ${error?.message}`);
			}
			throw new UnauthorizedException();
		}
	}

	private async judgeAndMint({ credential, employeeId, email }: ExchangeEmbedCredentialDTO) {
		const refuseCredential = (reason: string, row?: EmbedCredential): never => {
			this.logger.warn(`Embed exchange refused: ${reason}${row ? ` id=${row.id}` : ''}`);
			throw new CredentialRefused(reason);
		};
		const refuseMember = (reason: string, row: EmbedCredential): never => {
			this.logger.warn(`Embed exchange refused: ${reason} credential=${row.id}`);
			throw new MemberRefused(reason);
		};

		if (!isWellFormedEmbedCredential(credential)) {
			refuseCredential('malformed credential');
		}
		const presented = hashEmbedCredential(credential);
		const row = await this.findByHash(presented);
		if (!row || !embedCredentialHashesMatch(row.keyHash, presented)) {
			refuseCredential('unknown credential');
		}
		if (row.revokedAt) {
			refuseCredential('revoked', row);
		}
		if (!row.tenantId || !row.organizationId) {
			refuseCredential('no organization', row);
		}

		const employee = await this.findMember(row, { employeeId, email });
		if (!employee) {
			refuseMember('not an active member of the organization', row);
		}
		if (!employee.userId || employee.isPlaceholder) {
			refuseMember('a member without an account', row);
		}
		if (!employee.isTrackingEnabled) {
			refuseMember('time tracking is off for this member', row);
		}
		// The token names the organization, and JwtStrategy refuses it without an active membership there.
		if (!(await this.isActiveMember(employee.userId, row))) {
			refuseMember('no active membership of the organization', row);
		}

		const now = new Date();
		const expiresAt = new Date(now.getTime() + embedTokenTtlSeconds() * 1000);
		const token = await this.authService.issueEmbedSession({
			userId: employee.userId,
			tenantId: row.tenantId,
			organizationId: row.organizationId,
			credentialId: row.id,
			employeeId: employee.id,
			expiresAt
		});
		await this.recordUse(row, now);
		this.logger.log(`Embed token issued: credential=${row.id} employee=${employee.id}`);

		const answer = new EmbedTokenExchangeResponseDTO();
		answer.token = token;
		answer.expiresAt = expiresAt.toISOString();
		return answer;
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
		// Addresses are stored as registered, and every sign-in matches them exactly: the address as sent first, then
		// in lower case.
		const typed = email.trim();
		const user =
			(await this.findOneUser({ tenantId: row.tenantId, email: typed })) ??
			(typed !== typed.toLowerCase()
				? await this.findOneUser({ tenantId: row.tenantId, email: typed.toLowerCase() })
				: null);
		if (!user) {
			return null;
		}
		return await this.findOneEmployee({ ...scope, userId: user.id });
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
