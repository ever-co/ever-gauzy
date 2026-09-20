import { BadRequestException, Injectable } from '@nestjs/common';
import { DeepPartial } from 'typeorm';
import { ISocialAccount, ISocialAccountBase, IUser, ProviderEnum } from '@gauzy/contracts';
import { UserService } from '../../user/user.service';
import { TenantAwareCrudService } from '../../core/crud';
import { MultiORMEnum } from '../../core/utils';
import { isNonEmptyString } from '../purpose-token';
import { SocialAccount } from './social-account.entity';
import { TypeOrmSocialAccountRepository } from './repository/type-orm-social-account.repository';
import { MikroOrmSocialAccountRepository } from './repository/mikro-orm-social-account.repository';

@Injectable()
export class SocialAccountService extends TenantAwareCrudService<SocialAccount> {
	constructor(
		readonly typeOrmSocialAccountRepository: TypeOrmSocialAccountRepository,
		readonly mikroOrmSocialAccountRepository: MikroOrmSocialAccountRepository,
		private readonly userService: UserService
	) {
		super(typeOrmSocialAccountRepository, mikroOrmSocialAccountRepository);
	}

	/**
	 * Registers a new social account by saving or updating the given entity.
	 * Uses the ORM-agnostic base class save() method.
	 */
	async registerSocialAccount(partialEntity: DeepPartial<ISocialAccount>): Promise<ISocialAccount> {
		try {
			return await this.save(partialEntity as any);
		} catch (error) {
			throw new BadRequestException('Could not create this account');
		}
	}

	/**
	 * Links a provider account to ONE user, in that user's tenant, unless the link already exists.
	 *
	 * The social sign-in routes are public, so there is no request tenant: `save()` would overwrite
	 * the tenant with `undefined` and store a tenant-less link. The tenant is taken from the user.
	 */
	async linkSocialAccountToUser(input: {
		provider: ProviderEnum;
		providerAccountId: string;
		user: IUser;
	}): Promise<ISocialAccount> {
		const { provider, providerAccountId, user } = input;
		if (!provider || !isNonEmptyString(providerAccountId) || !isNonEmptyString(user?.id)) {
			throw new BadRequestException('Could not create this account');
		}

		const tenantId = user.tenantId ?? null;
		const where = { provider, providerAccountId, userId: user.id, tenantId, isActive: true, isArchived: false };

		const existing =
			this.ormType === MultiORMEnum.MikroORM
				? ((await this.mikroOrmRepository.findOne(where as any)) as SocialAccount)
				: await this.typeOrmRepository.findOne({ where });
		if (existing) {
			return existing;
		}

		try {
			return await this.saveWithoutEnrichment({
				provider,
				providerAccountId,
				user: { id: user.id },
				userId: user.id,
				...(tenantId ? { tenant: { id: tenantId } } : {}),
				tenantId
			} as any);
		} catch (error) {
			throw new BadRequestException('Could not create this account');
		}
	}

	/**
	 * Finds a social account by provider and providerAccountId.
	 * Uses ORM switch to support both TypeORM and MikroORM, returning null when not found.
	 */
	async findAccountByProvider(input: ISocialAccountBase): Promise<SocialAccount | null> {
		const { provider, providerAccountId } = input;

		// An empty value would be dropped from the `where` by the ORM and match ANY account of the
		// provider (or any account at all) — GHSA-58x4-7mw9-gmqg.
		if (!provider || !isNonEmptyString(providerAccountId)) {
			return null;
		}

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				return (await this.mikroOrmRepository.findOne(
					{ provider, providerAccountId, isActive: true, isArchived: false },
					{ populate: ['user'] }
				)) as SocialAccount;
			}
			case MultiORMEnum.TypeORM:
				return await this.typeOrmRepository.findOne({
					where: { provider, providerAccountId, isActive: true, isArchived: false },
					relations: { user: true }
				});
			default:
				throw new Error(`Not implemented for ${this.ormType}`);
		}
	}

	async findUserBySocialId(input: ISocialAccountBase): Promise<IUser> {
		try {
			const account = await this.findAccountByProvider(input);
			const user = account?.user;
			if (!user) {
				throw new BadRequestException('The user with this account details does not exists');
			}
			return user;
		} catch (error) {
			throw new BadRequestException('The user with this account details does not exists');
		}
	}

	async signupFindUserByEmail(email: string): Promise<boolean> {
		const user = await this.userService.getUserByEmail(email);
		if (!user) return false;
		return true;
	}
}
