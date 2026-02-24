import { BadRequestException, Injectable } from '@nestjs/common';
import { DeepPartial } from 'typeorm';
import { ISocialAccount, ISocialAccountBase, IUser } from '@gauzy/contracts';
import { UserService } from '../../user/user.service';
import { TenantAwareCrudService } from '../../core/crud';
import { MultiORMEnum } from '../../core/utils';
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
	 * Finds a social account by provider and providerAccountId.
	 * Uses ORM switch to support both TypeORM and MikroORM, returning null when not found.
	 */
	async findAccountByProvider(input: ISocialAccountBase): Promise<SocialAccount | null> {
		const { provider, providerAccountId } = input;

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
