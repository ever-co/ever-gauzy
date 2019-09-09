import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrudService } from '../core/crud/crud.service';
import { OrganizationRecurringExpense } from './organization-recurring-expense.entity';

@Injectable()
export class OrganizationRecurringExpenseService extends CrudService<OrganizationRecurringExpense> {
    constructor(
        @InjectRepository(OrganizationRecurringExpense)
        private readonly organizationRecurringExpenseRepository: Repository<OrganizationRecurringExpense>
    ) {
        super(organizationRecurringExpenseRepository);
    }
}
