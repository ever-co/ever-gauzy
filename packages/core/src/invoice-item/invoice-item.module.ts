import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { InvoiceItem } from './invoice-item.entity';
import { InvoiceItemController } from './invoice-item.controller';
import { InvoiceItemService } from './invoice-item.service';
import { TenantModule } from '../tenant/tenant.module';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';
import { CommandHandlers } from './commands/handlers';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/invoice-item', module: InvoiceItemModule }
		]),
		TypeOrmModule.forFeature([InvoiceItem, User]),
		CqrsModule,
		TenantModule
	],
	controllers: [InvoiceItemController],
	providers: [InvoiceItemService, UserService, ...CommandHandlers],
	exports: [InvoiceItemService]
})
export class InvoiceItemModule {}
