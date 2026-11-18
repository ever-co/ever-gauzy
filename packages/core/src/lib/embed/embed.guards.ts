import {
	CanActivate,
	ExecutionContext,
	ForbiddenException,
	Injectable,
	NotFoundException,
	UnauthorizedException
} from '@nestjs/common';
import { environment as env } from '@gauzy/config';
import { EmbedCredentialService } from './embed-credential.service';
import {
	EMBED_FORBIDDEN_TIMER_FIELDS,
	embedRouteOf,
	isSignedBearerToken,
	isWithinEmbedScope,
	readEmbedClaims
} from './embed-session';
import { isEmbedEnabled } from './embed.utils';

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
 * embeds. A credential revoked or a switch turned off refuses its tokens at once (401): the widget asks again.
 */
@Injectable()
export class EmbedSessionGuard implements CanActivate {
	constructor(private readonly embedCredentialService: EmbedCredentialService) {}

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
		if (await this.embedCredentialService.isRevoked(claims.credentialId)) {
			throw new UnauthorizedException();
		}
		return true;
	}
}
