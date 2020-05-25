import { AttributeValidator } from './attribute-validator.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { CrudService } from '../core/crud';
import { Injectable } from '@angular/core';
import { Repository } from 'typeorm';



@Injectable()
export class AttributeValidatorService extends CrudService<AttributeValidator>
{
  public constructor(
    @InjectRepository( AttributeValidator )
    attributeValidatorRepository: Repository<AttributeValidator>,
  )
  {
    super( attributeValidatorRepository );
  }
}
