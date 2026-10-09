import { GoneException, HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { OidcValidatedIdToken } from '@gauzy/auth';
import { IAppIntegrationConfig } from '@gauzy/common';
import { ID, IUserSigninWorkspaceResponse, LanguagesEnum } from '@gauzy/contracts';
import { User } from '@gauzy/core';
import { handoffBusy } from '../http/zitadel-retry';
import { GAUZY_AUTH, GauzyAuthPort } from '../ports/gauzy-auth.port';
import { ZitadelAccountService, ZitadelIdentity } from './zitadel-account.service';
import { ZitadelClaimHints, ZitadelClaimsService } from './zitadel-claims.service';
import { ZitadelConfigService } from './zitadel-config.service';
import { ZitadelEventsService } from './zitadel-events.service';
import { ZitadelSignupService } from './zitadel-signup.service';
import { ZitadelStoreService } from './zitadel-store.service';
import { ZitadelSigninWorkspaceResponse, ZitadelTeamList, ZitadelWorkspaceService } from './zitadel-workspace.service';

/** Wrong one-time codes accepted for one pending confirmation before it is discarded. */
export const MAX_CONFIRM_ATTEMPTS = 5;

/** The team list Gauzy returned for each workspace of a code check (`current_teams`), by user id. */
function teamListsByUser(checked: IUserSigninWorkspaceResponse): Map<ID, ZitadelTeamList> {
	const teams = new Map<ID, ZitadelTeamList>();
	for (const workspace of checked.workspaces) {
		const list = (workspace as { current_teams?: unknown }).current_teams;
		if (workspace.user?.id && Array.isArray(list)) {
			teams.set(workspace.user.id, list);
		}
	}
	return teams;
}

/** Where a sign-in came from: the browser callback, or another first-party app's server (token route). */
export type ZitadelSigninChannel = 'browser' | 'token';

/**
 * How the requesting first-party app presents itself in Gauzy's one-time code e-mail. Only display
 * fields: a link that would carry the code is never taken from a request.
 */
export type ZitadelEmailBranding = Partial<
	Pick<IAppIntegrationConfig, 'appName' | 'appLogo' | 'appSignature' | 'appLink' | 'companyName' | 'companyLink'>
>;

/** Options of {@link ZitadelSigninService.decide}. */
export interface ZitadelDecideOptions {
	/** A web app path to open after signing in (browser channel, validated when the sign-in started). */
	redirect?: string;
	/** Branding of the requesting app for Gauzy's one-time code e-mail (token channel). */
	branding?: ZitadelEmailBranding;
}

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
	/** The token route's answers carry each workspace's team list (absent: browser, or an older record). */
	channel?: ZitadelSigninChannel;
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
 *    A confirmed sign-up whose account Gauzy already created (and that a failed step left unlinked)
 *    is finished here as well.
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
	 * @param options - The browser's return path, the requesting app's e-mail branding.
	 */
	async decide(idToken: OidcValidatedIdToken, channel: ZitadelSigninChannel, options: ZitadelDecideOptions = {}): Promise<ZitadelSigninOutcome> {
		if (!idToken.emailVerified || !idToken.email) {
			return { type: 'email_unverified' };
		}
		const { redirect } = options;
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

		if (settings.signupEnabled) {
			// The account of a confirmed sign-up exists already: finish it (link and sign in), no code.
			const finished = await this.signup.finishCreatedAccount(identity, idToken.sid, hints);
			if (finished) {
				return finished;
			}
		}

		if (settings.linkMode === 'confirmed') {
			const rows = await this.accounts.findVerifiedUsersByEmail(identity.email);
			if (rows.length) {
				const email = rows[0].email;
				const sameAddress = rows.filter((row) => row.email === email);
				await this.gauzyAuth.sendWorkspaceSigninCode({ ...options.branding, email }, this.locale(sameAddress[0]));
				const key = this.store.newKey();
				const record: ZitadelConfirmRecord = {
					identity,
					email,
					rowIds: sameAddress.map((row) => row.id),
					sid: idToken.sid,
					hints,
					redirect,
					attempts: 0,
					channel
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
	signInLinked(
		users: User[],
		identity: ZitadelIdentity,
		hints: ZitadelClaimHints,
		sid?: string,
		teams?: Map<ID, ZitadelTeamList>
	): Promise<ZitadelSigninWorkspaceResponse> {
		return this.workspaces.signIn(users, identity, hints, sid, teams);
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
	 * @throws 409 `handoff_busy` while another attempt checks a code for this key (the key stays
	 *   valid); GoneException for an unknown key or after five wrong codes; UnauthorizedException for
	 *   a wrong code.
	 */
	async confirm(key: string, code: string): Promise<ZitadelSigninWorkspaceResponse> {
		const hold = await this.store.hold('confirm', key);
		if (!hold) {
			throw handoffBusy();
		}
		try {
			return await this.confirmHeld(key, code);
		} finally {
			await this.store.release('confirm', key, hold);
		}
	}

	/** {@link confirm} while this attempt holds the key. */
	private async confirmHeld(key: string, code: string): Promise<ZitadelSigninWorkspaceResponse> {
		// Taken (claimed atomically) for the duration of the check, so concurrent tries cannot share an
		// attempt; a failed try puts the record back with the attempt counted.
		const record = await this.store.take<ZitadelConfirmRecord>('confirm', key);
		if (!record || record.attempts >= MAX_CONFIRM_ATTEMPTS) {
			throw new GoneException();
		}

		// For the token route, Gauzy's own code check also returns each workspace's team list (as its
		// e-mail code sign-in does for the same client), so no extra lookup is made here.
		const includeTeams = record.channel === 'token';
		let checked: IUserSigninWorkspaceResponse;
		try {
			checked = await this.gauzyAuth.signinWorkspacesByMagicCode({ email: record.email, code: String(code ?? '') }, includeTeams);
		} catch (error) {
			throw await this.failedCodeCheck(key, record, error);
		}

		const rowIds = new Set(record.rowIds);
		const proved = checked.workspaces.map((workspace) => workspace.user?.id).filter((userId) => rowIds.has(userId));
		const users: User[] = [];
		for (const id of proved) {
			const user = await this.accounts.findActiveUser(id);
			if (user) {
				users.push(user);
			}
		}
		await this.accounts.link(users, record.identity, 'confirmed');
		await this.events.linked(users, record.identity, 'confirmed');
		const teams = includeTeams ? teamListsByUser(checked) : undefined;
		const response = await this.signInLinked(users, record.identity, record.hints, record.sid, teams);
		return record.redirect ? { ...response, redirect: record.redirect } : response;
	}

	/**
	 * Counts a failed code check (Gauzy's own rate limit is not a wrong guess: it is passed on and costs
	 * no attempt), puts the record back unless the attempts are used up, and returns what to answer.
	 */
	private async failedCodeCheck(key: string, record: ZitadelConfirmRecord, error: unknown): Promise<HttpException> {
		const throttled = error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS;
		if (!throttled) {
			record.attempts += 1;
		}
		if (record.attempts >= MAX_CONFIRM_ATTEMPTS) {
			return new GoneException();
		}
		await this.store.put('confirm', key, record, this.config.settings.confirmTtlSeconds);
		return throttled ? (error as HttpException) : new UnauthorizedException();
	}

	private locale(user?: User): LanguagesEnum {
		const preferred = user?.preferredLanguage as LanguagesEnum;
		return Object.values(LanguagesEnum).includes(preferred) ? preferred : LanguagesEnum.ENGLISH;
	}
}
