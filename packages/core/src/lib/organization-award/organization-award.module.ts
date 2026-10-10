import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { OrganizationAward } from './organization-award.entity';
import { OrganizationAwardController } from './organization-award.controller';
import { OrganizationAwardResolver } from './organization-award.resolver';
import { OrganizationAwardService } from './organization-award.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmOrganizationAwardRepository } from './repository/type-orm-organization-award.repository';
import { MikroOrmOrganizationAwardRepository } from './repository/mikro-orm-organization-award.repository';

/**
 * The awards an organization records about itself.
 *
 * The resolver is declared here, beside the service it calls, because a resolver is an ordinary Nest
 * provider and can only inject what the module hosting it can reach. The service is exported so the
 * module that hosts the resolver graph receives it through this module's own export rather than
 * reaching into the container.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationAward]),
		MikroOrmModule.forFeature([OrganizationAward]),
		RolePermissionModule
	],
	controllers: [OrganizationAwardController],
	providers: [
		OrganizationAwardService,
		// The GraphQL view of the same resource.
		OrganizationAwardResolver,
		TypeOrmOrganizationAwardRepository,
		MikroOrmOrganizationAwardRepository
	],
	exports: [OrganizationAwardService, TypeOrmOrganizationAwardRepository, MikroOrmOrganizationAwardRepository]
})
export class OrganizationAwardModule {}
