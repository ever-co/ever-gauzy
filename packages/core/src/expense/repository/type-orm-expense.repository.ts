import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from '../expense.entity';

@Injectable()
export class TypeOrmExpenseRepository extends Repository<Expense> {
    constructor(@InjectRepository(Expense) readonly repository: Repository<Expense>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
