import { CqrsModule } from '@nestjs/cqrs';
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { UserOrganizationModule } from '../user-organization/user-organization.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { ContactModule } from '../contact/contact.module';
import { UserModule } from './../user/user.module';
import { CommandHandlers } from './commands/handlers';
import { OrganizationController } from './organization.controller';
import { Organization } from './organization.entity';
import { OrganizationResolver } from './organization.resolver';
import { OrganizationService } from './organization.service';
import { TypeOrmOrganizationRepository } from './repository/type-orm-organization.repository';
import { MikroOrmOrganizationRepository } from './repository/mikro-orm-organization.repository';

/**
 * The organization: the scope every other record on this platform is filed under.
 *
 * `CqrsModule` is re-exported, not merely imported, because the GraphQL view of the same resource
 * dispatches the create and the edit command rather than writing the row itself. A resolver is a
 * provider of whichever module hosts the resolver graph, so the module that hosts it reaches the
 * command bus only if the domain module hands it on — which is also why the service and both
 * repositories are exported.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([Organization]),
		MikroOrmModule.forFeature([Organization]),
		forwardRef(() => RolePermissionModule),
		forwardRef(() => UserOrganizationModule),
		forwardRef(() => UserModule),
		ContactModule,
		CqrsModule
	],
	controllers: [OrganizationController],
	providers: [
		OrganizationService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		OrganizationResolver,
		TypeOrmOrganizationRepository,
		MikroOrmOrganizationRepository,
		...CommandHandlers
	],
	exports: [OrganizationService, CqrsModule, TypeOrmOrganizationRepository, MikroOrmOrganizationRepository]
})
export class OrganizationModule {}
