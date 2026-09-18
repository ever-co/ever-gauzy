import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { ContactGroup } from './contact-group.entity';
import { ContactGroupService } from './contact-group.service';
import { TypeOrmContactGroupRepository } from './repository/type-orm-contact-group.repository';
import { MikroOrmContactGroupRepository } from './repository/mikro-orm-contact-group.repository';

/**
 * Contact groups: the sets of parties that prices, promotions, shipping and payment eligibility target.
 *
 * **Both ORMs are registered**, because the kernel is dual-ORM: the entity decorators map the table for
 * whichever mapper the deployment runs, and the repository pair is provided here so a service injected
 * with one is resolved from the module that declares its table rather than from whichever module happens
 * to import this one first.
 *
 * **The repositories are exported as well as the service.** A consumer that composes the table itself —
 * a segment evaluator resolving a group by code, a pricing context reading the group's discount — needs
 * the same repository the service writes through, and re-providing it elsewhere would give it a second
 * instance over the same table.
 *
 * **`RolePermissionModule` is imported for the guards rather than for a service.** This module owns no
 * HTTP handler today, but a guard is a provider of whichever module hosts the handler it protects, so
 * the module that will host this domain's controllers and resolvers has to be able to reach the
 * permission lookup those guards ask for.
 */
@Module({
	imports: [TypeOrmModule.forFeature([ContactGroup]), MikroOrmModule.forFeature([ContactGroup]), RolePermissionModule],
	providers: [
		ContactGroupService,
		TypeOrmContactGroupRepository,
		MikroOrmContactGroupRepository
	],
	exports: [ContactGroupService, TypeOrmContactGroupRepository, MikroOrmContactGroupRepository]
})
export class ContactGroupModule {}
