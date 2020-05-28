import { AttributeValidatorService } from './attribute-validator.service';
import { AttributeValidator } from './attribute-validator.entity';
import { Controller, Get, HttpStatus, UseGuards } from '@nestjs/common';
import { CrudController, IPagination, PaginationParams } from '../core/crud';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';



@UseGuards( AuthGuard( 'jwt' ) )
@ApiTags( 'Attribute' )
@Controller()
export class AttributeValidatorController extends CrudController<AttributeValidator>
{
  public constructor( private attributeValidatorService: AttributeValidatorService )
  {
    super( attributeValidatorService );
  }

  @ApiOperation({ summary: 'Find all attribute validators' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Found records'
  })
  @Get()
  public async findAll( filter?: PaginationParams<AttributeValidator> ): Promise<IPagination<AttributeValidator>>
  {
    console.log( '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@' );
    console.log( '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@' );
    console.log( '@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@' );
    return this.attributeValidatorService.findAll();
  }

}
