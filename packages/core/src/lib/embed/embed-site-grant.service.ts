import { randomUUID } from 'node:crypto';
import {
	ForbiddenException,
	HttpException,
	Injectable,
	InternalServerErrorException,
	Logger,
	ServiceUnavailableException,
	UnauthorizedException
} from '@nestjs/common';
import { ID, IEmbedAuthorizeInput } from '@gauzy/contracts';
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
import { EmbedSiteTokensResponseDTO } from './dto/embed-site-grant.dto';
import { EmbedAllowedOriginService } from './embed-allowed-origin.service';
import { IEmbedMemberScope } from './embed-member.service';
import { EmbedMemberTokens } from './embed-member-token';
import { normalizeOrigin } from './embed-origin';
import { EmbedSiteGrant } from './embed-site-grant.entity';
import { generateEmbedRenewalToken } from './embed.utils';
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

/** The site grant a timer token and a renewal token are issued for. */
interface IEmbedSiteGrantLink extends IEmbedMemberScope {
	userId: ID;
	origin: string;
	familyId: ID;
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
		private readonly embedAllowedOriginService: EmbedAllowedOriginService
	) {
		this.memberTokens = new EmbedMemberTokens(
			{
				typeOrmEmployeeRepository,
				mikroOrmEmployeeRepository,
				typeOrmUserOrganizationRepository,
				mikroOrmUserOrganizationRepository
			},
			authService,
			() => getORMType()
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
		const userId = RequestContext.currentUserId();
		const tenantId = RequestContext.currentTenantId();
		// TypeORM drops a condition whose value is undefined: without them, the reads would match anyone.
		if (!userId || !tenantId) {
			throw new UnauthorizedException();
		}
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
