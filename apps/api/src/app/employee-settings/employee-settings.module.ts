import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmployeeSettings } from './employee-settings.entity';
import { EmployeeSettingsService } from './employee-settings.service';
import { EmployeeSettingsController } from './employee-settings.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([EmployeeSettings]),
    ],
    controllers: [EmployeeSettingsController],
    providers: [EmployeeSettingsService],
    exports: [EmployeeSettingsService],
})
export class EmployeeSettingsModule { }
