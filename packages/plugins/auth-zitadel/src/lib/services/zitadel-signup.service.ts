import { BadRequestException, GoneException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OidcValidatedIdToken } from '@gauzy/auth';
import { ITermsAcceptanceClaim, ITermsAcceptanceDocument, LanguagesEnum } from '@gauzy/contracts';
import { handoffBusy } from '../http/zitadel-retry';
import { GAUZY_AUTH, GauzyAuthPort } from '../ports/gauzy-auth.port';
import { TERMS_DOCUMENTS, TermsDocumentsPort } from '../ports/terms-documents.port';
import { ZitadelAccountService, ZitadelIdentity } from './zitadel-account.service';
import { ZitadelClaimHints } from './zitadel-claims.service';
import { ZitadelConfigService } from './zitadel-config.service';
import { ZitadelEventsService } from './zitadel-events.service';
import { ZitadelStoreService } from './zitadel-store.service';
import { ZitadelSubscriptionGateService } from './zitadel-subscription-gate.service';
import { ZitadelSigninWorkspaceResponse, ZitadelWorkspaceService } from './zitadel-workspace.service';

/** Longest accepted first or last name. */
const MAX_NAME_LENGTH = 100;

/** The web app's page for a legal document, when it is not named after the document. */
const LEGAL_PAGES: Record<string, string> = { tos: 'terms' };

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
	/** A web app path to open after signing up (validated when the sign-in started). */
	redirect?: string;
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
	redirect?: string;
	/** Set once Gauzy created the account, so a resumed sign-up links it and never registers twice. */
	userId?: string;
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
	/**
	 * The legal documents the sign-up must accept (the ones `POST /signup` checks), each with an
	 * absolute link to the web app's page for it, so a client on another origin can link it too.
	 */
	terms: ITermsAcceptanceDocument[];
}

/**
 * Turns a document link into an absolute URL of the web app (which uses hash routes): `/legal/tos`
 * becomes `<CLIENT_BASE_URL>/#/legal/terms`. An absolute http(s) link is kept as it is.
 *
 * @param url - The document's link as Gauzy publishes it.
 * @param clientBaseUrl - The web app's base URL (no trailing slash).
 * @returns The absolute URL, or `undefined` when there is no usable link.
 */
export function absoluteDocumentUrl(url: string | undefined, clientBaseUrl: string): string | undefined {
	if (!url) {
		return undefined;
	}
	if (/^https?:\/\//i.test(url)) {
		return url;
	}
	if (!url.startsWith('/') || url.startsWith('//')) {
		return undefined;
	}
	const legal = /^\/legal\/([A-Za-z0-9_-]+)$/.exec(url);
	const path = legal ? `/legal/${LEGAL_PAGES[legal[1]] ?? legal[1]}` : url;
	return `${clientBaseUrl}/#${path}`;
}

