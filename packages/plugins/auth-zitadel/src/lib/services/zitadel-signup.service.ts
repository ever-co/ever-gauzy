import { BadRequestException, GoneException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OidcValidatedIdToken } from '@gauzy/auth';
import { ITermsAcceptanceClaim, LanguagesEnum } from '@gauzy/contracts';
import { GAUZY_AUTH, GauzyAuthPort } from '../ports/gauzy-auth.port';
import { ZitadelAccountService, ZitadelIdentity } from './zitadel-account.service';
import { ZitadelClaimHints } from './zitadel-claims.service';
import { ZitadelConfigService } from './zitadel-config.service';
import { ZitadelEventsService } from './zitadel-events.service';
import { ZitadelStoreService } from './zitadel-store.service';
import { ZitadelSubscriptionGateService } from './zitadel-subscription-gate.service';
import { ZitadelSigninWorkspaceResponse, ZitadelWorkspaceService } from './zitadel-workspace.service';

/** Longest accepted first or last name. */
const MAX_NAME_LENGTH = 100;

/**
 * The record behind `#/auth/ever-id/signup?handoff=…`: what the confirmation page shows. It holds the
 * verified identity server-side; the browser only ever sees the opaque key.
 */
export interface ZitadelSignupOffer {
	identity: ZitadelIdentity;
	email: string;
	firstName?: string;
	lastName?: string;
	sid?: string;
	hints: ZitadelClaimHints;
	/** Set when a confirmed sign-up is waiting for a subscription. */
	status?: 'subscription_required';
	checkoutUrl?: string;
}

/**
 * A sign-up the person confirmed, kept server-side and keyed to the verified identity (issuer and
 * subject), so it resumes when the person comes back with Ever ID (for example after checkout).
 * It expires with `ZITADEL_CONFIRM_TTL_S` and is used once.
 */
export interface ZitadelPendingSignup {
	identity: ZitadelIdentity;
	email: string;
	firstName?: string;
	lastName?: string;
	terms?: ITermsAcceptanceClaim[];
	locale: LanguagesEnum;
	confirmedAt: number;
}

/** What the confirmation page sends. */
export interface ZitadelSignupConfirmation {
	confirm: boolean;
	firstName?: string;
	lastName?: string;
	terms?: ITermsAcceptanceClaim[];
}

/** The result of a sign-up attempt. */
export type ZitadelSignupResult =
	| { type: 'workspaces'; response: ZitadelSigninWorkspaceResponse }
	| { type: 'subscription_required'; key: string; checkoutUrl: string };

/** The details the confirmation page shows. */
export interface ZitadelSignupDetails {
	email: string;
	firstName?: string;
	lastName?: string;
	status?: 'subscription_required';
	checkoutUrl?: string;
}

/**
 * The confirmed sign-up path for people new to Gauzy (Ever Cloud only, `ZITADEL_SIGNUP_ENABLED=true`).
 *
 * Nothing is created until the person confirms "create a workspace with this Ever ID". The account is
 * then made by Gauzy's own register path, behind Gauzy's own subscription gate; without a
 * subscription the confirmed sign-up waits (server-side, keyed to the identity) while the person goes
 * through checkout, and finishes when they sign in with Ever ID again. Silent account creation does
 * not exist.
 */
@Injectable()
export class ZitadelSignupService {
	private readonly logger = new Logger(ZitadelSignupService.name);

	constructor(
		private readonly config: ZitadelConfigService,
		private readonly accounts: ZitadelAccountService,
		private readonly workspaces: ZitadelWorkspaceService,
		private readonly store: ZitadelStoreService,
		private readonly gate: ZitadelSubscriptionGateService,
		private readonly events: ZitadelEventsService,
		@Inject(GAUZY_AUTH) private readonly gauzyAuth: GauzyAuthPort
	) {}

	/**
	 * Called for a verified identity without a link: resumes a confirmed sign-up waiting for this
	 * identity, or offers the confirmation page.
	 */
	async offer(
		identity: ZitadelIdentity,
		idToken: OidcValidatedIdToken,
		hints: ZitadelClaimHints
	): Promise<{ type: 'workspaces'; response: ZitadelSigninWorkspaceResponse } | { type: 'signup'; key: string }> {
		const pending = await this.store.get<ZitadelPendingSignup>('pending-signup', this.pendingKey(identity));
		if (pending) {
			const result = await this.attempt(pending, idToken.sid, hints);
			return result.type === 'workspaces' ? result : { type: 'signup', key: result.key };
		}
		const key = this.store.newKey();
		const offer: ZitadelSignupOffer = {
			identity,
			email: identity.email,
			firstName: idToken.givenName,
			lastName: idToken.familyName,
			sid: idToken.sid,
			hints
		};
		await this.store.put('signup', key, offer, this.config.settings.confirmTtlSeconds);
		return { type: 'signup', key };
	}

