import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CqrsModule } from '@nestjs/cqrs';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RolePermissionModule } from '../role-permission/role-permission.module';
import { Contact } from './contact.entity';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { CommandHandlers } from './commands/handlers';
import { TypeOrmContactRepository } from './repository/type-orm-contact.repository';

@Module({
	imports: [
		TypeOrmModule.forFeature([Contact]),
		MikroOrmModule.forFeature([Contact]),
		RolePermissionModule,
		CqrsModule
	],
	controllers: [ContactController],
	providers: [ContactService, TypeOrmContactRepository, ...CommandHandlers],
	exports: [ContactService]
})
export class ContactModule {}
