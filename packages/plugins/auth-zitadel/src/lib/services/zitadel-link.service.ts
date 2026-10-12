import {
	ConflictException,
	GoneException,
	Inject,
	Injectable,
	NotFoundException,
	UnauthorizedException
} from '@nestjs/common';
import { OidcValidatedIdToken } from '@gauzy/auth';
import { ID, LanguagesEnum } from '@gauzy/contracts';
import { User } from '@gauzy/core';
import { ZitadelAccount } from '../entities/zitadel-account.entity';
import { GAUZY_AUTH, GauzyAuthPort } from '../ports/gauzy-auth.port';
import { ZitadelAccountService, ZitadelIdentity } from './zitadel-account.service';
import { ZitadelConfigService } from './zitadel-config.service';
import { ZitadelEventsService } from './zitadel-events.service';
import { ZitadelStoreService } from './zitadel-store.service';

/** A link start ticket is valid this long, seconds. */
export const LINK_TICKET_TTL_SECONDS = 60;

/** The Ever ID authentication used to link must be at most this old, seconds. */
export const LINK_MAX_AUTH_AGE_SECONDS = 300;

/** Clock skew allowed on top of {@link LINK_MAX_AUTH_AGE_SECONDS}, seconds. */
export const LINK_AUTH_AGE_SKEW_SECONDS = 60;

/** A link waiting for the signed-in person's confirmation. */
export interface ZitadelPendingLink {
	userId: ID;
	identity: ZitadelIdentity;
}

/** What the confirmation screen shows. */
export interface ZitadelLinkPreview {
	everIdEmail: string;
	accountEmail: string;
	/** Same-address accounts in other workspaces that may also be linked, each with Gauzy's own code. */
	siblings: Array<{ userId: ID; tenantName: string }>;
}

/** A linked identity as the settings page lists it. */
export interface ZitadelIdentitySummary {
	id: ID;
	issuer: string;
	subjectMasked: string;
	emailAtLink?: string;
	linkMethod: string;
	linkedAt: Date;
	lastLoginAt?: Date;
}

/**
 * Explicit linking from Settings, the only way a self-hosted install links an Ever ID to an existing
 * account.
 *
 * The signed-in person starts it, signs in to Ever ID again (a fresh authentication, at most 300 s
 * old, with a verified e-mail) and confirms on a screen that shows both addresses. Accounts with the
 * same address in other workspaces are linked only when ticked and proved with Gauzy's own one-time
 * e-mail code.
 */
@Injectable()
export class ZitadelLinkService {
	constructor(
		private readonly config: ZitadelConfigService,
		private readonly accounts: ZitadelAccountService,
		private readonly store: ZitadelStoreService,
		private readonly events: ZitadelEventsService,
		@Inject(GAUZY_AUTH) private readonly gauzyAuth: GauzyAuthPort
	) {}

	/**
	 * Creates a one-time ticket that lets the browser start the link flow by navigation.
	 *
	 * @returns The URL the browser opens.
	 */
	async createTicket(userId: ID): Promise<string> {
		if (!(await this.config.isConfigured())) {
			throw new NotFoundException();
		}
		const key = this.store.newKey();
		await this.store.put('link-ticket', key, { userId }, LINK_TICKET_TTL_SECONDS);
		return `${this.config.settings.apiBaseUrl}/api/auth/zitadel/link/start?ticket=${key}`;
	}

	/** Redeems a link ticket (single use) and returns the user it was issued to. */
	async redeemTicket(ticket: string): Promise<ID> {
		const record = await this.store.take<{ userId: ID }>('link-ticket', ticket);
		if (!record?.userId) {
			throw new GoneException();
		}
		return record.userId;
	}

	/**
	 * Handles the callback of a link flow.
	 *
	 * @returns The settings page URL to redirect to (with an opaque key or an error code, nothing else).
	 */
	async callback(userId: ID, idToken: OidcValidatedIdToken): Promise<string> {
		if (!idToken.emailVerified || !idToken.email) {
			return this.settingsUrl('error=email_unverified');
		}
		const now = Math.floor(Date.now() / 1000);
		const authTime = idToken.authTime;
		const fresh =
			!!authTime &&
			authTime <= now + LINK_AUTH_AGE_SKEW_SECONDS &&
			now - authTime <= LINK_MAX_AUTH_AGE_SECONDS + LINK_AUTH_AGE_SKEW_SECONDS;
		if (!fresh) {
			return this.settingsUrl('error=reauth_required');
		}
		const user = await this.accounts.findActiveUser(userId);
		if (!user) {
			return this.settingsUrl('error=link_failed');
		}
		const key = this.store.newKey();
		const pending: ZitadelPendingLink = {
			userId,
			identity: {
				issuer: idToken.issuer,
				subject: idToken.subject,
				email: idToken.email,
				everPersonId: typeof idToken.claims['urn:ever:person_id'] === 'string' ? (idToken.claims['urn:ever:person_id'] as string) : undefined
			}
		};
		await this.store.put('link', key, pending, this.config.settings.confirmTtlSeconds);
		return this.settingsUrl(`linked=${key}`);
	}

