/**
 * Test-only in-memory stand-ins for the plugin's data access and Gauzy's authentication service.
 * Excluded from the library build.
 */
import { randomUUID } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { IUserSigninWorkspaceResponse } from '@gauzy/contracts';
import { User } from '@gauzy/core';
import { ZitadelAccount, ZitadelLinkMethod } from '../entities/zitadel-account.entity';
import { ZitadelOrganization } from '../entities/zitadel-organization.entity';
import { GauzyAuthPort, ZitadelRegistrationInput } from '../ports/gauzy-auth.port';
import { ZitadelIdentity } from '../services/zitadel-account.service';
import { ZitadelSubscriptionCheck } from '../services/zitadel-subscription-gate.service';

export interface TestUser {
	id: string;
	email: string;
	tenantId: string | null;
	tenantName?: string;
	isActive?: boolean;
	isArchived?: boolean;
	emailVerifiedAt?: Date | null;
	hash?: string | null;
	social?: boolean;
	preferredLanguage?: string;
}

function toUser(row: TestUser): User {
	return new User({
		id: row.id,
		email: row.email,
		tenantId: row.tenantId,
		tenant: row.tenantId ? ({ id: row.tenantId, name: row.tenantName ?? `Tenant ${row.tenantId}` } as never) : null,
		isActive: row.isActive !== false,
		isArchived: row.isArchived === true,
		emailVerifiedAt: row.emailVerifiedAt ?? null,
		preferredLanguage: row.preferredLanguage
	});
}

/** The `ZitadelAccountService` API over arrays. */
export class InMemoryAccounts {
	readonly users: TestUser[] = [];
	readonly links: ZitadelAccount[] = [];
	readonly organizations: ZitadelOrganization[] = [];
	magicLoginEnabled = false;

	addUser(user: Partial<TestUser> & { email: string }): TestUser {
		const row: TestUser = {
			id: randomUUID(),
			tenantId: randomUUID(),
			emailVerifiedAt: new Date(),
			isActive: true,
			isArchived: false,
			...user
		};
		this.users.push(row);
		return row;
	}

	private active(): TestUser[] {
		return this.users.filter((user) => user.isActive !== false && user.isArchived !== true);
	}

	async findLinkedUsers(issuer: string, subject: string): Promise<User[]> {
		const ids = new Set(this.links.filter((link) => link.issuer === issuer && link.subject === subject).map((link) => link.userId));
		return this.active()
			.filter((user) => ids.has(user.id))
			.map(toUser);
	}

	async findVerifiedUsersByEmail(email: string): Promise<User[]> {
		return this.active()
			.filter((user) => user.email.toLowerCase() === String(email).toLowerCase() && !!user.emailVerifiedAt)
			.map(toUser);
	}

	async findSiblings(user: Pick<User, 'id' | 'email'>, identity: ZitadelIdentity): Promise<User[]> {
		const linked = new Set((await this.findLinkedUsers(identity.issuer, identity.subject)).map((row) => row.id));
		return (await this.findVerifiedUsersByEmail(user.email)).filter((row) => row.id !== user.id && !linked.has(row.id));
	}

	async findActiveUser(userId: string): Promise<User | null> {
		const row = this.active().find((user) => user.id === userId);
		return row ? toUser(row) : null;
	}

	async link(users: Array<Pick<User, 'id' | 'tenantId'>>, identity: ZitadelIdentity, method: ZitadelLinkMethod): Promise<string[]> {
		for (const user of users) {
			const exists = this.links.some(
				(link) => link.issuer === identity.issuer && link.subject === identity.subject && link.userId === user.id
			);
			if (!exists) {
				this.links.push(
					Object.assign(new ZitadelAccount(), {
						id: randomUUID(),
						issuer: identity.issuer,
						subject: identity.subject,
						userId: user.id,
						tenantId: user.tenantId ?? null,
						everPersonId: identity.everPersonId ?? null,
						emailAtLink: identity.email ?? null,
						linkMethod: method,
						linkedAt: new Date()
					})
				);
			}
		}
		return users.map((user) => user.id);
	}

	async listForUser(userId: string): Promise<ZitadelAccount[]> {
		return this.links.filter((link) => link.userId === userId);
	}

	async findOwnLink(id: string, userId: string): Promise<ZitadelAccount | null> {
		return this.links.find((link) => link.id === id && link.userId === userId) ?? null;
	}

	async removeLink(link: ZitadelAccount): Promise<void> {
		const index = this.links.findIndex((row) => row.id === link.id);
		if (index >= 0) {
			this.links.splice(index, 1);
		}
	}

