import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ISocialAccount, ISocialAccountCreateInput } from '@gauzy/contracts';
import { TenantAwareCrudService } from '../../core/crud';
import { SocialAccount } from './social-account.entity';
import { MicroOrmSocialAccountRepository, TypeOrmSocialAccountRepository } from './repository';

@Injectable()
export class SocialAccountService extends TenantAwareCrudService<SocialAccount> {
	constructor(
		@InjectRepository(SocialAccount) readonly typeOrmSocialAccountRepository: TypeOrmSocialAccountRepository,
		readonly mikroOrmSocialAccountRepository: MicroOrmSocialAccountRepository
	) {
		super(typeOrmSocialAccountRepository, mikroOrmSocialAccountRepository);
	}

	async registerSocialAccount(partialEntity: ISocialAccountCreateInput): Promise<ISocialAccount> {
		console.log({ partialEntity });
		try {
			return await this.save(partialEntity);
		} catch (error) {
			throw new BadRequestException('Could not create this account');
		}
	}

	async findAccountByProvider(provider: string, providerAccountId: string): Promise<SocialAccount> {
		return await this.typeOrmRepository.findOne({
			where: { provider, providerAccountId, isActive: true, isArchived: false }
		});
	}
}
