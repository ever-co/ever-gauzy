import { randomUUID } from 'node:crypto';
import {
	ForbiddenException,
	HttpException,
	Injectable,
	InternalServerErrorException,
	Logger,
	NotFoundException,
	ServiceUnavailableException,
	UnauthorizedException
} from '@nestjs/common';
import { In, IsNull, MoreThan, Not, Repository } from 'typeorm';
import { ID, IEmbedAuthorizeInput, IEmbedRenewalInput, PermissionsEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context/request-context';
import { DATABASE_UNAVAILABLE_MESSAGE, isDatabaseUnavailableError } from '../core/errors/database-unavailable';
import { getORMType } from '../core/utils';
import { AuthService } from '../auth/auth.service';
import { assertFirstPartyRequest } from '../auth/oauth-app-first-party';
import { Employee } from '../core/entities/internal';
import { MikroOrmEmployeeRepository } from '../employee/repository/mikro-orm-employee.repository';
import { TypeOrmEmployeeRepository } from '../employee/repository/type-orm-employee.repository';
import { MikroOrmUserOrganizationRepository } from '../user-organization/repository/mikro-orm-user-organization.repository';
import { TypeOrmUserOrganizationRepository } from '../user-organization/repository/type-orm-user-organization.repository';
import { MikroOrmUserRepository } from '../user/repository/mikro-orm-user.repository';
import { TypeOrmUserRepository } from '../user/repository/type-orm-user.repository';
import { RolePermissionService } from '../role-permission/role-permission.service';
import { EmbedSiteGrantResponseDTO, EmbedSiteTokensResponseDTO } from './dto/embed-site-grant.dto';
import { EmbedAllowedOriginService } from './embed-allowed-origin.service';
import { IEmbedMemberScope } from './embed-member.service';
import { EmbedMemberTokens } from './embed-member-token';
import { normalizeOrigin } from './embed-origin';
import { EmbedSiteGrant } from './embed-site-grant.entity';
import {
	embedCredentialHashesMatch,
	generateEmbedRenewalToken,
	hashEmbedCredential,
	isWellFormedEmbedRenewalToken
} from './embed.utils';
import { TypeOrmEmbedSiteGrantRepository } from './repository/type-orm-embed-site-grant.repository';

/** How long a renewal token works: each renewal gives the sign-in this long again. */
export const EMBED_SITE_GRANT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** The code of the refusal of a site the organization allows, but does not let people sign in from. */
export const EMBED_SITE_SIGN_IN_OFF = 'EMBED_SITE_SIGN_IN_OFF';

const siteNotAllowed = () =>
	new ForbiddenException({
		statusCode: 403,
		code: 'EMBED_ORIGIN_NOT_ALLOWED',
		message:
			"This site is not one of the organization's allowed sites. Ask an administrator of the organization to add it."
	});

const signInOff = () =>
	new ForbiddenException({
		statusCode: 403,
		code: EMBED_SITE_SIGN_IN_OFF,
		message:
			'People cannot sign in from this site. Ask an administrator of the organization to turn sign-in on for it.'
	});

const memberNotAllowed = () =>
	new ForbiddenException({
		statusCode: 403,
		code: 'EMBED_MEMBER_NOT_ALLOWED',
		message:
			'Only an active member of the organization whose time tracking is on can start a timer from a site. Ask an administrator of the organization.'
	});

/** The code of the refusal of a renewal token that no longer works: unknown, revoked, expired or already used. */
export const EMBED_GRANT_ENDED = 'EMBED_GRANT_ENDED';

const grantEnded = () =>
	new UnauthorizedException({
		statusCode: 401,
		code: EMBED_GRANT_ENDED,
		message:
			"This site's sign-in has ended: it was revoked, it expired or its renewal token was already used. Sign in again from this site."
	});

const fromAnotherSite = () =>
	new ForbiddenException({
		statusCode: 403,
		code: 'EMBED_ORIGIN',
		message: 'This renewal token works only from the site it was issued for. Renew it from that site.'
	});

/** The site grant a timer token and a renewal token are issued for. */
interface IEmbedSiteGrantLink extends IEmbedMemberScope {
	userId: ID;
	origin: string;
	familyId: ID;
}

/** Whether any token of a sign-in is revoked: a revocation ends the whole sign-in, whatever token it did not reach. */
async function isFamilyRevoked(grants: Repository<EmbedSiteGrant>, familyId: ID): Promise<boolean> {
	const revoked = await grants.findOne({ where: { familyId, revokedAt: Not(IsNull()) }, select: { id: true } });
	return revoked !== null;
}

/** The name and the driver's code of what was thrown, for a log line: a database's message may quote a value. */
function failureNameOf(error: unknown): string {
	let name: string = typeof error;
	if (error instanceof Error) {
		name = error.name;
	}
	const code = (error as { code?: unknown } | null)?.code;
	if (typeof code !== 'string') {
		return name;
	}
	return `${name} code=${code}`;
}

/**
 * The sites people allow to start and stop their own timer, without a server of the site's own. A person allows a site
 * from the web app, with their session (`POST /embed/authorize`); the site gets a timer token like the credential
 * exchange's (`EmbedMemberTokens`) and a renewal token, bound to that site, that person and that organization.
 *
 * The rows are read and written through TypeORM whichever ORM the server runs, as `EmbedMemberService` and
 * `EmbedClientService` do, so both answer the same. Nothing here is read while `GAUZY_EMBED_TOKENS_ENABLED` is off.
 */
@Injectable()
export class EmbedSiteGrantService {
	private readonly logger = new Logger(EmbedSiteGrantService.name);
	private readonly memberTokens: EmbedMemberTokens;

	constructor(
		private readonly typeOrmEmbedSiteGrantRepository: TypeOrmEmbedSiteGrantRepository,
		typeOrmEmployeeRepository: TypeOrmEmployeeRepository,
		mikroOrmEmployeeRepository: MikroOrmEmployeeRepository,
		typeOrmUserOrganizationRepository: TypeOrmUserOrganizationRepository,
		mikroOrmUserOrganizationRepository: MikroOrmUserOrganizationRepository,
		authService: AuthService,
		private readonly embedAllowedOriginService: EmbedAllowedOriginService,
		typeOrmUserRepository: TypeOrmUserRepository,
		mikroOrmUserRepository: MikroOrmUserRepository,
		rolePermissionService: RolePermissionService
	) {
		this.memberTokens = new EmbedMemberTokens(
			{
				typeOrmEmployeeRepository,
				mikroOrmEmployeeRepository,
				typeOrmUserOrganizationRepository,
				mikroOrmUserOrganizationRepository,
				typeOrmUserRepository,
				mikroOrmUserRepository
			},
			authService,
			() => getORMType(),
			rolePermissionService
		);
	}

	/**
	 * A timer token and a renewal token for a site the signed-in person allows, in an organization where they are an
	 * active member who may track time, for a site the organization allows with sign-in on. Refused (403 with a code)
	 * otherwise, and to a third-party application's token or an API token's session: allowing a site is the person's
	 * own act. A 503 when the database is out of reach.
	 */
	async authorize(input: IEmbedAuthorizeInput): Promise<EmbedSiteTokensResponseDTO> {
		assertFirstPartyRequest('Allowing a site to start your timer');
		const { tenantId, userId } = this.signedIn();
		const scope = { tenantId, organizationId: input.organizationId };
		try {
			const employee = await this.memberTokens.findEmployee({
				...scope,
				userId,
				isActive: true,
				isArchived: false
			});
			await this.assertMayTrack(employee, scope, `user=${userId}`);
			const origin = normalizeOrigin(input.origin);
			await this.assertSignInAllowed(scope, origin, `user=${userId}`);
			const grant = { ...scope, userId, origin, familyId: randomUUID() };
			const { row, answer } = await this.issue(grant, employee, new Date());
			await this.typeOrmEmbedSiteGrantRepository.insert(row);
			this.logger.log(
				`Embed site grant created: family=${grant.familyId} employee=${employee.id} origin=${origin}`
			);
			return answer;
		} catch (error) {
			throw this.failureOf(error, 'authorization');
		}
	}

	/**
	 * The next pair for the site that holds a renewal token, which works once. It works only from its own site (the
	 * request's `Origin` header, as a browser sends it), until it expires, while the organization still allows the site
	 * with sign-in on and the person is still an active member who may track time: each of those is refused with its
	 * own code, and the token keeps working once the refusal is lifted. A token unknown, revoked, expired or already
	 * used gets one 401 `EMBED_GRANT_ENDED`. Revocation belongs to the whole sign-in: a token already used or revoked,
	 * presented again, revokes every token of its sign-in, and a token of a sign-in any token of which is revoked is
	 * refused, so a revocation that missed a token a concurrent renewal stored still ends the sign-in there.
	 *
	 * @param input The renewal token, as the body holds it.
	 * @param requestOrigin The request's `Origin` header.
	 */
	async renew(input: IEmbedRenewalInput, requestOrigin: unknown): Promise<EmbedSiteTokensResponseDTO> {
		try {
			return await this.judgeAndRenew(input?.renewalToken, requestOrigin);
		} catch (error) {
			throw this.failureOf(error, 'renewal');
		}
	}

	/**
	 * Revokes every token of the sign-in a renewal token belongs to: the site's sign-out. Answers the same whatever the
	 * token, so the answer tells nobody whether one existed. The timer token the site holds lives out its few minutes.
	 *
	 * @param input The renewal token, as the body holds it.
	 */
	async revoke(input: IEmbedRenewalInput): Promise<void> {
		try {
			const row = await this.findByToken(input?.renewalToken);
			if (!row) {
				return;
			}
			const revoked = await this.revokeFamily(row.familyId, new Date());
			if (revoked > 0) {
				this.logger.log(`Embed site grant revoked by its site: family=${row.familyId}`);
			}
		} catch (error) {
			throw this.failureOf(error, 'revocation');
		}
	}

	private async judgeAndRenew(presented: unknown, requestOrigin: unknown): Promise<EmbedSiteTokensResponseDTO> {
		const spent = await this.findByToken(presented);
		if (!spent) {
			this.logger.warn('Embed site renewal refused: unknown renewal token');
			throw grantEnded();
		}
		const subject = `family=${spent.familyId}`;
		if (normalizeOrigin(requestOrigin) !== spent.origin) {
			this.logger.warn(`Embed site renewal refused: from another origin ${subject}`);
			throw fromAnotherSite();
		}
		const now = new Date();
		await this.assertLive(spent, now);
		const scope = { tenantId: spent.tenantId, organizationId: spent.organizationId };
		await this.assertSignInAllowed(scope, spent.origin, subject);
		const employee = await this.memberTokens.findEmployee({
			...scope,
			id: spent.employeeId,
			userId: spent.userId,
			isActive: true,
			isArchived: false
		});
		await this.assertMayTrack(employee, scope, subject);
		const grant = { ...scope, userId: spent.userId, origin: spent.origin, familyId: spent.familyId };
		const { row, answer } = await this.issue(grant, employee, now);
		const isRotated = await this.rotate(spent, row, now);
		if (!isRotated) {
			// Another renewal took the token, or a revocation reached the sign-in, between the checks and the write.
			await this.revokeFamily(spent.familyId, now);
			this.logger.warn(
				`Embed site grant revoked: its token was taken or its sign-in revoked meanwhile ${subject}`
			);
			throw grantEnded();
		}
		this.logger.log(`Embed site grant renewed: ${subject}`);
		return answer;
	}

	/**
	 * Refuses a renewal token that no longer works. One already used or revoked, presented again, revokes every token of
	 * its sign-in first: either one of its holders is not the site, or the revocation that reached it missed a token
	 * stored since. One of a sign-in any token of which is revoked revokes the rest of it too. An expired one is refused
	 * alone.
	 */
	private async assertLive(row: EmbedSiteGrant, now: Date): Promise<void> {
		const subject = `family=${row.familyId}`;
		const isSpent = Boolean(row.usedAt) || Boolean(row.revokedAt);
		if (isSpent) {
			await this.revokeFamily(row.familyId, now);
			this.logger.warn(
				`Embed site grant revoked: a used or revoked renewal token was presented again ${subject}`
			);
			throw grantEnded();
		}
		if (new Date(row.expiresAt).getTime() <= now.getTime()) {
			this.logger.warn(`Embed site renewal refused: expired ${subject}`);
			throw grantEnded();
		}
		if (await isFamilyRevoked(this.typeOrmEmbedSiteGrantRepository, row.familyId)) {
			await this.revokeFamily(row.familyId, now);
			this.logger.warn(`Embed site grant revoked: a revocation had reached another of its tokens ${subject}`);
			throw grantEnded();
		}
	}

	/**
	 * The signed-in person's site grants that still work, newest first; with an organization, every member's grants
	 * there, for an administrator of the organization's embeds (`ALL_ORG_EDIT`, as the allowed sites take). A grant is
	 * listed once, under the same id through its renewals, until it is revoked or expires: a grant any token of which is
	 * revoked is not listed, whatever token a revocation missed. No token is ever listed.
	 *
	 * @param organizationId The organization whose grants an administrator lists; none for the person's own.
	 */
	async listGrants(organizationId?: ID): Promise<EmbedSiteGrantResponseDTO[]> {
		const { tenantId, userId } = this.signedIn();
		let owner: Record<string, ID> = { userId };
		if (organizationId) {
			this.assertGrantAdministrator();
			owner = { organizationId };
		}
		const rows = await this.typeOrmEmbedSiteGrantRepository.find({
			where: { tenantId, ...owner, usedAt: IsNull(), revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
			order: { createdAt: 'DESC' }
		});
		const revoked = await this.revokedFamiliesOf(rows);
		const live = rows.filter((row) => !revoked.has(row.familyId));
		return live.map((row) => EmbedSiteGrantResponseDTO.from(row));
	}

	/** The sign-ins among the rows' that have a revoked token. */
	private async revokedFamiliesOf(rows: EmbedSiteGrant[]): Promise<Set<ID>> {
		if (rows.length === 0) {
			return new Set();
		}
		const familyIds = rows.map((row) => row.familyId);
		const revoked = await this.typeOrmEmbedSiteGrantRepository.find({
			where: { familyId: In(familyIds), revokedAt: Not(IsNull()) },
			select: { familyId: true }
		});
		return new Set(revoked.map((row) => row.familyId));
	}

	/**
	 * Revokes a site grant: the signed-in person's own, or any of their tenant for an administrator of the embeds
	 * (`ALL_ORG_EDIT`). Its next renewal is refused; the timer token the site holds lives out its few minutes. Anyone
	 * else gets the 404 of a grant that does not exist.
	 *
	 * @param id The grant, as the list names it.
	 */
	async revokeGrant(id: ID): Promise<void> {
		const { tenantId, userId } = this.signedIn();
		const row = await this.typeOrmEmbedSiteGrantRepository.findOne({ where: { tenantId, familyId: id } });
		const isOwn = row?.userId === userId;
		const mayRevoke = isOwn || RequestContext.hasPermission(PermissionsEnum.ALL_ORG_EDIT);
		if (!row || !mayRevoke) {
			throw new NotFoundException();
		}
		await this.revokeFamily(id, new Date());
		let revokedBy = 'an administrator';
		if (isOwn) {
			revokedBy = 'its person';
		}
		this.logger.log(`Embed site grant revoked by ${revokedBy}: family=${id}`);
	}

	/** The signed-in person's tenant and account; a request without them is refused. */
	private signedIn(): { tenantId: ID; userId: ID } {
		const userId = RequestContext.currentUserId();
		const tenantId = RequestContext.currentTenantId();
		// TypeORM drops a condition whose value is undefined: without them, the reads would match anyone.
		if (!userId || !tenantId) {
			throw new UnauthorizedException();
		}
		return { tenantId, userId };
	}

	/** Refuses anyone but an administrator of the organization's embeds the grants of other people. */
	private assertGrantAdministrator(): void {
		if (!RequestContext.hasPermission(PermissionsEnum.ALL_ORG_EDIT)) {
			throw new ForbiddenException(
				"Only an administrator of the organization's embeds sees everyone's site grants. Leave out organizationId to see your own."
			);
		}
	}

	/** Refuses a member who may not get a timer token (`EmbedMemberTokens.refusalOf`), with the reason in the log. */
	private async assertMayTrack(employee: Employee | null, scope: IEmbedMemberScope, subject: string): Promise<void> {
		const refusal = await this.memberTokens.refusalOf(employee, scope);
		if (refusal) {
			this.logger.warn(`Embed site sign-in refused: ${refusal} ${subject}`);
			throw memberNotAllowed();
		}
	}

	/** Refuses a site the organization does not allow, or does not let people sign in from. */
	private async assertSignInAllowed(scope: IEmbedMemberScope, origin: string | null, subject: string): Promise<void> {
		const site = await this.embedAllowedOriginService.findAllowed(scope.tenantId, scope.organizationId, origin);
		if (!site) {
			this.logger.warn(`Embed site sign-in refused: origin not allowed ${subject}`);
			throw siteNotAllowed();
		}
		if (site.allowPersonSignIn !== true) {
			this.logger.warn(`Embed site sign-in refused: sign-in is off for the origin ${subject}`);
			throw signInOff();
		}
	}

	/**
	 * The next pair of a site grant: a timer token bound to the site, the person's member and the grant, and a new
	 * renewal token, with the row that stores its digest. Nothing is written here.
	 */
	private async issue(
		grant: IEmbedSiteGrantLink,
		employee: Employee,
		now: Date
	): Promise<{ row: Partial<EmbedSiteGrant>; answer: EmbedSiteTokensResponseDTO }> {
		const scope = { tenantId: grant.tenantId, organizationId: grant.organizationId };
		const binding = { credentialId: grant.familyId, grantId: grant.familyId, origin: grant.origin };
		const minted = await this.memberTokens.mint(employee, scope, binding, now);
		const { token: renewalToken, keyHash } = generateEmbedRenewalToken();
		const renewalExpiresAt = new Date(now.getTime() + EMBED_SITE_GRANT_TTL_MS);
		const row: Partial<EmbedSiteGrant> = {
			...scope,
			userId: grant.userId,
			employeeId: employee.id,
			origin: grant.origin,
			familyId: grant.familyId,
			keyHash,
			expiresAt: renewalExpiresAt,
			usedAt: null,
			revokedAt: null
		};
		const answer = new EmbedSiteTokensResponseDTO();
		answer.token = minted.token;
		answer.expiresAt = minted.expiresAt.toISOString();
		answer.renewalToken = renewalToken;
		answer.renewalExpiresAt = renewalExpiresAt.toISOString();
		return { row, answer };
	}

	/** The row of a renewal token, by its digest, compared again in constant time; null for anything else. */
	private async findByToken(presented: unknown): Promise<EmbedSiteGrant | null> {
		if (!isWellFormedEmbedRenewalToken(presented)) {
			return null;
		}
		const keyHash = hashEmbedCredential(presented);
		const row = await this.typeOrmEmbedSiteGrantRepository.findOne({ where: { keyHash } });
		if (!row || !embedCredentialHashesMatch(row.keyHash, keyHash)) {
			return null;
		}
		return row;
	}

	/**
	 * Spends the token and stores the next one, together: the token is spent only if no renewal or revocation took it
	 * first, and the next one is stored only with it, while no token of its sign-in is revoked. False when the token was
	 * taken or the sign-in revoked: no next token is stored.
	 */
	private async rotate(spent: EmbedSiteGrant, next: Partial<EmbedSiteGrant>, now: Date): Promise<boolean> {
		return await this.typeOrmEmbedSiteGrantRepository.manager.transaction(async (manager) => {
			const grants = manager.getRepository(EmbedSiteGrant);
			const live = { id: spent.id, usedAt: IsNull(), revokedAt: IsNull() };
			const { affected } = await grants.update(live, { usedAt: now });
			if (!affected) {
				return false;
			}
			// Read under the spent token's row lock: a revocation that committed after the checks, from a snapshot taken
			// before this token was stored, revoked an earlier token of the sign-in and not this one.
			if (await isFamilyRevoked(grants, spent.familyId)) {
				return false;
			}
			await grants.insert(next);
			return true;
		});
	}

	/**
	 * Revokes the tokens of a sign-in the statement sees. A token a concurrent renewal stores after the statement's
	 * snapshot is not among them; it is refused at its own renewal, which finds the sign-in revoked (`assertLive`,
	 * `rotate`), and that renewal revokes it.
	 *
	 * @returns How many tokens it revoked.
	 */
	private async revokeFamily(familyId: ID, now: Date): Promise<number> {
		const { affected } = await this.typeOrmEmbedSiteGrantRepository.update(
			{ familyId, revokedAt: IsNull() },
			{ revokedAt: now }
		);
		return affected ?? 0;
	}

	/**
	 * What a request that did not get its tokens is answered: a refusal stays as it is, a database out of reach is a
	 * 503, and any other failure a 500, logged by its name and code only.
	 */
	private failureOf(error: unknown, route: string): HttpException {
		if (error instanceof HttpException) {
			return error;
		}
		if (isDatabaseUnavailableError(error)) {
			this.logger.error(`Embed site ${route} could not reach the database: ${failureNameOf(error)}`);
			return new ServiceUnavailableException(DATABASE_UNAVAILABLE_MESSAGE, { cause: error });
		}
		this.logger.error(`Embed site ${route} failed: ${failureNameOf(error)}`);
		return new InternalServerErrorException();
	}
}
