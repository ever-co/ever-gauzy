import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { OrganizationAward } from './organization-award.entity';
import { OrganizationAwardController } from './organization-award.controller';
import { OrganizationAwardService } from './organization-award.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmOrganizationAwardRepository } from './repository/type-orm-organization-award.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationAward]),
		MikroOrmModule.forFeature([OrganizationAward]),
		RolePermissionModule
	],
	controllers: [OrganizationAwardController],
	providers: [OrganizationAwardService, TypeOrmOrganizationAwardRepository]
})
export class OrganizationAwardModule {}
