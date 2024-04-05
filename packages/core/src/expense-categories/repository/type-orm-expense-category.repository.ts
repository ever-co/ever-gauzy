import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExpenseCategory } from '../expense-category.entity';

@Injectable()
export class TypeOrmExpenseCategoryRepository extends Repository<ExpenseCategory> {
    constructor(@InjectRepository(ExpenseCategory) readonly repository: Repository<ExpenseCategory>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
