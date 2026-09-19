import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { InvoiceEstimateHistoryController } from './invoice-estimate-history.controller';
import { InvoiceEstimateHistoryResolver } from './invoice-estimate-history.resolver';
import { InvoiceEstimateHistoryService } from './invoice-estimate-history.service';
import { InvoiceEstimateHistory } from './invoice-estimate-history.entity';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TaskModule } from '../tasks/task.module';
import { TypeOrmInvoiceEstimateHistoryRepository } from './repository/type-orm-invoice-estimate-history.repository';
import { MikroOrmInvoiceEstimateHistoryRepository } from './repository/mikro-orm-invoice-estimate-history.repository';

/**
 * The invoice estimate history.
 *
 * The GraphQL view of the same resource is declared here beside the controller: a resolver is a provider
 * of whichever module the Apollo configuration names, and it can only inject services its own module can
 * reach — which is why it belongs beside the service it calls rather than in the module that hosts the
 * platform's other resolvers. `RolePermissionModule` is imported for the guards the list field carries,
 * which resolve their permission lookup from the module that hosts the handler they protect.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([InvoiceEstimateHistory]),
		MikroOrmModule.forFeature([InvoiceEstimateHistory]),
		RolePermissionModule,
		TaskModule
	],
	controllers: [InvoiceEstimateHistoryController],
	providers: [
		InvoiceEstimateHistoryService,
		InvoiceEstimateHistoryResolver,
		TypeOrmInvoiceEstimateHistoryRepository,
		MikroOrmInvoiceEstimateHistoryRepository
	]
})
export class InvoiceEstimateHistoryModule {}