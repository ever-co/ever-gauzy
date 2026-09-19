import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ApprovalPolicy } from './approval-policy.entity';
import { ApprovalPolicyController } from './approval-policy.controller';
import { ApprovalPolicyResolver } from './approval-policy.resolver';
import { ApprovalPolicyService } from './approval-policy.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmApprovalPolicyRepository } from './repository/type-orm-approval-policy.repository';
import { MikroOrmApprovalPolicyRepository } from './repository/mikro-orm-approval-policy.repository';

/**
 * The approval policy.
 *
 * `CqrsModule` is re-exported, not merely imported, and that is what makes the resolver's non-service
 * dependency resolvable: a resolver is a provider of whichever module hosts the handler the Apollo
 * configuration names, so a module that imports this one receives the command bus only if this module
 * hands it on. The REST controller beside it resolves the bus from this module's own imports, which is
 * why nothing needed re-exporting until the GraphQL view of the same resource existed.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([ApprovalPolicy]),
		MikroOrmModule.forFeature([ApprovalPolicy]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [ApprovalPolicyController],
	providers: [
		ApprovalPolicyService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		ApprovalPolicyResolver,
		TypeOrmApprovalPolicyRepository,
		MikroOrmApprovalPolicyRepository,
		...CommandHandlers
	],
	exports: [ApprovalPolicyService, CqrsModule]
})
export class ApprovalPolicyModule {}