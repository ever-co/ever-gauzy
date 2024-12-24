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
import { OrganizationService } from './organization.service';
import { TypeOrmOrganizationRepository } from './repository';

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
	providers: [OrganizationService, TypeOrmOrganizationRepository, ...CommandHandlers],
	exports: [TypeOrmModule, MikroOrmModule, OrganizationService, TypeOrmOrganizationRepository]
})
export class OrganizationModule {}
