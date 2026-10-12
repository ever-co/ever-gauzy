import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { flagFeatures } from '@gauzy/common';
import { ID } from '@gauzy/contracts';
import { SocialAccount, User } from '@gauzy/core';
import { ZitadelAccount, ZitadelLinkMethod } from '../entities/zitadel-account.entity';
import { ZitadelOrganization } from '../entities/zitadel-organization.entity';

/** A verified identity, as the sign-in and link flows pass it around. */
export interface ZitadelIdentity {
	issuer: string;
	subject: string;
	email?: string;
	everPersonId?: string;
}

/**
 * Data access of the plugin: links, the Gauzy users they point to, and the organization links that
 * carry sign-in rules. Every query names its own tenant / user scope explicitly; nothing relies on an
 * ambient request context (the sign-in routes are public).
 */
@Injectable()
export class ZitadelAccountService {
	constructor(
		@InjectRepository(ZitadelAccount) private readonly accounts: Repository<ZitadelAccount>,
		@InjectRepository(ZitadelOrganization) private readonly organizations: Repository<ZitadelOrganization>,
		@InjectRepository(User) private readonly users: Repository<User>,
		@InjectRepository(SocialAccount) private readonly socialAccounts: Repository<SocialAccount>
	) {}

	/**
	 * Active, non-archived Gauzy users linked to an identity, with their tenant.
	 */
	async findLinkedUsers(issuer: string, subject: string): Promise<User[]> {
		if (!issuer || !subject) {
			return [];
		}
		const links = await this.accounts.find({ where: { issuer, subject }, select: { id: true, userId: true } });
		if (!links.length) {
			return [];
		}
		return this.users.find({
			where: { id: In(links.map((link) => link.userId)), isActive: true, isArchived: false },
			relations: { tenant: true },
			order: { createdAt: 'DESC' }
		});
	}

	/**
	 * Active users whose verified e-mail equals `email` (case-insensitive). Only these may be offered a
	 * confirmed link, and only after Gauzy's own e-mail code proves the mailbox.
	 */
	async findVerifiedUsersByEmail(email: string): Promise<User[]> {
		if (!email) {
			return [];
		}
		return this.users
			.createQueryBuilder('u')
			.leftJoinAndSelect('u.tenant', 'tenant')
			.where('LOWER(u.email) = LOWER(:email)', { email })
			.andWhere('u.emailVerifiedAt IS NOT NULL')
			.andWhere('u.isActive = :active', { active: true })
			.andWhere('u.isArchived = :archived', { archived: false })
			.orderBy('u.createdAt', 'DESC')
			.getMany();
	}

	/**
	 * Other user rows (other tenants) of the same verified e-mail as `user`, not yet linked to the identity.
	 */
	async findSiblings(user: Pick<User, 'id' | 'email'>, identity: ZitadelIdentity): Promise<User[]> {
		const rows = await this.findVerifiedUsersByEmail(user.email);
		const linked = new Set((await this.findLinkedUsers(identity.issuer, identity.subject)).map((row) => row.id));
		// Only accounts stored with exactly the same address: Gauzy's one-time code, which proves them,
		// is matched against the stored address as written.
		return rows.filter((row) => row.id !== user.id && row.email === user.email && !linked.has(row.id));
	}

	/**
	 * Loads one user with its tenant (active and not archived).
	 */
	async findActiveUser(userId: ID): Promise<User | null> {
		if (!userId) {
			return null;
		}
		return this.users.findOne({ where: { id: userId, isActive: true, isArchived: false }, relations: { tenant: true } });
	}

	/**
	 * Links an identity to each user. An existing link is left as it is.
	 *
	 * @returns The ids of the users that are linked after the call.
	 */
	async link(users: Array<Pick<User, 'id' | 'tenantId'>>, identity: ZitadelIdentity, method: ZitadelLinkMethod): Promise<ID[]> {
		if (!users.length) {
			return [];
		}
		const now = new Date();
		await this.accounts
			.createQueryBuilder()
			.insert()
			.into(ZitadelAccount)
			.values(
				users.map((user) => ({
					issuer: identity.issuer,
					subject: identity.subject,
					userId: user.id,
					tenantId: user.tenantId ?? null,
					everPersonId: identity.everPersonId ?? null,
					emailAtLink: identity.email ?? null,
					linkMethod: method,
					linkedAt: now
				}))
			)
			.orIgnore()
			.execute();
		return users.map((user) => user.id);
	}

	/** The identities linked to one user, newest first. */
	async listForUser(userId: ID): Promise<ZitadelAccount[]> {
		return this.accounts.find({ where: { userId }, order: { linkedAt: 'DESC' } });
	}

	/** A link that belongs to `userId`, or `null`. */
	async findOwnLink(id: ID, userId: ID): Promise<ZitadelAccount | null> {
		if (!id || !userId) {
			return null;
		}
		return this.accounts.findOne({ where: { id, userId } });
	}

	async removeLink(link: ZitadelAccount): Promise<void> {
		await this.accounts.delete({ id: link.id, userId: link.userId });
	}

	/** Records an Ever ID sign-in on the links of the given users. */
	async touchLastLogin(identity: ZitadelIdentity, userIds: ID[]): Promise<void> {
		if (!userIds.length) {
			return;
		}
		await this.accounts.update(
			{ issuer: identity.issuer, subject: identity.subject, userId: In(userIds) },
			{ lastLoginAt: new Date() }
		);
	}

	/** Keeps the tenant of a link in step after a tenant-less user created a workspace. */
	async syncTenant(identity: ZitadelIdentity, user: Pick<User, 'id' | 'tenantId'>): Promise<void> {
		if (!user.tenantId) {
			return;
		}
		await this.accounts.update(
			{ issuer: identity.issuer, subject: identity.subject, userId: user.id, tenantId: IsNull() },
			{ tenantId: user.tenantId }
		);
	}

	/** Organization links of the given tenants (sign-in rules). */
	async organizationLinks(tenantIds: ID[]): Promise<ZitadelOrganization[]> {
		const ids = tenantIds.filter(Boolean);
		if (!ids.length) {
			return [];
		}
		return this.organizations.find({ where: { tenantId: In(ids) } });
	}

	/**
	 * Whether the user could still sign in without Ever ID: a password, Gauzy's e-mail code (verified
	 * address and the feature on), or a social account.
	 */
	async hasOtherSignInMethod(userId: ID): Promise<boolean> {
		const user = await this.users
			.createQueryBuilder('u')
			.select(['u.id', 'u.hash', 'u.emailVerifiedAt'])
			.where('u.id = :userId', { userId })
			.getOne();
		if (!user) {
			return false;
		}
		if (user.hash) {
			return true;
		}
		if (user.emailVerifiedAt && flagFeatures.FEATURE_MAGIC_LOGIN) {
			return true;
		}
		// Only links Gauzy still accepts for sign-in count.
		const activeSocialLinks = await this.socialAccounts.count({
			where: { userId, isActive: true, isArchived: false, providerAccountId: Not(IsNull()) }
		});
		return activeSocialLinks > 0;
	}

	/** Marks a freshly registered user's e-mail as verified (the identity provider verified it). */
	async markEmailVerified(userId: ID): Promise<void> {
		await this.users.update({ id: userId, emailVerifiedAt: IsNull() }, { emailVerifiedAt: new Date() });
	}
}
