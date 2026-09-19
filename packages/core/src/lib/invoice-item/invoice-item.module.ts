import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { InvoiceItem } from './invoice-item.entity';
import { InvoiceItemController } from './invoice-item.controller';
import { InvoiceItemResolver } from './invoice-item.resolver';
import { InvoiceItemService } from './invoice-item.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { TaskModule } from '../tasks/task.module';
import { TypeOrmInvoiceItemRepository } from './repository/type-orm-invoice-item.repository';
import { MikroOrmInvoiceItemRepository } from './repository/mikro-orm-invoice-item.repository';

/**
 * One billed line.
 *
 * `CqrsModule` is re-exported, not merely imported, and that is what makes the resolver's two
 * dependencies resolvable from the module the Apollo configuration names: a resolver is a provider of
 * whichever module hosts the handler, so a module that imports this one receives `InvoiceItemService`
 * and the command bus only if this module hands them on. The REST controller beside the resolver
 * resolves the bus from this module's own imports, which is why nothing needed re-exporting until the
 * GraphQL view of the same resource existed.
 */
@Module({
	imports: [
		TypeOrmModule.forFeature([InvoiceItem]),
		MikroOrmModule.forFeature([InvoiceItem]),
		RolePermissionModule,
		TaskModule,
		CqrsModule
	],
	controllers: [InvoiceItemController],
	providers: [
		InvoiceItemService,
		// The GraphQL view of the same resource: declared here because a resolver can only inject
		// services its own module can reach, and this module is what reaches them.
		InvoiceItemResolver,
		TypeOrmInvoiceItemRepository,
		MikroOrmInvoiceItemRepository,
		...CommandHandlers
	],
	exports: [InvoiceItemService, CqrsModule]
})
export class InvoiceItemModule {}
