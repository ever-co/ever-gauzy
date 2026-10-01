import { GoneException, HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { OidcValidatedIdToken } from '@gauzy/auth';
import { LanguagesEnum } from '@gauzy/contracts';
import { User } from '@gauzy/core';
import { GAUZY_AUTH, GauzyAuthPort } from '../ports/gauzy-auth.port';
import { ZitadelAccountService, ZitadelIdentity } from './zitadel-account.service';
import { ZitadelClaimHints, ZitadelClaimsService } from './zitadel-claims.service';
import { ZitadelConfigService } from './zitadel-config.service';
import { ZitadelEventsService } from './zitadel-events.service';
import { ZitadelSignupService } from './zitadel-signup.service';
import { ZitadelStoreService } from './zitadel-store.service';
import { ZitadelSigninWorkspaceResponse, ZitadelWorkspaceService } from './zitadel-workspace.service';

/** Wrong one-time codes accepted for one pending confirmation before it is discarded. */
export const MAX_CONFIRM_ATTEMPTS = 5;

/** A one-time record behind `#/auth/ever-id?handoff=…` or the register page prefill. */
export type ZitadelHandoffRecord =
	| { kind: 'workspaces'; response: ZitadelSigninWorkspaceResponse }
	| { kind: 'register'; prefill: { email: string; firstName?: string; lastName?: string } };

/** A pending confirmed link (Gauzy's one-time e-mail code was sent). */
export interface ZitadelConfirmRecord {
	identity: ZitadelIdentity;
	email: string;
	/** A web app path to open after the confirmation (validated when the sign-in started). */
	redirect?: string;
	rowIds: string[];
	sid?: string;
	hints: ZitadelClaimHints;
	attempts: number;
}

/** What a verified sign-in leads to. */
export type ZitadelSigninOutcome =
	| { type: 'workspaces'; response: ZitadelSigninWorkspaceResponse }
	| { type: 'confirm'; key: string }
	| { type: 'signup'; key: string }
	| { type: 'register'; key: string }
	| { type: 'no_workspace' }
	| { type: 'email_unverified' };

/**
 * Decides what an Ever ID sign-in leads to, once the token is verified.
 *
 * 1. The identity is linked: sign in to those workspaces (minus the ones an organization rule blocks).
 * 2. No link, `confirmed` mode (Ever Cloud) and active users own the verified e-mail: Gauzy sends its
 *    own one-time e-mail code; the link is written only after the code is entered.
 * 3. No link, Ever Cloud with the sign-up path on: the person may create a workspace, after an
 *    explicit confirmation (a confirmed sign-up waiting for checkout resumes here).
 * 4. Otherwise nothing is linked and nothing is created: the person is offered Gauzy's register page.
 *
 * An e-mail match alone never links anything, and nothing personal is ever put in a URL.
 */
@Injectable()
export class ZitadelSigninService {
	constructor(
		private readonly config: ZitadelConfigService,
		private readonly accounts: ZitadelAccountService,
		private readonly claims: ZitadelClaimsService,
		private readonly workspaces: ZitadelWorkspaceService,
		private readonly store: ZitadelStoreService,
		private readonly signup: ZitadelSignupService,
		private readonly events: ZitadelEventsService,
		@Inject(GAUZY_AUTH) private readonly gauzyAuth: GauzyAuthPort
	) {}

	/**
	 * Applies the variants to a verified ID token.
	 *
	 * @param idToken - The verified token.
	 * @param channel - `browser` for the callback (stores records for the next page), `token` for the
	 *   server-to-server token route.
	 */
	async decide(idToken: OidcValidatedIdToken, channel: 'browser' | 'token', redirect?: string): Promise<ZitadelSigninOutcome> {
		if (!idToken.emailVerified || !idToken.email) {
			return { type: 'email_unverified' };
		}
		const hints = this.claims.resolve(idToken.claims);
		const identity: ZitadelIdentity = {
			issuer: idToken.issuer,
			subject: idToken.subject,
			email: idToken.email,
			everPersonId: hints.personId
		};
		const settings = this.config.settings;

		const linked = await this.accounts.findLinkedUsers(identity.issuer, identity.subject);
		if (linked.length) {
			return { type: 'workspaces', response: await this.signInLinked(linked, identity, hints, idToken.sid) };
		}

		if (settings.linkMode === 'confirmed') {
			const rows = await this.accounts.findVerifiedUsersByEmail(identity.email);
			if (rows.length) {
				const email = rows[0].email;
				const sameAddress = rows.filter((row) => row.email === email);
				await this.gauzyAuth.sendWorkspaceSigninCode({ email }, this.locale(sameAddress[0]));
				const key = this.store.newKey();
				const record: ZitadelConfirmRecord = {
					identity,
					email,
					rowIds: sameAddress.map((row) => row.id),
					sid: idToken.sid,
					hints,
					redirect,
					attempts: 0
				};
				await this.store.put('confirm', key, record, settings.confirmTtlSeconds);
				return { type: 'confirm', key };
			}
		}

		if (settings.signupEnabled) {
			return this.signup.offer(identity, idToken, hints, redirect);
		}

		if (channel === 'token') {
			return { type: 'no_workspace' };
		}
		const key = this.store.newKey();
		const record: ZitadelHandoffRecord = {
			kind: 'register',
			prefill: { email: identity.email, firstName: idToken.givenName, lastName: idToken.familyName }
		};
		await this.store.put('handoff', key, record, settings.handoffTtlSeconds);
		return { type: 'register', key };
	}

	/** Signs linked users in (see {@link ZitadelWorkspaceService.signIn}). */
	signInLinked(users: User[], identity: ZitadelIdentity, hints: ZitadelClaimHints, sid?: string): Promise<ZitadelSigninWorkspaceResponse> {
		return this.workspaces.signIn(users, identity, hints, sid);
	}

	/** Stores a workspace response under a new one-time key. */
	async handOff(response: ZitadelSigninWorkspaceResponse, redirect?: string): Promise<string> {
		const key = this.store.newKey();
		const record: ZitadelHandoffRecord = { kind: 'workspaces', response: redirect ? { ...response, redirect } : response };
		await this.store.put('handoff', key, record, this.config.settings.handoffTtlSeconds);
		return key;
	}

	/**
	 * Redeems a one-time hand-off key (single use).
	 *
	 * @throws GoneException when the key is unknown, expired or already used.
	 */
	async redeemHandoff(key: string): Promise<ZitadelHandoffRecord> {
		const record = await this.store.take<ZitadelHandoffRecord>('handoff', key);
		if (!record) {
			throw new GoneException();
		}
		return record;
	}

	/**
	 * Completes a confirmed link with Gauzy's one-time e-mail code.
	 *
	 * @throws GoneException for an unknown key or after five wrong codes; UnauthorizedException for a wrong code.
	 */
	async confirm(key: string, code: string): Promise<ZitadelSigninWorkspaceResponse> {
		// Taken (claimed atomically) for the duration of the check, so concurrent tries cannot share an
		// attempt; a failed try puts the record back with the attempt counted.
		const record = await this.store.take<ZitadelConfirmRecord>('confirm', key);
		if (!record || record.attempts >= MAX_CONFIRM_ATTEMPTS) {
			throw new GoneException();
		}

		let proved: string[];
		try {
			const result = await this.gauzyAuth.signinWorkspacesByMagicCode({ email: record.email, code: String(code ?? '') }, false);
			proved = result.workspaces.map((workspace) => workspace.user?.id).filter(Boolean);
		} catch (error) {
			// Gauzy's own rate limit is not a wrong guess: it is passed on and costs no attempt.
			const throttled = error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS;
			if (!throttled) {
				record.attempts += 1;
			}
			if (record.attempts >= MAX_CONFIRM_ATTEMPTS) {
				throw new GoneException();
			}
			await this.store.put('confirm', key, record, this.config.settings.confirmTtlSeconds);
			throw throttled ? error : new UnauthorizedException();
		}

		const rowIds = new Set(record.rowIds);
		const users: User[] = [];
		for (const id of proved.filter((userId) => rowIds.has(userId))) {
			const user = await this.accounts.findActiveUser(id);
			if (user) {
				users.push(user);
			}
		}
		await this.accounts.link(users, record.identity, 'confirmed');
		await this.events.linked(users, record.identity, 'confirmed');
		const response = await this.signInLinked(users, record.identity, record.hints, record.sid);
		return record.redirect ? { ...response, redirect: record.redirect } : response;
	}

	private locale(user?: User): LanguagesEnum {
		const preferred = user?.preferredLanguage as LanguagesEnum;
		return Object.values(LanguagesEnum).includes(preferred) ? preferred : LanguagesEnum.ENGLISH;
	}
}
