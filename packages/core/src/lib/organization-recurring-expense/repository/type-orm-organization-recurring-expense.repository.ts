import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationRecurringExpense } from '../organization-recurring-expense.entity';

@Injectable()
export class TypeOrmOrganizationRecurringExpenseRepository extends Repository<OrganizationRecurringExpense> {
    constructor(@InjectRepository(OrganizationRecurringExpense) readonly repository: Repository<OrganizationRecurringExpense>) {
        super(repository.target, repository.manager, repository.queryRunner);
    }
}
