import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { ContactCredential } from './contact-credential.entity';
import { ContactCredentialService } from './contact-credential.service';
import { TypeOrmContactCredentialRepository } from './repository/type-orm-contact-credential.repository';
import { MikroOrmContactCredentialRepository } from './repository/mikro-orm-contact-credential.repository';

/**
 * Customer-side logins: the credential of a party that is not a member of staff.
 *
 * **Both ORMs are registered**, for the reason the group module states: the kernel is dual-ORM and the
 * repository pair belongs with the module that declares its table.
 *
 * **`RolePermissionModule` is imported for the guards rather than for a service.** The credential
 * endpoints of the customer-authentication surface are their own guards plus the permission lookup, and
 * a guard is a provider of whichever module hosts the handler it protects — so the module that will host
 * them imports this one and reaches what it needs through this import.
 *
 * **Nothing here depends on the group or the buyer modules.** A credential is a login, not an
 * entitlement: what a logged-in party may do is decided by the company-account membership and by the
 * permissions of the route, never by this module, which is why it can be installed and reasoned about
 * alone.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([ContactCredential]),
		MikroOrmModule.forFeature([ContactCredential]),
		RolePermissionModule
	],
	providers: [
		ContactCredentialService,
		TypeOrmContactCredentialRepository,
		MikroOrmContactCredentialRepository
	],
	exports: [ContactCredentialService, TypeOrmContactCredentialRepository, MikroOrmContactCredentialRepository]
})
export class ContactCredentialModule {}
