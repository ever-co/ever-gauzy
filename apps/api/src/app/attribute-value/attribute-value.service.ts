import { AttributeValue } from './attribute-value.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { CrudService } from '../core/crud';
import { Injectable } from '@angular/core';
import { Repository } from 'typeorm';



@Injectable()
export class AttributeValueService extends CrudService<AttributeValue>
{
  public constructor(
    @InjectRepository( AttributeValue )
    attributeValueRepository: Repository<AttributeValue>,
  )
  {
    super( attributeValueRepository );
  }
}
