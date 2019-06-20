import { Controller } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import { EmployeeService } from './employee.service';

@ApiUseTags('Employee')
@Controller()
export class EmployeeController {
    constructor(private readonly employeeService: EmployeeService) {
    }
}