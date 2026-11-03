import { Injectable } from '@nestjs/common';
import { OidcValidatedIdToken } from '@gauzy/auth';
import { PROVISION_KEY_SHAPE, ZitadelHandoffReaderPort, ZitadelProvisionHandoff } from '../ports/handoff-reader.port';
import { ZitadelAccountService } from './zitadel-account.service';
import { ZitadelClaimHints, ZitadelClaimsService } from './zitadel-claims.service';
import { ZitadelConfigService } from './zitadel-config.service';
import { ZitadelSigninService } from './zitadel-signin.service';
import { ZitadelStoreService } from './zitadel-store.service';
import { ZitadelWorkspaceService } from './zitadel-workspace.service';

/** The store namespace of the "create your workspace" hand-offs. */
const NAMESPACE = 'provision';

/** What is kept under a hand-off key: the verified identity, never the token. */
interface StoredProvisionHandoff extends ZitadelProvisionHandoff {
	/** The identity provider session, so a back-channel logout reaches the session it opens. */
	sid?: string;
	hints: ZitadelClaimHints;
}

/** Whether `value` has the shape of a provisioning key. */
export function isProvisionKey(value: unknown): value is string {
	return typeof value === 'string' && PROVISION_KEY_SHAPE.test(value);
}

/**
 * The hand-off of a sign-in started to confirm a workspace Ever Platform asked this installation to
 * create (`ZITADEL_HANDOFF_READER`).
 *
 * The callback of such a sign-in links nothing and signs nobody in: it keeps what the verified ID
 * token says about the person (issuer, subject, verified e-mail, names) under a new one-time key, for
 * as long as a confirmation stays open (`ZITADEL_CONFIRM_TTL_S`), and sends the browser to the
 * confirmation page with that key. The ID token itself is never stored or passed on.
 */
@Injectable()
export class ZitadelHandoffService implements ZitadelHandoffReaderPort {
	constructor(
		private readonly config: ZitadelConfigService,
		private readonly store: ZitadelStoreService,
		private readonly claims: ZitadelClaimsService,
		private readonly accounts: ZitadelAccountService,
		private readonly workspaces: ZitadelWorkspaceService,
		private readonly signin: ZitadelSigninService
	) {}

	/**
	 * Keeps the verified identity of a provisioning sign-in under a new one-time key.
	 *
	 * @returns The key, or `null` when the token carries no verified e-mail.
	 */
	async create(idToken: OidcValidatedIdToken, provisionKey: string): Promise<string | null> {
		if (!idToken.emailVerified || !idToken.email || !isProvisionKey(provisionKey)) {
			return null;
		}
		const hints = await this.claims.resolveFor(idToken);
		const record: StoredProvisionHandoff = {
			issuer: idToken.issuer,
			subject: idToken.subject,
			email: idToken.email,
			givenName: idToken.givenName,
			familyName: idToken.familyName,
			provisionKey,
			signedInAt: Date.now(),
			sid: idToken.sid,
			hints
		};
		const key = this.store.newKey();
		await this.store.put(NAMESPACE, key, record, this.config.settings.confirmTtlSeconds);
		return key;
	}

	async peek(handoffKey: string): Promise<ZitadelProvisionHandoff | null> {
		return publicPart(await this.store.get<StoredProvisionHandoff>(NAMESPACE, handoffKey));
	}

	async consume(handoffKey: string): Promise<ZitadelProvisionHandoff | null> {
		return publicPart(await this.store.take<StoredProvisionHandoff>(NAMESPACE, handoffKey));
	}

	/**
	 * Uses the hand-off up and signs its person in to the workspace of `userId`, which must be linked to
	 * that same Ever ID: answers the one-time key of `#/auth/ever-id?handoff=…`.
	 */
	async signIn(handoffKey: string, userId: string): Promise<string | null> {
		const record = await this.store.take<StoredProvisionHandoff>(NAMESPACE, handoffKey);
		if (!record) {
			return null;
		}
		const users = (await this.accounts.findLinkedUsers(record.issuer, record.subject)).filter(
			(user) => user.id === userId
		);
		if (!users.length) {
			return null;
		}
		const identity = {
			issuer: record.issuer,
			subject: record.subject,
			email: record.email,
			everPersonId: record.hints?.personId
		};
		const response = await this.workspaces.signIn(
			users,
			identity,
			record.hints ?? { filteredOrganizations: [] },
			record.sid
		);
		return this.signin.handOff(response);
	}
}

/** The part of a stored hand-off another plugin may read (no session id, no hints). */
function publicPart(record: StoredProvisionHandoff | null): ZitadelProvisionHandoff | null {
	if (!record) {
		return null;
	}
	return {
		issuer: record.issuer,
		subject: record.subject,
		email: record.email,
		givenName: record.givenName,
		familyName: record.familyName,
		provisionKey: record.provisionKey,
		signedInAt: record.signedInAt
	};
}
