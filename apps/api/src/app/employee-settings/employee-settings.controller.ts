import { Controller } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import { EmployeeSettingsService } from './employee-settings.service';
import { EmployeeSettings } from './employee-settings.entity';
import { CrudController } from '../core/crud/crud.controller';

@ApiUseTags('EmployeeSettin')
@Controller()
export class EmployeeSettinController extends CrudController<EmployeeSettings> {
    constructor(private readonly mployeeSettingsService: EmployeeSettingsService) {
        super(mployeeSettingsService);
    }
}
