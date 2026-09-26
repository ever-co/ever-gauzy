import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RequestApproval } from './request-approval.entity';
import { RequestApprovalController } from './request-approval.controller';
import { RequestApprovalService } from './request-approval.service';
import { OrganizationTeamModule } from '../organization-team/organization-team.module';
import { EmployeeModule } from '../employee/employee.module';
import { OrganizationTeamEmployeeModule } from '../organization-team-employee/organization-team-employee.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { UserModule } from './../user/user.module';
import { RoleModule } from './../role/role.module';
import { OrganizationModule } from './../organization/organization.module';
import { EquipmentSharingModule } from './../equipment-sharing/equipment-sharing.module';
import { TimeOffRequestModule } from './../time-off-request/time-off-request.module';
import { CommandHandlers } from './commands/handlers';
import { TaskModule } from './../tasks/task.module';
import { StatisticModule } from '../time-tracking/statistic/statistic.module';
import { TimerModule } from '../time-tracking/timer/timer.module';
import { RequestApprovalResolver } from './request-approval.resolver';
import { TypeOrmRequestApprovalRepository } from './repository/type-orm-request-approval.repository';
import { MikroOrmRequestApprovalRepository } from './repository/mikro-orm-request-approval.repository';

/**
 * The approval request: the row a document raises when somebody has to say yes to it, the decision an
 * approver makes on it, and the policy that governs how many decisions it needs.
 *
 * **The GraphQL view of the same resource is declared here, beside the service and the command bus it
 * calls**, because a resolver is an ordinary Nest provider and can only inject what the module hosting
 * it can reach.
 *
 * **`CqrsModule` is re-exported, not merely imported.** The REST controller beside the resolver
 * resolves the command bus from this module's own imports, so nothing had to be handed on until the
 * GraphQL view of the same resource existed. The resolver is a provider of whichever module the Apollo
 * configuration scans, and a module's imports are not inherited by the module that imports it, so the
 * command bus the two decision fields dispatch through — and the gate's own resolution — have to
 * travel with the export.
 *
 * Both additions are wiring and nothing else: no route, entity, service or DTO changed.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([RequestApproval]),
		MikroOrmModule.forFeature([RequestApproval]),
		CqrsModule,
		OrganizationTeamEmployeeModule,
		RolePermissionModule,
		UserModule,
		EmployeeModule,
		OrganizationTeamModule,
		RoleModule,
		OrganizationModule,
		forwardRef(() => TimeOffRequestModule),
		forwardRef(() => EquipmentSharingModule),
		TaskModule,
		TimerModule,
		StatisticModule
	],
	controllers: [RequestApprovalController],
	providers: [
		RequestApprovalService,
		// The GraphQL view of the same resource.
		RequestApprovalResolver,
		TypeOrmRequestApprovalRepository,
		MikroOrmRequestApprovalRepository,
		...CommandHandlers
	],
	exports: [RequestApprovalService, TypeOrmRequestApprovalRepository, MikroOrmRequestApprovalRepository, CqrsModule]
})
export class RequestApprovalModule {}