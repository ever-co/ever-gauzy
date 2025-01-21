import { ApiTags } from '@nestjs/swagger';
import {
	Controller,
	HttpStatus,
	Get,
	Query,
	UseGuards,
	Body,
	HttpCode,
	Post,
	Put,
	Param,
	BadRequestException
} from '@nestjs/common';
import { ApiResponse, ApiOperation } from '@nestjs/swagger';
import { ID, IMerchant, IPagination, PermissionsEnum } from '@gauzy/contracts';
import { FindOptionsWhere } from 'typeorm';
import { CrudController, PaginationParams } from './../core/crud';
import { UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { PermissionGuard, TenantPermissionGuard } from './../shared/guards';
import { Permissions } from './../shared/decorators';
import { RelationsQueryDTO } from './../shared/dto';
import { Merchant } from './merchant.entity';
import { MerchantService } from './merchant.service';
import { CreateMerchantDTO, UpdateMerchantDTO } from './dto';

@ApiTags('Merchants')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Permissions(PermissionsEnum.ORG_INVENTORY_PRODUCT_EDIT)
@Controller('/merchants')
export class MerchantController extends CrudController<Merchant> {
	constructor(private readonly merchantService: MerchantService) {
		super(merchantService);
	}

	/**
	 * GET merchant stores count
	 *
	 * @param options
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all merchant stores count in the same tenant' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found merchant stores count'
	})
	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	@Get('/count')
	async getCount(@Query() options: FindOptionsWhere<Merchant>): Promise<IPagination<Merchant>['total']> {
		return await this.merchantService.countBy(options);
	}

	/**
	 * GET merchant stores by pagination
	 *
	 * @param params
	 * @returns
	 */
	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	@Get('/pagination')
	@UseValidationPipe({ transform: true })
	async pagination(@Query() params: PaginationParams<Merchant>): Promise<IPagination<IMerchant>> {
		return await this.merchantService.paginate(params);
	}

	/**
	 * GET merchant stores
	 *
	 * @param params
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all product stores.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found product stores.',
		type: Merchant
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	@Get('/')
	@UseValidationPipe()
	async findAll(@Query() params: PaginationParams<Merchant>): Promise<IPagination<IMerchant>> {
		try {
			return await this.merchantService.findAll(params);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}

	/**
	 * GET merchant by id
	 *
	 * @param id
	 * @param query
	 * @returns
	 */
	@ApiOperation({
		summary: 'Get merchant by id.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found merchant.',
		type: Merchant
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('/:id')
	@Permissions(PermissionsEnum.ORG_INVENTORY_VIEW)
	async findById(@Param('id', UUIDValidationPipe) id: ID, @Query() query: RelationsQueryDTO): Promise<IMerchant> {
		return await this.merchantService.findById(id, query.relations);
	}

	/**
	 * CREATE new merchant store
	 *
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The merchant store has been successfully created.' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.CREATED)
	@Post('/')
	@UseValidationPipe({ whitelist: true })
	async create(@Body() entity: CreateMerchantDTO): Promise<IMerchant> {
		return await this.merchantService.create(entity);
	}

	/**
	 * UPDATE merchant store by id
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Update merchant store record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The merchant store record has been successfully updated.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put('/:id')
	@UseValidationPipe({ whitelist: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateMerchantDTO): Promise<IMerchant> {
		return await this.merchantService.update(id, entity);
	}
}
