import {
	Body,
	Controller,
	Delete,
	Get,
	Header,
	Headers,
	HttpCode,
	HttpException,
	HttpStatus,
	NotFoundException,
	Param,
	ParseUUIDPipe,
	Post,
	Query,
	Req,
	Res,
	UnauthorizedException,
	UseGuards
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { Public } from '@gauzy/common';
import { LanguagesEnum } from '@gauzy/contracts';
import { RequestContext, UseValidationPipe } from '@gauzy/core';
import {
	BackchannelLogoutDTO,
	ConfirmDTO,
	HandoffDTO,
	LinkConfirmDTO,
	LinkPreviewDTO,
	SignupDTO,
	TokenSigninDTO
} from './dto';
import { ZitadelConfiguredGuard } from './guards/zitadel-configured.guard';
import { ZitadelBackchannelService } from './services/zitadel-backchannel.service';
import { ZitadelConfigService, ZitadelPublicConfig } from './services/zitadel-config.service';
import { ZitadelFlowService } from './services/zitadel-flow.service';
import { ZitadelLinkService } from './services/zitadel-link.service';
import { ZitadelSigninService } from './services/zitadel-signin.service';
import { ZitadelSignupService } from './services/zitadel-signup.service';
import { ZitadelTokenSigninService } from './services/zitadel-token-signin.service';

function currentUserId(): string {
	const userId = RequestContext.currentUserId();
	if (!userId) {
		throw new UnauthorizedException();
	}
	return userId;
}

function language(value: string | undefined): LanguagesEnum {
	return Object.values(LanguagesEnum).includes(value as LanguagesEnum) ? (value as LanguagesEnum) : LanguagesEnum.ENGLISH;
}

/**
 * Ever ID sign-in routes, under `/api/auth/zitadel`. They exist only while the plugin is loaded
 * (`ZITADEL_ENABLED=true`); every existing `/api/auth/*` route is untouched.
 */
@ApiTags('Ever ID sign-in')
@Controller('/auth/zitadel')
export class AuthZitadelController {
	constructor(
		private readonly config: ZitadelConfigService,
		private readonly flow: ZitadelFlowService,
		private readonly signin: ZitadelSigninService,
		private readonly signup: ZitadelSignupService,
		private readonly links: ZitadelLinkService,
		private readonly tokens: ZitadelTokenSigninService,
		private readonly backchannel: ZitadelBackchannelService
	) {}

	/** Tells the web app whether to show the Ever ID button and which flows are on. */
	@Public()
	@Get('/config')
	@Header('Cache-Control', 'no-store')
	getConfig(): Promise<ZitadelPublicConfig> {
		return this.config.publicConfig();
	}

	/** Starts a sign-in: redirects to the issuer (PKCE, state and nonce; never a login hint). */
	@Public()
	@UseGuards(ZitadelConfiguredGuard)
	@Get()
	@Header('Cache-Control', 'no-store')
	async start(@Res() res: Response, @Query('redirect') redirect?: string): Promise<void> {
		res.redirect(302, await this.flow.startSignin(res, redirect));
	}

	/** The issuer redirects back here, for sign-in and link flows alike. */
	@Public()
	@UseGuards(ZitadelConfiguredGuard)
	@Get('/callback')
	@Header('Cache-Control', 'no-store')
	async callback(
		@Req() req: Request,
		@Res() res: Response,
		@Query('code') code?: string,
		@Query('state') state?: string,
		@Query('error') error?: string
	): Promise<void> {
		res.redirect(302, await this.flow.callback(req, res, { code, state, error }));
	}

	/** Redeems the one-time key of a redirect (once). */
	@Public()
	@UseGuards(ZitadelConfiguredGuard)
	@Post('/handoff')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@Throttle({ default: { limit: 10, ttl: 60000 } })
	@UseValidationPipe({ whitelist: true })
	handoff(@Body() body: HandoffDTO) {
		return this.signin.redeemHandoff(body.handoff);
	}

	/** Completes a confirmed link with Gauzy's one-time e-mail code. */
	@Public()
	@UseGuards(ZitadelConfiguredGuard)
	@Post('/confirm')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@Throttle({ default: { limit: 5, ttl: 60000 } })
	@UseValidationPipe({ whitelist: true })
	confirm(@Body() body: ConfirmDTO) {
		return this.signin.confirm(body.handoff, body.code);
	}

	/** The details the sign-up confirmation page shows (the key stays valid). */
	@Public()
	@UseGuards(ZitadelConfiguredGuard)
	@Post('/signup/details')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@Throttle({ default: { limit: 10, ttl: 60000 } })
	@UseValidationPipe({ whitelist: true })
	signupDetails(@Body() body: HandoffDTO) {
		return this.signup.details(body.handoff);
	}

	/** The person confirmed creating a workspace with this Ever ID. */
	@Public()
	@UseGuards(ZitadelConfiguredGuard)
	@Post('/signup')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@Throttle({ default: { limit: 3, ttl: 60000 } })
	@UseValidationPipe({ whitelist: true, transform: true })
	async signupConfirm(@Body() body: SignupDTO, @Headers('language') lang?: string) {
		const result = await this.signup.confirm(body.handoff, body, language(lang));
		if (result.type === 'subscription_required') {
			throw new HttpException(
				{ code: 'subscription_required', checkoutUrl: result.checkoutUrl, handoff: result.key },
				HttpStatus.FORBIDDEN
			);
		}
		return result.response;
	}

	/**
	 * Sign-in with a token another first-party client obtained from Ever ID. Such a client's server
	 * signs many people in from one address, so the per-address limit is higher than on the browser
	 * routes; every request still needs a token signed by the issuer.
	 */
	@Public()
	@UseGuards(ZitadelConfiguredGuard)
	@Post('/token')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@Throttle({ default: { limit: 120, ttl: 60000 } })
	@UseValidationPipe({ whitelist: true })
	token(@Body() body: TokenSigninDTO) {
		return this.tokens.signIn(body);
	}

	/** Signed in: returns the URL that starts linking an Ever ID to this account. */
	@UseGuards(ZitadelConfiguredGuard)
	@Post('/link')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	async link(): Promise<{ url: string }> {
		return { url: await this.links.createTicket(currentUserId()) };
	}

	/** Opened by the browser with the one-time ticket from `POST /link`; redirects to the issuer. */
	@Public()
	@UseGuards(ZitadelConfiguredGuard)
	@Get('/link/start')
	@Header('Cache-Control', 'no-store')
	async linkStart(@Res() res: Response, @Query('ticket') ticket?: string): Promise<void> {
		res.redirect(302, await this.flow.startLink(res, ticket));
	}

	/** Signed in: what the link confirmation screen shows. */
	@UseGuards(ZitadelConfiguredGuard)
	@Post('/link/preview')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@UseValidationPipe({ whitelist: true })
	linkPreview(@Body() body: LinkPreviewDTO) {
		return this.links.preview(body.key, currentUserId());
	}

	/** Signed in: confirms the link (same-address accounts only with Gauzy's one-time e-mail code). */
	@UseGuards(ZitadelConfiguredGuard)
	@Post('/link/confirm')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@Throttle({ default: { limit: 5, ttl: 60000 } })
	@UseValidationPipe({ whitelist: true })
	linkConfirm(@Body() body: LinkConfirmDTO) {
		return this.links.confirm(body.key, currentUserId(), body.rows, body.code);
	}

	/** Signed in: removes one of this account's Ever ID links. */
	@UseGuards(ZitadelConfiguredGuard)
	@Delete('/link/:id')
	@HttpCode(HttpStatus.NO_CONTENT)
	@Header('Cache-Control', 'no-store')
	async unlink(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
		await this.links.unlink(id, currentUserId());
	}

	/** Signed in: the Ever IDs linked to this account. */
	@UseGuards(ZitadelConfiguredGuard)
	@Get('/identities')
	@Header('Cache-Control', 'no-store')
	identities() {
		return this.links.list(currentUserId());
	}

	/** OpenID Connect back-channel logout: ends the sessions opened through that Ever ID session. */
	@Public()
	@UseGuards(ZitadelConfiguredGuard)
	@Post('/backchannel-logout')
	@HttpCode(HttpStatus.OK)
	@Header('Cache-Control', 'no-store')
	@UseValidationPipe({ whitelist: true })
	async backchannelLogout(@Body() body: BackchannelLogoutDTO): Promise<void> {
		if (!this.config.settings.backchannelLogoutEnabled) {
			throw new NotFoundException();
		}
		await this.backchannel.handle(body.logout_token);
	}
}
