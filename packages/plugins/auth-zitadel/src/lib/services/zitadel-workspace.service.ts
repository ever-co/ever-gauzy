import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { environment } from '@gauzy/config';
import { ID, ITenant, IUser, IUserSigninWorkspaceResponse, IWorkspaceResponse } from '@gauzy/contracts';
import { TokenPurposeEnum, User, signPurposeToken } from '@gauzy/core';
import { ZitadelAccountService, ZitadelIdentity } from './zitadel-account.service';
import { ZitadelClaimHints } from './zitadel-claims.service';
import { ZitadelSessionService } from './zitadel-session.service';

/** A workspace the identity is linked to but may not enter with this sign-in, and why. */
export interface ZitadelBlockedWorkspace {
	tenantId: ID | null;
	tenantName: string;
	reason: string;
}

/** The workspace response of an Ever ID sign-in: Gauzy's own shape plus the blocked list. */
export interface ZitadelSigninWorkspaceResponse extends IUserSigninWorkspaceResponse {
	blocked_workspaces: ZitadelBlockedWorkspace[];
	/** A client path to open after signing in (validated when the sign-in started). */
	redirect?: string;
}

/**
 * Builds the workspace list of an Ever ID sign-in.
 *
 * Each workspace carries the same short-lived, purpose-bound workspace sign-in token the e-mail code
 * flow issues, so the unchanged `POST /api/auth/signin.workspace` turns it into Gauzy's own access and
 * refresh tokens. The plugin never mints an access token itself.
 */
@Injectable()
export class ZitadelWorkspaceService {
	constructor(
		private readonly accounts: ZitadelAccountService,
		private readonly sessions: ZitadelSessionService
	) {}

	/**
	 * Signs linked users in: builds the workspace response, records the last sign-in on the links and
	 * remembers the identity provider session for back-channel logout.
	 */
	async signIn(users: User[], identity: ZitadelIdentity, hints: ZitadelClaimHints, sid?: string): Promise<ZitadelSigninWorkspaceResponse> {
		const response = await this.build(users, hints);
		const allowed = new Set(response.workspaces.map((workspace) => workspace.user.id));
		await this.accounts.touchLastLogin(identity, [...allowed]);
		await this.sessions.record(
			sid,
			users.filter((user) => allowed.has(user.id))
		);
		return response;
	}

	/**
	 * Splits linked users into enterable and blocked workspaces according to the organization sign-in
	 * rules, and issues the workspace tokens.
	 *
	 * @param users - Active users linked to the identity.
	 * @param hints - The token's platform hints.
	 * @returns The response.
	 */
	async build(users: User[], hints: ZitadelClaimHints): Promise<ZitadelSigninWorkspaceResponse> {
		const blocked = await this.blockedTenants(users, hints);
		const allowed = users.filter((user) => !blocked.has(user.tenantId ?? ''));
		const blockedWorkspaces: ZitadelBlockedWorkspace[] = users
			.filter((user) => blocked.has(user.tenantId ?? ''))
			.map((user) => ({
				tenantId: user.tenantId ?? null,
				tenantName: user.tenant?.name ?? '',
				reason: blocked.get(user.tenantId ?? '') ?? 'blocked'
			}));
		return { ...this.workspaces(allowed), blocked_workspaces: blockedWorkspaces };
	}

	/**
	 * Issues workspace tokens for users whose sign-in was already decided (a confirmed link, a new
	 * account).
	 */
	workspaces(users: User[]): IUserSigninWorkspaceResponse {
		const workspaces = users.map((user) => this.workspace(user));
		return {
			workspaces,
			confirmed_email: users[0]?.email ?? '',
			show_popup: workspaces.length > 1,
			total_workspaces: workspaces.length
		};
	}

	private workspace(user: User): IWorkspaceResponse {
		const tenantId = user.tenant ? user.tenantId : null;
		const token = signPurposeToken(
			TokenPurposeEnum.WORKSPACE_SIGNIN,
			{
				userId: user.id,
				email: user.email,
				tenantId,
				// Shape parity with the e-mail code flow; the signed token itself is the proof.
				code: randomBytes(16).toString('hex')
			},
			{ expiresIn: `${environment.JWT_TOKEN_EXPIRATION_TIME}s` }
		);
		// Plain data, not entity instances: the response may be kept in the hand-off store as JSON, and an
		// entity's own `toJSON` (added by the ORM at runtime) would drop fields on the way. The fields are
		// the ones Gauzy's e-mail code flow returns for a workspace.
		const workspaceUser: Partial<IUser> = {
			id: user.id,
			email: user.email || null,
			name: user.name || null,
			imageUrl: user.imageUrl || null,
			lastTeamId: user.lastTeamId || null,
			lastLoginAt: user.lastLoginAt || null,
			tenant: user.tenant
				? ({ id: user.tenant.id, name: user.tenant.name || '', logo: user.tenant.logo || '' } as ITenant)
				: null
		};
		return { token, user: workspaceUser as IUser };
	}

	/**
	 * Tenants an Ever ID sign-in may not enter: one linked to an organization the token filtered out,
	 * or one whose organization requires its company sign-in and this is not it.
	 */
	private async blockedTenants(users: User[], hints: ZitadelClaimHints): Promise<Map<string, string>> {
		const blocked = new Map<string, string>();
		const links = await this.accounts.organizationLinks(users.map((user) => user.tenantId));
		if (!links.length) {
			return blocked;
		}
		const filtered = new Map(hints.filteredOrganizations.map((org) => [org.id, org.reason || 'filtered']));
		for (const link of links) {
			if (!link.tenantId) {
				continue;
			}
			if (filtered.has(link.everOrgId)) {
				blocked.set(link.tenantId, filtered.get(link.everOrgId));
			} else if (
				link.ssoEnforced &&
				!(hints.identityKind === 'enterprise' && hints.enterpriseOrgId === link.everOrgId)
			) {
				blocked.set(link.tenantId, 'sso_enforced');
			}
		}
		return blocked;
	}
}
