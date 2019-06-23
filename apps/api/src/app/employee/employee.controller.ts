import { Controller } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';
import { EmployeeService } from './employee.service';
import { Employee } from './employee.entity';
import { CrudController } from '../core/crud/crud.controller';

@ApiUseTags('Employee')
@Controller()
export class EmployeeController extends CrudController<Employee> {
    constructor(private readonly employeeService: EmployeeService) {
        super(employeeService);
    }
}