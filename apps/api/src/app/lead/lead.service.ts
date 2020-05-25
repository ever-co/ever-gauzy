import { InjectRepository } from '@nestjs/typeorm';
import { CrudService } from '../core/crud';
import { Injectable } from '@angular/core';
import { Repository } from 'typeorm';
import { Lead } from './lead.entity';



@Injectable()
export class LeadService extends CrudService<Lead>
{
  public constructor(
    @InjectRepository( Lead )
    leadRepository: Repository<Lead>,
  )
  {
    super( leadRepository );
  }
}
