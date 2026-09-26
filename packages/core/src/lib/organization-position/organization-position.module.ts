import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { OrganizationPosition } from './organization-position.entity';
import { OrganizationPositionController } from './organization-position.controller';
import { OrganizationPositionResolver } from './organization-position.resolver';
import { OrganizationPositionService } from './organization-position.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmOrganizationPositionRepository } from './repository/type-orm-organization-position.repository';
import { MikroOrmOrganizationPositionRepository } from './repository/mikro-orm-organization-position.repository';

/**
 * The job titles an organization files its people under.
 *
 * The resolver is declared here, beside the service it calls, because a resolver is an ordinary Nest
 * provider and can only inject what the module hosting it can reach. The service is exported so the
 * module that hosts the resolver graph receives it through this module's own export rather than
 * reaching into the container.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationPosition]),
		MikroOrmModule.forFeature([OrganizationPosition]),
		RolePermissionModule
	],
	controllers: [OrganizationPositionController],
	providers: [
		OrganizationPositionService,
		// The GraphQL view of the same resource.
		OrganizationPositionResolver,
		TypeOrmOrganizationPositionRepository,
		MikroOrmOrganizationPositionRepository
	],
	exports: [
		OrganizationPositionService,
		TypeOrmOrganizationPositionRepository,
		MikroOrmOrganizationPositionRepository
	]
})
export class OrganizationPositionModule {}
