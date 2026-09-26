import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { ContactCredential } from './contact-credential.entity';
import { ContactCredentialService } from './contact-credential.service';
import { ContactCredentialController } from './contact-credential.controller';
import { ContactCredentialResolver } from './contact-credential.resolver';
import { TypeOrmContactCredentialRepository } from './repository/type-orm-contact-credential.repository';
import { MikroOrmContactCredentialRepository } from './repository/mikro-orm-contact-credential.repository';

/**
 * Customer-side logins: the credential of a party that is not a member of staff.
 *
 * **Both ORMs are registered**, for the reason the group module states: the kernel is dual-ORM and the
 * repository pair belongs with the module that declares its table.
 *
 * **`RolePermissionModule` is imported for the guards rather than for a service.** The controller and the
 * resolver that carry `/contact-credentials` are providers of this module, and a guard is a provider of
 * whichever module hosts the handler it protects — so the module that hosts them has to be able to reach
 * the permission lookup those guards ask for.
 *
 * **`PasswordHashService` is injected and no module is imported for it.** The platform's password-hash
 * module is global, and it has to be: a route that records a login hashes the password the party chose
 * before the service is reached, because the service's contract is a hash and never a plaintext. Nothing
 * here is the hasher's owner, so nothing here re-provides it.
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
	controllers: [ContactCredentialController],
	providers: [
		ContactCredentialService,
		ContactCredentialResolver,
		TypeOrmContactCredentialRepository,
		MikroOrmContactCredentialRepository
	],
	exports: [
		ContactCredentialService,
		ContactCredentialResolver,
		TypeOrmContactCredentialRepository,
		MikroOrmContactCredentialRepository
	]
})
export class ContactCredentialModule {}
