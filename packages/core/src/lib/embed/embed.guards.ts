import {
	CanActivate,
	ExecutionContext,
	ForbiddenException,
	Injectable,
	NotFoundException,
	UnauthorizedException
} from '@nestjs/common';
import { environment as env } from '@gauzy/config';
import { EmbedClientService } from './embed-client.service';
import { EmbedCredentialService } from './embed-credential.service';
import {
	clientStartOf,
	EMBED_FORBIDDEN_TIMER_FIELDS,
	embedRouteOf,
	IEmbedClaims,
	isSignedBearerToken,
	isWithinEmbedScope,
	readEmbedClaims
} from './embed-session';
import { isEmbedEnabled } from './embed.utils';
import { normalizeOrigin } from './embed-origin';

/** Makes the embed routes answer 404 while `GAUZY_EMBED_TOKENS_ENABLED` is off. */
@Injectable()
export class EmbedEnabledGuard implements CanActivate {
	canActivate(): boolean {
		if (!isEmbedEnabled()) {
			throw new NotFoundException();
		}
		return true;
	}
}

const outOfScope = () =>
	new ForbiddenException({ statusCode: 403, code: 'EMBED_SCOPE', message: 'An embed token reaches only the timer.' });

const fromAnotherSite = () =>
	new ForbiddenException({
		statusCode: 403,
		code: 'EMBED_ORIGIN',
		message: 'This embed token works only from the site it was issued for.'
	});

/** The code of the refusal of a start a token limited to a client makes outside that client's projects. */
export const EMBED_CLIENT_PROJECT = 'EMBED_CLIENT_PROJECT';

const outsideClientProjects = () =>
	new ForbiddenException({
		statusCode: 403,
		code: EMBED_CLIENT_PROJECT,
		message:
			"This embed token tracks time only on its client's projects. Start the timer on one of them (projectId), with a task of that project or none."
	});

/** The request of an HTTP call, or of a GraphQL one (its context carries `req`). */
function requestOf(context: ExecutionContext): any {
	if (context.getType() === 'http') {
		return context.switchToHttp().getRequest();
	}
	return context.getArgByIndex(2)?.req ?? null;
}

/**
 * Holds a token minted by the embed exchange to what a timer widget needs (`EMBED_ROUTES`), for its one member in its
 * one organization; every other request carries on untouched. Registered globally, so no route has to know about
 * embeds. A credential revoked or a switch turned off refuses its tokens at once (401): the widget asks again. A token
 * of a person's sign-in from a site (`embedGrantId`) lives out its few minutes; a revoked grant gets no next one. A token
 * of a credential limited to a client starts the timer only on that client's projects (403 `EMBED_CLIENT_PROJECT`).
 */
@Injectable()
export class EmbedSessionGuard implements CanActivate {
	constructor(
		private readonly embedCredentialService: EmbedCredentialService,
		private readonly embedClientService: EmbedClientService
	) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = requestOf(context);
		const claims = readEmbedClaims(request?.headers?.authorization);
		if (!claims) {
			return true;
		}
		if (!isEmbedEnabled() || context.getType() !== 'http') {
			throw new UnauthorizedException();
		}

		const path = String(request.path ?? request.url ?? '').split('?')[0];
		const route = embedRouteOf(request.method, path);
		if (!route || !isWithinEmbedScope(route, request, claims)) {
			throw outOfScope();
		}
		// A browser names the page's origin; the token works only from the one it was exchanged for.
		const requestOrigin = request.headers?.origin;
		if (claims.origin && requestOrigin && normalizeOrigin(requestOrigin) !== claims.origin) {
			throw fromAnotherSite();
		}
		// A start or a stop takes the server's time: an embed cannot backdate.
		if (request.method === 'POST' && request.body && typeof request.body === 'object') {
			for (const field of EMBED_FORBIDDEN_TIMER_FIELDS) {
				delete request.body[field];
			}
		}

		// This guard runs before the JWT guard: only a token this server signed has its credential looked up.
		if (!isSignedBearerToken(request.headers?.authorization, env.JWT_SECRET)) {
			throw new UnauthorizedException();
		}
		// A token of a person's sign-in from a site has no credential: its grant is judged at each renewal.
		const isCredentialToken = !claims.grantId;
		if (isCredentialToken && (await this.embedCredentialService.isRevoked(claims.credentialId))) {
			throw new UnauthorizedException();
		}
		const startsForClient = Boolean(route.startsTimer) && Boolean(claims.clientId);
		if (startsForClient) {
			await this.assertStartForClient(request.body, claims);
		}
		return true;
	}

	/** Refuses a start of a token limited to a client unless it names one of that client's projects. */
	private async assertStartForClient(body: unknown, claims: IEmbedClaims): Promise<void> {
		const start = clientStartOf(body, claims.clientId);
		if (!start) {
			throw outsideClientProjects();
		}
		const scope = { tenantId: claims.tenantId, organizationId: claims.organizationId };
		const keepsToClient = await this.embedClientService.isStartForClient(claims.clientId, scope, start);
		if (!keepsToClient) {
			throw outsideClientProjects();
		}
	}
}
