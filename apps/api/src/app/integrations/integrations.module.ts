import { Module } from '@nestjs/common';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService, User } from '../user';
import { EmployeeService, Employee } from '../employee';
import { CqrsModule } from '@nestjs/cqrs';

@Module({
	imports: [TypeOrmModule.forFeature([User, Employee]), CqrsModule],
	controllers: [IntegrationsController],
	providers: [IntegrationsService, UserService, EmployeeService]
})
export class IntegrationsModule {}
