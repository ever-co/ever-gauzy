import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee, Organization } from './../../core/entities/internal';
import { PublicEmployeeController } from './public-employee.controller';
import { PublicEmployeeService } from './public-employee.service';
import { QueryHandlers } from './queries/handlers';

@Module({
	imports: [
		CqrsModule,
		TypeOrmModule.forFeature([ Employee, Organization ]),
	],
	controllers: [
		PublicEmployeeController
	],
	providers: [
		PublicEmployeeService,
		...QueryHandlers
	],
	exports: []
})
export class PublicEmployeeModule {}