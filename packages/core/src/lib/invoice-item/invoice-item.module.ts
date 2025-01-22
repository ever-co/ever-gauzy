import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { InvoiceItem } from './invoice-item.entity';
import { InvoiceItemController } from './invoice-item.controller';
import { InvoiceItemService } from './invoice-item.service';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { CommandHandlers } from './commands/handlers';
import { TaskModule } from '../tasks/task.module';
import { TypeOrmInvoiceItemRepository } from './repository/type-orm-invoice-item.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([InvoiceItem]),
		MikroOrmModule.forFeature([InvoiceItem]),
		RolePermissionModule,
		TaskModule,
		CqrsModule
	],
	controllers: [InvoiceItemController],
	providers: [InvoiceItemService, TypeOrmInvoiceItemRepository, ...CommandHandlers],
	exports: [InvoiceItemService]
})
export class InvoiceItemModule {}
