import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from './employee.entity';
import { CrudService } from '../core/crud/crud.service';

@Injectable()
export class EmployeeService extends CrudService<Employee> {
  constructor(@InjectRepository(Employee) private readonly employeeRepository: Repository<Employee>) {
    super(employeeRepository);
  }
}
