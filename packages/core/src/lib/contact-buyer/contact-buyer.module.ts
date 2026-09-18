import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { OrganizationContact } from '../organization-contact/organization-contact.entity';
import { ContactBuyer } from './contact-buyer.entity';
import { ContactBuyerService } from './contact-buyer.service';
import { ContactBuyerController } from './contact-buyer.controller';
import { ContactBuyerResolver } from './contact-buyer.resolver';
import { TypeOrmContactBuyerRepository } from './repository/type-orm-contact-buyer.repository';
import { MikroOrmContactBuyerRepository } from './repository/mikro-orm-contact-buyer.repository';

/**
 * Company-account membership: who may buy for an organization contact, in what role, and up to what.
 *
 * **Both ORMs are registered**, for the reason the group module states, and the party table is
 * registered beside the pivot because this service reads the account row — to check that it is a company
 * and that it is live — and locks it for the decision. The party's own module owns its service; this
 * module only needs the table mapped, which is what `forFeature` states.
 *
 * **`RolePermissionModule` is imported for the guards**, so that this module — which hosts the
 * company-account controller and resolver — can reach the permission lookup their guards inject.
 *
 * **Buyer authority deliberately does not come from a tenant `role`.** A buyer is not staff: they have no
 * `user` row in the common case and no business in the back-office permission model, and a tenant-wide
 * role would grant one company's clerk authority visible to every other actor in the tenant. The
 * membership's own role and limits are the authority, which is why this module reads the pivot and not
 * the role tables.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([ContactBuyer, OrganizationContact]),
		MikroOrmModule.forFeature([ContactBuyer, OrganizationContact]),
		RolePermissionModule
	],
	controllers: [ContactBuyerController],
	providers: [
		ContactBuyerService,
		ContactBuyerResolver,
		TypeOrmContactBuyerRepository,
		MikroOrmContactBuyerRepository
	],
	exports: [
		ContactBuyerService,
		ContactBuyerResolver,
		TypeOrmContactBuyerRepository,
		MikroOrmContactBuyerRepository
	]
})
export class ContactBuyerModule {}
