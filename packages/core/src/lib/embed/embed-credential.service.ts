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
import { Employee, User } from '../core/entities/internal';
import { MikroOrmEmployeeRepository } from '../employee/repository/mikro-orm-employee.repository';
import { TypeOrmEmployeeRepository } from '../employee/repository/type-orm-employee.repository';
import { MikroOrmUserRepository } from '../user/repository/mikro-orm-user.repository';
import { TypeOrmUserRepository } from '../user/repository/type-orm-user.repository';
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
import { EmbedAllowedOriginService } from './embed-allowed-origin.service';
import { normalizeOrigin } from './embed-origin';
import { TypeOrmEmbedCredentialRepository } from './repository/type-orm-embed-credential.repository';

/** A credential that does not earn a token, already logged with its reason. */
class CredentialRefused extends Error {}

/** A valid credential asked for a member it cannot act for, already logged with its reason. */
class MemberRefused extends Error {}

/** A valid credential asked for a page origin its organization does not allow, already logged. */
class OriginRefused extends Error {}

/** How long a credential's revocation may stay unseen by a running server: its tokens stop within that time. */
export const EMBED_REVOCATION_CACHE_MS = 30_000;

/** How often the last use of a credential is written: at most once a minute. */
const LAST_USED_RESOLUTION_MS = 60_000;

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
		private readonly authService: AuthService,
		private readonly embedAllowedOriginService: EmbedAllowedOriginService
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
		const row = await this.findOneByOptions({ where: { id, tenantId: RequestContext.currentTenantId() } }).catch(
			() => null
		);
		if (!row) {
			throw new NotFoundException();
		}
		if (!row.revokedAt) {
			await this.update(id, { revokedAt: new Date() });
		}
		this.revoked.set(id, { revoked: true, readAt: Date.now() });
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
		const revoked = !row || !!row.revokedAt;
		this.revoked.set(id, { revoked, readAt: now });
		return revoked;
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
			if (isDatabaseUnavailableError(error)) {
				this.logger.error(`Embed exchange could not reach the database: ${error?.message}`);
				throw new ServiceUnavailableException(DATABASE_UNAVAILABLE_MESSAGE, { cause: error });
			}
			if (error instanceof OriginRefused) {
				throw new ForbiddenException({
					statusCode: 403,
					code: 'EMBED_ORIGIN_NOT_ALLOWED',
					message: "This site is not allowed to embed the organization's timer."
				});
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

	private async judgeAndMint({ credential, employeeId, email, origin }: ExchangeEmbedCredentialDTO) {
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

		// The page the widget runs in must be one of the organization's allowed origins; the token is bound to it.
		const pageOrigin = normalizeOrigin(origin);
		const allowed =
			!!pageOrigin && (await this.embedAllowedOriginService.isAllowed(row.tenantId, row.organizationId, pageOrigin));
		if (!allowed) {
			this.logger.warn(`Embed exchange refused: origin not allowed credential=${row.id}`);
			throw new OriginRefused('origin not allowed');
		}

		const employee = await this.findMember(row, { employeeId, email });
		if (!employee) {
			refuseMember('not an active member of the organization', row);
		}
		if (!employee.userId) {
			refuseMember('a member without an account', row);
		}
		if (!employee.isTrackingEnabled) {
			refuseMember('time tracking is off for this member', row);
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
		const user = await this.findOneUser({ tenantId: row.tenantId, email: email.trim().toLowerCase() });
		if (!user) {
			return null;
		}
		return await this.findOneEmployee({ ...scope, userId: user.id });
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
