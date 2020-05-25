import { AttributeDefinition } from './attribute-definition.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { CrudService } from '../core/crud';
import { Injectable } from '@angular/core';
import { Repository } from 'typeorm';



@Injectable()
export class AttributeDefinitionService extends CrudService<AttributeDefinition>
{
  public constructor(
    @InjectRepository( AttributeDefinition )
    attributeDefinitionRepository: Repository<AttributeDefinition>,
  )
  {
    super( attributeDefinitionRepository );
  }
}
