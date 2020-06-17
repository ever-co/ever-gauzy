import { CrudService } from '../core/crud';
import { Stage } from './stage.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable } from '@angular/core';

@Injectable()
export class StageService extends CrudService<Stage>
{

  public constructor(
    @InjectRepository( Stage )
    stageRepository: Repository<Stage> )
  {
    super( stageRepository );
  }

}
