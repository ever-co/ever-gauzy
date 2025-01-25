import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../../user/user.module';
import { RolePermissionModule } from '../../role-permission/role-permission.module';
import { SocialAccountService } from './social-account.service';
import { SocialAccount } from './social-account.entity';
import { TypeOrmSocialAccountRepository } from './repository/type-orm-social-account.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([SocialAccount]),
		MikroOrmModule.forFeature([SocialAccount]),
		UserModule,
		RolePermissionModule
	],
	providers: [SocialAccountService, TypeOrmSocialAccountRepository],
	exports: [SocialAccountService]
})
export class SocialAccountModule {}
