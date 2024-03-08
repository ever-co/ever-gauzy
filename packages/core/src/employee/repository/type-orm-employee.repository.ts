import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../employee.entity';

export class TypeOrmEmployeeRepository extends Repository<Employee> {

    constructor(
        @InjectRepository(Employee) readonly repository: Repository<Employee>
    ) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
