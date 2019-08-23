import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationDepartment } from './organization-department.entity';
import { OrganizationDepartmentController } from './organization-department.controller';
import { OrganizationDepartmentService } from './organization-department.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([OrganizationDepartment]),
    ],
    controllers: [OrganizationDepartmentController],
    providers: [OrganizationDepartmentService],
    exports: [OrganizationDepartmentService],
})
export class OrganizationDepartmentModule { }