	async touchLastLogin(identity: ZitadelIdentity, userIds: string[]): Promise<void> {
		for (const link of this.links) {
			if (link.issuer === identity.issuer && link.subject === identity.subject && userIds.includes(link.userId)) {
				link.lastLoginAt = new Date();
			}
		}
	}

	async syncTenant(): Promise<void> {
		return undefined;
	}

	async organizationLinks(tenantIds: string[]): Promise<ZitadelOrganization[]> {
		return this.organizations.filter((org) => tenantIds.includes(org.tenantId));
	}

	async hasOtherSignInMethod(userId: string): Promise<boolean> {
		const user = this.users.find((row) => row.id === userId);
		return !!user && (!!user.hash || (!!user.emailVerifiedAt && this.magicLoginEnabled) || !!user.social);
	}

	async markEmailVerified(userId: string): Promise<void> {
		const user = this.users.find((row) => row.id === userId);
		if (user && !user.emailVerifiedAt) {
			user.emailVerifiedAt = new Date();
		}
	}
}

/** Gauzy's e-mail code and register path, recorded instead of performed. */
export class FakeGauzyAuth implements GauzyAuthPort {
	readonly sentCodes: string[] = [];
	readonly registered: ZitadelRegistrationInput[] = [];
	/** The code the fake accepts. */
	code = 'ABC123';

	constructor(private readonly accounts: InMemoryAccounts) {}

	async sendWorkspaceSigninCode(input: { email: string }): Promise<void> {
		this.sentCodes.push(input.email);
	}

	async signinWorkspacesByMagicCode(payload: { email: string; code: string }): Promise<IUserSigninWorkspaceResponse> {
		if (payload.code !== this.code) {
			throw new UnauthorizedException();
		}
		const users = this.accounts.users.filter((user) => user.email === payload.email && user.isActive !== false);
		return {
			workspaces: users.map((user) => ({ token: 'gauzy-workspace-token', user: toUser(user) })),
			confirmed_email: payload.email,
			show_popup: users.length > 1,
			total_workspaces: users.length
		};
	}

	async register(input: ZitadelRegistrationInput): Promise<{ id: string; tenantId: string | null }> {
		this.registered.push(input);
		// Gauzy's register path creates a user without a tenant; the tenant comes from onboarding.
		const user = this.accounts.addUser({ email: input.user.email, tenantId: null, emailVerifiedAt: null });
		return { id: user.id, tenantId: null };
	}
}

/** Gauzy's subscription gate, switchable per test. */
export class FakeSubscriptionGate {
	allowed = true;
	readonly checked: string[] = [];

	async check(email: string): Promise<ZitadelSubscriptionCheck> {
		this.checked.push(email);
		return this.allowed ? { allowed: true } : { allowed: false, checkoutUrl: 'https://checkout.example.test/checkout' };
	}
}

/** The platform cache, in memory, honouring TTLs. */
export class InMemoryCache {
	private readonly entries = new Map<string, { value: unknown; expiresAt: number }>();

	async get<T>(key: string): Promise<T | undefined> {
		const entry = this.entries.get(key);
		if (!entry || entry.expiresAt < Date.now()) {
			this.entries.delete(key);
			return undefined;
		}
		return entry.value as T;
	}

	async set<T>(key: string, value: T, ttl?: number): Promise<void> {
		this.entries.set(key, { value, expiresAt: Date.now() + (ttl ?? 60_000) });
	}

	async del(key: string): Promise<void> {
		this.entries.delete(key);
	}

	/** Test hook: expires everything. */
	expireAll(): void {
		for (const entry of this.entries.values()) {
			entry.expiresAt = 0;
		}
	}
}

/** The session service API, in memory. */
export class InMemorySessions {
	readonly recorded: Array<{ sid: string; userId: string }> = [];
	readonly seenJtis = new Set<string>();
	readonly ended: string[] = [];

	async record(sid: string | undefined, users: Array<{ id: string }>): Promise<void> {
		if (sid) {
			for (const user of users) {
				this.recorded.push({ sid, userId: user.id });
			}
		}
	}

	async rememberLogoutJti(jti: string): Promise<boolean> {
		if (this.seenJtis.has(jti)) {
			return false;
		}
		this.seenJtis.add(jti);
		return true;
	}

	async endSessions(sid: string): Promise<number> {
		this.ended.push(sid);
		const before = this.recorded.length;
		for (let i = this.recorded.length - 1; i >= 0; i--) {
			if (this.recorded[i].sid === sid) {
				this.recorded.splice(i, 1);
			}
		}
		return before - this.recorded.length;
	}
}
