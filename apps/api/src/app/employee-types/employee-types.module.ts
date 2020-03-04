import { Module } from '@nestjs/common';
import { EmployeeTypesService } from './employee-types.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeTypes } from './employee-types.entity';
import { EmployeeTypesController } from './employee-types.controller';

@Module({
	imports: [TypeOrmModule.forFeature([EmployeeTypes])],
	controllers: [EmployeeTypesController],
	providers: [EmployeeTypesService],
	exports: [EmployeeTypesService]
})
export class EmployeeTypesModule {}
