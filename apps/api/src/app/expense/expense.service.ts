import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { Expense } from './expense.entity';
import { CrudService } from '../core/crud/crud.service';
import { IPagination } from '../core';

@Injectable()
export class ExpenseService extends CrudService<Expense> {
    constructor(@InjectRepository(Expense) private readonly expenseRepository: Repository<Expense>) {
        super(expenseRepository);
    }

    public async findAll(filter?: FindManyOptions<Expense>, filterDate?: string): Promise<IPagination<Expense>> {
        const total = await this.repository.count(filter);
        let items = await this.repository.find(filter);
    
        if (filterDate) {
          const dateObject = new Date(filterDate)
    
          const month = dateObject.getMonth() + 1;
          const year = dateObject.getFullYear();
    
          items = items.filter(i => {
            const currentItemMonth = i.valueDate.getMonth() + 1;
            const currentItemYear = i.valueDate.getFullYear();
            return (currentItemMonth === month) && (currentItemYear === year);
          });
        }
    
        return { items, total };
      }
}
