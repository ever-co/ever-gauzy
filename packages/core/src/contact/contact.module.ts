import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from 'nest-router';
import { Contact } from './contact.entity';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { CommandHandlers } from './commands/handlers';
import { TenantModule } from '../tenant/tenant.module';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/contact', module: ContactModule }
		]),
		TypeOrmModule.forFeature([Contact]),
		TenantModule,
		CqrsModule
	],
	controllers: [ContactController],
	providers: [ContactService, ...CommandHandlers],
	exports: [TypeOrmModule, ContactService]
})
export class ContactModule {}