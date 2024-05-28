import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ISocialAccount, ISocialAccountCreateInput } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../../core/crud';
import { UserService } from '../../user';
import { SocialAccount } from './social-account.entity';
import { MicroOrmSocialAccountRepository, TypeOrmSocialAccountRepository } from './repository';

@Injectable()
export class SocialAccountService extends TenantAwareCrudService<SocialAccount> {
	constructor(
		@InjectRepository(SocialAccount) readonly typeOrmSocialAccountRepository: TypeOrmSocialAccountRepository,
		readonly mikroOrmSocialAccountRepository: MicroOrmSocialAccountRepository,
		private readonly userService: UserService
	) {
		super(typeOrmSocialAccountRepository, mikroOrmSocialAccountRepository);
	}

	async registerSocialAccount(partialEntity: ISocialAccountCreateInput): Promise<ISocialAccount> {
		try {
			return await this.create(partialEntity);
		} catch (error) {
			throw new BadRequestException('Could not create this account');
		}
	}

	async findAccountByProvider(provider: string, providerAccountId: string): Promise<SocialAccount> {
		try {
			return (
				await this.find({
					where: [
						{
							provider,
							providerAccountId
						}
					]
				})
			)[0];
		} catch (error) {
			throw new BadRequestException('This account could not be found');
		}
	}
}
