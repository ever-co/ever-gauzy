import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { AccountingTemplate } from './accounting-template.entity';
import { AccountingTemplateController } from './accounting-template.controller';
import { AccountingTemplateResolver } from './accounting-template.resolver';
import { AccountingTemplateService } from './accounting-template.service';
import { QueryHandlers } from './queries/handlers';
import { TypeOrmAccountingTemplateRepository } from './repository/type-orm-accounting-template.repository';
import { MikroOrmAccountingTemplateRepository } from './repository/mikro-orm-accounting-template.repository';

/**
 * The accounting templates.
 *
 * `CqrsModule` is re-exported, not merely imported, and that is what makes the resolver's non-service
 * dependency resolvable: a resolver is a provider of whichever module the Apollo configuration names, so
 * a module that imports this one receives the query bus only if this module hands it on. The REST
 * controller beside it resolves the bus from this module's own imports, which is why nothing needed
 * re-exporting until the GraphQL view of the same resource existed.
 */
@Module({
	imports: [
		CqrsModule,
		TypeOrmModule.forFeature([AccountingTemplate]),
		MikroOrmModule.forFeature([AccountingTemplate]),
		RolePermissionModule
	],
	controllers: [AccountingTemplateController],
	providers: [
		AccountingTemplateService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		AccountingTemplateResolver,
		TypeOrmAccountingTemplateRepository,
		MikroOrmAccountingTemplateRepository,
		...QueryHandlers
	],
	exports: [AccountingTemplateService, CqrsModule]
})
export class AccountingTemplateModule {}
