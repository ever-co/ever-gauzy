import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from './employee.entity';

@Injectable()
export class EmployeeService  {
  constructor(@InjectRepository(Employee) private readonly employeeRepository: Repository<Employee>) {
  }
}
