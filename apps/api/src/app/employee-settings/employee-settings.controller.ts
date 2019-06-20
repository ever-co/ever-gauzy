import { Controller } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import { EmployeeSettingsService } from './employee-settings.service';

@ApiUseTags('EmployeeSettin')
@Controller()
export class EmployeeSettinController {
    constructor(private readonly mployeeSettingsService: EmployeeSettingsService) {
    }
}
