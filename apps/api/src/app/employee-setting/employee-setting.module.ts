import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeSetting } from './employee-setting.entity';
import { EmployeeSettingService } from './employee-setting.service';
import { EmployeeSettingController } from './employee-setting.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([EmployeeSetting]),
    ],
    controllers: [EmployeeSettingController],
    providers: [EmployeeSettingService],
    exports: [EmployeeSettingService],
})
export class EmployeeSettingModule { }
