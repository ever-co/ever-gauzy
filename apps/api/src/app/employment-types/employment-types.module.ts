import { Module } from '@nestjs/common';
import { EmploymentTypesService } from './employment-types.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmploymentTypes } from './employment-types.entity';
import { EmploymentTypesController } from './employment-types.controller';

@Module({
	imports: [TypeOrmModule.forFeature([EmploymentTypes])],
	controllers: [EmploymentTypesController],
	providers: [EmploymentTypesService],
	exports: [EmploymentTypesService]
})
export class EmploymentTypesModule {}
