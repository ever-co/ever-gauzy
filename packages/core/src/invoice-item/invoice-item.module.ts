import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { InvoiceItem } from './invoice-item.entity';
import { InvoiceItemController } from './invoice-item.controller';
import { InvoiceItemService } from './invoice-item.service';
import { TenantModule } from '../tenant/tenant.module';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';
import { CommandHandlers } from './commands/handlers';
import { TaskModule } from '../tasks/task.module';

@Module({
	imports: [
		RouterModule.register([{ path: '/invoice-item', module: InvoiceItemModule }]),
		TypeOrmModule.forFeature([InvoiceItem, User]),
		MikroOrmModule.forFeature([InvoiceItem, User]),
		TenantModule,
		RolePermissionModule,
		TaskModule,
		CqrsModule
	],
	controllers: [InvoiceItemController],
	providers: [InvoiceItemService, UserService, ...CommandHandlers],
	exports: [InvoiceItemService]
})
export class InvoiceItemModule { }