	/** What the confirmation screen shows. */
	async preview(key: string, userId: ID): Promise<ZitadelLinkPreview> {
		const { pending, user } = await this.pendingFor(key, userId);
		const siblings = await this.accounts.findSiblings(user, pending.identity);
		return {
			everIdEmail: pending.identity.email ?? '',
			accountEmail: user.email,
			siblings: siblings.map((sibling) => ({ userId: sibling.id, tenantName: sibling.tenant?.name ?? '' }))
		};
	}

	/**
	 * Confirms a link. Links the signed-in account; ticked same-address accounts are linked only with
	 * Gauzy's one-time e-mail code (the first call without a code sends it and answers `code_required`).
	 */
	async confirm(
		key: string,
		userId: ID,
		rows: ID[] = [],
		code?: string
	): Promise<{ linked: ID[] } | { code_required: true }> {
		const { pending, user } = await this.pendingFor(key, userId);

		const existing = await this.accounts.listForUser(user.id);
		if (existing.some((link) => link.issuer === pending.identity.issuer && link.subject !== pending.identity.subject)) {
			throw new ConflictException({ code: 'already_linked', message: 'This account is already connected to another Ever ID.' });
		}

		const eligible = new Map((await this.accounts.findSiblings(user, pending.identity)).map((sibling) => [sibling.id, sibling]));
		const selected = (Array.isArray(rows) ? rows : []).filter((id) => eligible.has(id));

		const proven: User[] = [];
		if (selected.length) {
			if (!code) {
				await this.gauzyAuth.sendWorkspaceSigninCode({ email: user.email }, LanguagesEnum.ENGLISH);
				return { code_required: true };
			}
			let proved: Set<ID>;
			try {
				const result = await this.gauzyAuth.signinWorkspacesByMagicCode({ email: user.email, code: String(code) }, false);
				proved = new Set(result.workspaces.map((workspace) => workspace.user?.id).filter(Boolean));
			} catch {
				throw new UnauthorizedException();
			}
			for (const id of selected) {
				if (proved.has(id)) {
					proven.push(eligible.get(id));
				}
			}
		}

		const users = [user, ...proven];
		await this.accounts.link(users, pending.identity, 'explicit');
		await this.store.delete('link', key);
		await this.events.linked(users, pending.identity, 'explicit');
		return { linked: users.map((linkedUser) => linkedUser.id) };
	}

	/** The identities linked to the signed-in account. */
	async list(userId: ID): Promise<ZitadelIdentitySummary[]> {
		return (await this.accounts.listForUser(userId)).map((link) => summarize(link));
	}

	/**
	 * Removes one of the signed-in account's links, unless it is the account's last way to sign in.
	 */
	async unlink(id: ID, userId: ID): Promise<void> {
		const link = await this.accounts.findOwnLink(id, userId);
		if (!link) {
			throw new NotFoundException();
		}
		const others = (await this.accounts.listForUser(userId)).filter((other) => other.id !== link.id);
		if (!others.length && !(await this.accounts.hasOtherSignInMethod(userId))) {
			throw new ConflictException({ code: 'last_signin_method', message: 'This is the last way to sign in to this account.' });
		}
		const user = await this.accounts.findActiveUser(userId);
		await this.accounts.removeLink(link);
		if (user) {
			await this.events.unlinked(user, { issuer: link.issuer, subject: link.subject, everPersonId: link.everPersonId });
		}
	}

	private async pendingFor(key: string, userId: ID): Promise<{ pending: ZitadelPendingLink; user: User }> {
		const pending = await this.store.get<ZitadelPendingLink>('link', key);
		if (!pending || pending.userId !== userId) {
			throw new GoneException();
		}
		const user = await this.accounts.findActiveUser(userId);
		if (!user) {
			throw new GoneException();
		}
		return { pending, user };
	}

	private settingsUrl(query: string): string {
		return `${this.config.settings.clientBaseUrl}/#/pages/settings/connected-identities?${query}`;
	}
}

/** Shows only the last four characters of a subject. */
export function maskSubject(subject: string): string {
	const value = String(subject ?? '');
	return value.length <= 4 ? '••••' : `••••${value.slice(-4)}`;
}

function summarize(link: ZitadelAccount): ZitadelIdentitySummary {
	return {
		id: link.id,
		issuer: link.issuer,
		subjectMasked: maskSubject(link.subject),
		emailAtLink: link.emailAtLink ?? undefined,
		linkMethod: link.linkMethod,
		linkedAt: link.linkedAt,
		lastLoginAt: link.lastLoginAt ?? undefined
	};
}
