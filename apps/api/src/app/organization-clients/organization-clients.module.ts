import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationClients } from './organization-clients.entity';
import { OrganizationClientsController } from './organization-clients.controller';
import { OrganizationClientsService } from './organization-clients.service';
import { CqrsModule } from '@nestjs/cqrs';
import { CommandHandlers } from './commands/handlers';
import { User, UserService } from '../user';

@Module({
	imports: [
		TypeOrmModule.forFeature([OrganizationClients, User]),
		CqrsModule
	],
	controllers: [OrganizationClientsController],
	providers: [OrganizationClientsService, UserService, ...CommandHandlers],
	exports: [OrganizationClientsService]
})
export class OrganizationClientsModule {}