	/** What the confirmation page shows (the key stays valid). */
	async details(key: string): Promise<ZitadelSignupDetails> {
		this.assertEnabled();
		const offer = await this.store.get<ZitadelSignupOffer>('signup', key);
		if (!offer) {
			throw new GoneException();
		}
		return {
			email: offer.email,
			firstName: offer.firstName,
			lastName: offer.lastName,
			status: offer.status,
			checkoutUrl: offer.checkoutUrl
		};
	}

	/**
	 * The person confirmed. Records the confirmed sign-up and runs Gauzy's register path.
	 *
	 * @throws NotFoundException when the sign-up path is off; BadRequestException without the
	 *   confirmation; GoneException for an unknown, expired or used key.
	 */
	async confirm(key: string, body: ZitadelSignupConfirmation, locale: LanguagesEnum): Promise<ZitadelSignupResult> {
		this.assertEnabled();
		if (body?.confirm !== true) {
			throw new BadRequestException('The sign-up must be confirmed.');
		}
		const offer = await this.store.take<ZitadelSignupOffer>('signup', key);
		if (!offer) {
			throw new GoneException();
		}
		const pending: ZitadelPendingSignup = {
			identity: offer.identity,
			email: offer.email,
			firstName: cleanName(body.firstName) ?? cleanName(offer.firstName),
			lastName: cleanName(body.lastName) ?? cleanName(offer.lastName),
			terms: Array.isArray(body.terms) ? body.terms : undefined,
			locale,
			confirmedAt: Date.now()
		};
		await this.store.put('pending-signup', this.pendingKey(offer.identity), pending, this.config.settings.confirmTtlSeconds);
		return this.attempt(pending, offer.sid, offer.hints);
	}

	/**
	 * Tries to finish a confirmed sign-up: the subscription gate first, then Gauzy's register path.
	 */
	private async attempt(pending: ZitadelPendingSignup, sid: string | undefined, hints: ZitadelClaimHints): Promise<ZitadelSignupResult> {
		const pendingKey = this.pendingKey(pending.identity);

		// Linked in the meantime (another tab): just sign in.
		const linked = await this.accounts.findLinkedUsers(pending.identity.issuer, pending.identity.subject);
		if (linked.length) {
			await this.store.delete('pending-signup', pendingKey);
			return { type: 'workspaces', response: await this.workspaces.signIn(linked, pending.identity, hints, sid) };
		}

		const check = await this.gate.check(pending.email);
		if (check.allowed === false) {
			const key = this.store.newKey();
			const offer: ZitadelSignupOffer = {
				identity: pending.identity,
				email: pending.email,
				firstName: pending.firstName,
				lastName: pending.lastName,
				sid,
				hints,
				status: 'subscription_required',
				checkoutUrl: check.checkoutUrl
			};
			await this.store.put('signup', key, offer, this.config.settings.confirmTtlSeconds);
			return { type: 'subscription_required', key, checkoutUrl: check.checkoutUrl };
		}

		// Single use: claim the confirmed sign-up before creating anything.
		const claimed = await this.store.take<ZitadelPendingSignup>('pending-signup', pendingKey);
		if (!claimed) {
			throw new GoneException();
		}

		const created = await this.gauzyAuth.register(
			{
				user: { email: claimed.email, firstName: claimed.firstName, lastName: claimed.lastName },
				terms: claimed.terms
			},
			claimed.locale
		);
		await this.accounts.markEmailVerified(created.id);
		const user = await this.accounts.findActiveUser(created.id);
		if (!user) {
			throw new GoneException();
		}
		await this.accounts.link([user], claimed.identity, 'signup');
		await this.events.linked([user], claimed.identity, 'signup');
		this.logger.log('A workspace owner was created through the confirmed Ever ID sign-up.');
		return { type: 'workspaces', response: await this.workspaces.signIn([user], claimed.identity, hints, sid) };
	}

	private pendingKey(identity: ZitadelIdentity): string {
		return this.store.identityKey(identity.issuer, identity.subject);
	}

	private assertEnabled(): void {
		if (!this.config.settings.signupEnabled) {
			throw new NotFoundException();
		}
	}
}

/**
 * Trims a name and bounds its length; empty becomes `undefined`.
 */
function cleanName(value: unknown): string | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}
	const trimmed = value.trim().slice(0, MAX_NAME_LENGTH);
	return trimmed || undefined;
}
