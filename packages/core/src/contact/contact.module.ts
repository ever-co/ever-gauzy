import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { RouterModule } from '@nestjs/core';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Contact } from './contact.entity';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { CommandHandlers } from './commands/handlers';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { TypeOrmContactRepository } from './repository';

@Module({
	imports: [
		RouterModule.register([{ path: '/contact', module: ContactModule }]),
		TypeOrmModule.forFeature([Contact]),
		MikroOrmModule.forFeature([Contact]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [ContactController],
	providers: [ContactService, TypeOrmContactRepository, ...CommandHandlers],
	exports: [TypeOrmModule, MikroOrmModule, ContactService, TypeOrmContactRepository]
})
export class ContactModule { }
