import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from '@nestjs/core';
import { Contact } from './contact.entity';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { CommandHandlers } from './commands/handlers';
import { TenantModule } from '../tenant/tenant.module';
import { MikroOrmModule } from '@mikro-orm/nestjs';

@Module({
	imports: [
		RouterModule.register([{ path: '/contact', module: ContactModule }]),
		TypeOrmModule.forFeature([Contact]),
		MikroOrmModule.forFeature([Contact]),
		TenantModule,
		CqrsModule
	],
	controllers: [ContactController],
	providers: [ContactService, ...CommandHandlers],
	exports: [TypeOrmModule, ContactService]
})
export class ContactModule { }
