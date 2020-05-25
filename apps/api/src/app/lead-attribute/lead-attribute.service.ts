import { LeadAttribute } from './lead-attribute.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { CrudService } from '../core/crud';
import { Injectable } from '@angular/core';
import { Repository } from 'typeorm';



@Injectable()
export class LeadAttributeService extends CrudService<LeadAttribute>
{
  public constructor(
    @InjectRepository( LeadAttribute )
    leadAttributeRepository: Repository<LeadAttribute>,
  )
  {
    super( leadAttributeRepository );
  }
}