/**
 * The confirmed sign-up path for people new to Gauzy (Ever Cloud only, `ZITADEL_SIGNUP_ENABLED=true`).
 *
 * Nothing is created until the person confirms "create a workspace with this Ever ID". The account is
 * then made by Gauzy's own register path, behind Gauzy's own subscription gate; without a
 * subscription the confirmed sign-up waits (server-side, keyed to the identity) while the person goes
 * through checkout, and finishes when they sign in with Ever ID again. Silent account creation does
 * not exist.
 *
 * One attempt at a time per key and per Ever ID: a second one meanwhile answers 409 `handoff_busy`
 * (and leaves its key valid), so two tabs can never register two accounts.
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
		@Inject(GAUZY_AUTH) private readonly gauzyAuth: GauzyAuthPort,
		@Inject(TERMS_DOCUMENTS) private readonly termsDocuments: TermsDocumentsPort
	) {}

	/**
	 * Called for a verified identity without a link: resumes a confirmed sign-up waiting for this
	 * identity, or offers the confirmation page.
	 *
	 * @throws 409 `handoff_busy` while another attempt finishes this identity's sign-up.
	 */
	async offer(
		identity: ZitadelIdentity,
		idToken: OidcValidatedIdToken,
		hints: ZitadelClaimHints,
		redirect?: string
	): Promise<{ type: 'workspaces'; response: ZitadelSigninWorkspaceResponse } | { type: 'signup'; key: string }> {
		const pendingKey = this.pendingKey(identity);
		const pending = await this.store.get<ZitadelPendingSignup>('pending-signup', pendingKey);
		if (pending) {
			const result = await this.withIdentityHeld(pendingKey, () => this.attempt(pending, idToken.sid, hints));
			return result.type === 'workspaces' ? result : { type: 'signup', key: result.key };
		}
		const key = this.store.newKey();
		const offer: ZitadelSignupOffer = {
			identity,
			email: identity.email,
			firstName: idToken.givenName,
			lastName: idToken.familyName,
			sid: idToken.sid,
			hints,
			redirect
		};
		await this.store.put('signup', key, offer, this.config.settings.confirmTtlSeconds);
		return { type: 'signup', key };
	}

	/**
	 * Finishes a confirmed sign-up whose account Gauzy already created but that a failed step left
	 * unlinked: links that account and signs in, without a new confirmation or code (the person
	 * confirmed this sign-up with this Ever ID, and the account is the one it created). Returns `null`
	 * when there is no such sign-up; one whose account no longer exists or is inactive is dropped.
	 *
	 * @throws 409 `handoff_busy` while another attempt finishes this identity's sign-up.
	 */
	async finishCreatedAccount(
		identity: ZitadelIdentity,
		sid: string | undefined,
		hints: ZitadelClaimHints
	): Promise<{ type: 'workspaces'; response: ZitadelSigninWorkspaceResponse } | null> {
		const pendingKey = this.pendingKey(identity);
		const pending = await this.store.get<ZitadelPendingSignup>('pending-signup', pendingKey);
		if (!pending?.userId) {
			return null;
		}
		if (!(await this.accounts.findActiveUser(pending.userId))) {
			await this.store.delete('pending-signup', pendingKey);
			return null;
		}
		const result = await this.withIdentityHeld(pendingKey, () => this.attempt(pending, sid, hints));
		return result.type === 'workspaces' ? result : null;
	}

	/**
	 * What the confirmation page shows (the key stays valid), including the documents to accept.
	 *
	 * @throws 409 `handoff_busy` while a sign-up with this key is running; GoneException for an
	 *   unknown, expired or used key.
	 */
	async details(key: string, locale: LanguagesEnum = LanguagesEnum.ENGLISH): Promise<ZitadelSignupDetails> {
		this.assertEnabled();
		const offer = await this.store.get<ZitadelSignupOffer>('signup', key);
		if (!offer) {
			if (await this.store.isHeld('signup', key)) {
				throw handoffBusy();
			}
			throw new GoneException();
		}
		const clientBaseUrl = this.config.settings.clientBaseUrl;
		return {
			email: offer.email,
			firstName: offer.firstName,
			lastName: offer.lastName,
			status: offer.status,
			checkoutUrl: offer.checkoutUrl,
			terms: this.termsDocuments.getRequiredDocuments(locale).map((document) => ({
				...document,
				url: absoluteDocumentUrl(document.url, clientBaseUrl)
			}))
		};
	}

	/**
	 * The person confirmed. Records the confirmed sign-up and runs Gauzy's register path.
	 *
	 * @throws NotFoundException when the sign-up path is off; BadRequestException without the
	 *   confirmation; 409 `handoff_busy` while another attempt uses this key or finishes this
	 *   identity's sign-up (the key stays valid); GoneException for an unknown, expired or used key.
	 */
	async confirm(key: string, body: ZitadelSignupConfirmation, locale: LanguagesEnum): Promise<ZitadelSignupResult> {
		this.assertEnabled();
		if (body?.confirm !== true) {
			throw new BadRequestException('The sign-up must be confirmed.');
		}
		const terms = Array.isArray(body.terms) ? body.terms : [];
		this.assertRequiredTermsAccepted(terms, locale);
		const keyHold = await this.store.hold('signup', key);
		if (!keyHold) {
			throw handoffBusy();
		}
		try {
			const offer = await this.store.take<ZitadelSignupOffer>('signup', key);
			if (!offer) {
				throw new GoneException();
			}
			const pendingKey = this.pendingKey(offer.identity);
			const identityHold = await this.store.hold('pending-signup', pendingKey);
			if (!identityHold) {
				// Another attempt is finishing this identity's sign-up: this key stays usable.
				await this.store.put('signup', key, offer, this.config.settings.confirmTtlSeconds);
				throw handoffBusy();
			}
			try {
				// A sign-up confirmed earlier may have created the account already: it is kept (while it is
				// active), never made twice.
				const earlier = await this.store.get<ZitadelPendingSignup>('pending-signup', pendingKey);
				const createdUserId =
					earlier?.userId && (await this.accounts.findActiveUser(earlier.userId)) ? earlier.userId : undefined;
				const pending: ZitadelPendingSignup = {
					identity: offer.identity,
					email: offer.email,
					firstName: cleanName(body.firstName) ?? cleanName(offer.firstName),
					lastName: cleanName(body.lastName) ?? cleanName(offer.lastName),
					terms: terms.length ? terms : undefined,
					locale,
					confirmedAt: Date.now(),
					redirect: offer.redirect,
					userId: createdUserId
				};
				await this.store.put('pending-signup', pendingKey, pending, this.config.settings.confirmTtlSeconds);
				return await this.attempt(pending, offer.sid, offer.hints);
			} finally {
				await this.store.release('pending-signup', pendingKey, identityHold);
			}
		} finally {
			await this.store.release('signup', key, keyHold);
		}
	}

	/** Runs `task` while this attempt holds the identity's pending sign-up. */
	private async withIdentityHeld<T>(pendingKey: string, task: () => Promise<T>): Promise<T> {
		const hold = await this.store.hold('pending-signup', pendingKey);
		if (!hold) {
			throw handoffBusy();
		}
		try {
			return await task();
		} finally {
			await this.store.release('pending-signup', pendingKey, hold);
		}
	}

	/**
	 * Tries to finish a confirmed sign-up: the subscription gate first, then Gauzy's register path.
	 * Called while the identity's pending sign-up is held.
	 */
	private async attempt(pending: ZitadelPendingSignup, sid: string | undefined, hints: ZitadelClaimHints): Promise<ZitadelSignupResult> {
		const pendingKey = this.pendingKey(pending.identity);

		// Linked in the meantime (another tab): just sign in.
		const linked = await this.accounts.findLinkedUsers(pending.identity.issuer, pending.identity.subject);
		if (linked.length) {
			await this.store.delete('pending-signup', pendingKey);
			return { type: 'workspaces', response: await this.workspaces.signIn(linked, pending.identity, hints, sid) };
		}

		// The gate guards creating an account; once Gauzy created it, only the link is left to write.
		if (!pending.userId) {
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
					checkoutUrl: check.checkoutUrl,
					redirect: pending.redirect
				};
				await this.store.put('signup', key, offer, this.config.settings.confirmTtlSeconds);
				return { type: 'subscription_required', key, checkoutUrl: check.checkoutUrl };
			}
		}

		// Claimed (single use) while the account is created and linked. Should any step fail, the record
		// goes back, so the next Ever ID sign-in resumes where this one stopped; once the account exists
		// it is only linked, never registered a second time.
		const claimed = await this.store.take<ZitadelPendingSignup>('pending-signup', pendingKey);
		if (!claimed) {
			throw new GoneException();
		}
		let userId = claimed.userId;
		try {
			if (!userId) {
				const created = await this.gauzyAuth.register(
					{
						user: { email: claimed.email, firstName: claimed.firstName, lastName: claimed.lastName },
						terms: claimed.terms
					},
					claimed.locale
				);
				userId = created.id;
				await this.accounts.markEmailVerified(userId);
				this.logger.log('A workspace owner was created through the confirmed Ever ID sign-up.');
			}
			const user = await this.accounts.findActiveUser(userId);
			if (!user) {
				throw new GoneException();
			}
			await this.accounts.link([user], claimed.identity, 'signup');
			await this.events.linked([user], claimed.identity, 'signup');
			const response = await this.workspaces.signIn([user], claimed.identity, hints, sid);
			return { type: 'workspaces', response: claimed.redirect ? { ...response, redirect: claimed.redirect } : response };
		} catch (error) {
			await this.store.put('pending-signup', pendingKey, { ...claimed, userId }, this.config.settings.confirmTtlSeconds);
			throw error;
		}
	}

	/**
	 * Every document Gauzy currently requires must be accepted, as the register form requires; the
	 * claims themselves are checked against the published text by Gauzy's register path.
	 *
	 * @throws BadRequestException when a required document is missing.
	 */
	private assertRequiredTermsAccepted(terms: ITermsAcceptanceClaim[], locale: LanguagesEnum): void {
		const required = this.termsDocuments.getRequiredDocuments(locale);
		const missing = required.filter(
			(document) => !terms.some((claim) => claim.documentId === document.documentId && claim.version === document.version)
		);
		if (missing.length) {
			throw new BadRequestException('The required terms must be accepted.');
		}
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
