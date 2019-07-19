import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions } from 'typeorm';
import { Income } from './income.entity';
import { CrudService } from '../core/crud/crud.service';
import { IPagination } from '../core';

@Injectable()
export class IncomeService extends CrudService<Income> {
  constructor(@InjectRepository(Income) private readonly incomeRepository: Repository<Income>) {
    super(incomeRepository);
  }

  public async findAll(filter?: FindManyOptions<Income>, filterDate?: string): Promise<IPagination<Income>> {
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
