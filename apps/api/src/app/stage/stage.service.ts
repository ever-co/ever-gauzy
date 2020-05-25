import { InjectRepository } from '@nestjs/typeorm';
import { CrudService } from '../core/crud';
import { Injectable } from '@angular/core';
import { Stage } from './stage.entity';
import { Repository } from 'typeorm';



@Injectable()
export class StageService extends CrudService<Stage>
{
  public constructor(
    @InjectRepository( Stage )
    stageRepository: Repository<Stage>,
  )
  {
    super( stageRepository );
  }
}
