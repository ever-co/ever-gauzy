import { Controller, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CrudController } from '../core/crud';
import { Deal } from './deal.entity';
import { DealService } from './deal.service';

@Controller()
@ApiTags( 'Deal' )
@UseGuards( AuthGuard( 'jwt' ) )
export class DealController extends CrudController<Deal>
{
  public constructor(
    dealService: DealService )
  {
    super( dealService );
  }
}
