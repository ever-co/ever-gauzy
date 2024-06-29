import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial } from 'typeorm';
import { ISocialAccount, ISocialAccountBase } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../../core/crud';
import { SocialAccount } from './social-account.entity';
import { MicroOrmSocialAccountRepository, TypeOrmSocialAccountRepository } from './repository';
import { User, UserService } from '../../user';

@Injectable()
export class SocialAccountService extends TenantAwareCrudService<SocialAccount> {
	constructor(
		@InjectRepository(SocialAccount) readonly typeOrmSocialAccountRepository: TypeOrmSocialAccountRepository,
		readonly mikroOrmSocialAccountRepository: MicroOrmSocialAccountRepository,
		private readonly userService: UserService
	) {
		super(typeOrmSocialAccountRepository, mikroOrmSocialAccountRepository);
	}

	async registerSocialAccount(partialEntity: DeepPartial<ISocialAccount>): Promise<ISocialAccount> {
		try {
			return await this.typeOrmRepository.save(partialEntity);
		} catch (error) {
			throw new BadRequestException('Could not create this account');
		}
	}

	async findAccountByProvider(input: ISocialAccountBase): Promise<SocialAccount> {
		const { provider, providerAccountId } = input;
		return await this.typeOrmRepository.findOne({
			where: { provider, providerAccountId, isActive: true, isArchived: false },
			relations: {
				user: true
			}
		});
	}

	async findUserBySocialId(input: ISocialAccountBase): Promise<User> {
		try {
			const account = await this.findAccountByProvider(input);
			const user = account?.user;
			if (!user) {
				throw new BadRequestException('The user with this accoubt details does not exists');
			}
			return user;
		} catch (error) {
			throw new BadRequestException('The user with this accoubt details does not exists');
		}
	}

	async signupFindUserByEmail(email: string): Promise<boolean> {
		const user = await this.userService.getUserByEmail(email);
		if (!user) return false;
		return true;
	}
}
