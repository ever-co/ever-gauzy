import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SocialAccountService } from './social-account.service';
import { RolePermissionModule } from '../../role-permission';
import { SocialAccount } from './social-account.entity';

@Module({
	imports: [
		RouterModule.register([{ path: '/social-account', module: SocialAccountModule }]),
		TypeOrmModule.forFeature([SocialAccount]),
		MikroOrmModule.forFeature([SocialAccount]),
		RolePermissionModule
	],
	providers: [SocialAccountService],
	exports: [TypeOrmModule, MikroOrmModule, SocialAccountService]
})
export class SocialAccountModule {}
