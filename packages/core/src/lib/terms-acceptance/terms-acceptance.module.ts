import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TermsAcceptance } from './terms-acceptance.entity';
import { TermsAcceptanceController } from './terms-acceptance.controller';
import { TermsAcceptanceResolver } from './terms-acceptance.resolver';
import { TermsAcceptanceService } from './terms-acceptance.service';
import { TypeOrmTermsAcceptanceRepository } from './repository/type-orm-terms-acceptance.repository';
import { MikroOrmTermsAcceptanceRepository } from './repository/mikro-orm-terms-acceptance.repository';

/**
 * The published legal corpus and the acceptances recorded against it.
 *
 * The GraphQL view of the same resource is declared here because a resolver can only inject services
 * its own module can reach, and this module is what reaches `TermsAcceptanceService`. Nothing has to be
 * re-exported for it: the resolver calls that one service, which is already exported for the signup and
 * invite-acceptance flows that record acceptances.
 *
 * `RolePermissionModule` is imported for the guards: the controller and the resolver apply
 * `TenantPermissionGuard` and `PermissionGuard`, which inject `RolePermissionService`, and a guard is built in
 * the module of the class it guards — without the import the API does not start.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([TermsAcceptance]),
		MikroOrmModule.forFeature([TermsAcceptance]),
		RolePermissionModule
	],
	controllers: [TermsAcceptanceController],
	providers: [
		TermsAcceptanceService,
		TermsAcceptanceResolver,
		TypeOrmTermsAcceptanceRepository,
		MikroOrmTermsAcceptanceRepository
	],
	exports: [TermsAcceptanceService, TypeOrmTermsAcceptanceRepository, MikroOrmTermsAcceptanceRepository]
})
export class TermsAcceptanceModule {}
