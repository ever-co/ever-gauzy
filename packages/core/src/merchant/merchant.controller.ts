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
	ValidationPipe,
	BadRequestException
} from '@nestjs/common';
import { ApiResponse, ApiOperation } from '@nestjs/swagger';
import { IMerchant, IPagination } from '@gauzy/contracts';
import { FindOptionsWhere } from 'typeorm/find-options/FindOptionsWhere';
import { CrudController, PaginationParams } from './../core/crud';
import { Merchant } from './merchant.entity';
import { MerchantService } from './merchant.service';
import { ParseJsonPipe, UUIDValidationPipe } from './../shared/pipes';
import { TenantPermissionGuard } from './../shared/guards';
import { CreateMerchantDTO, UpdateMerchantDTO } from './dto';


@ApiTags('Merchants')
@UseGuards(TenantPermissionGuard)
@Controller()
export class MerchantController extends CrudController<Merchant> {
	constructor(
		private readonly merchantService: MerchantService
	) {
		super(merchantService);
	}

	/**
	 * GET merchant store count
	 *
	 * @param filter
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all merchant stores count in the same tenant' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found merchant stores count'
	})
	@Get('count')
	async getCount(
		@Query() options: FindOptionsWhere<Merchant>
	): Promise<number> {
		return await this.merchantService.countBy(options);
	}

	/**
	 * GET merchants by pagination
	 *
	 * @param filter
	 * @returns
	 */
	@Get('pagination')
	async pagination(
		@Query(new ValidationPipe({
			transform: true
		})) options: PaginationParams<Merchant>
	): Promise<IPagination<IMerchant>> {
		return this.merchantService.paginate(options);
	}

	/**
	 * GET all products merchants stores
	 *
	 * @param data
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
	@Get()
	async findAll(
		@Query('data', ParseJsonPipe) data: any,
	): Promise<IPagination<IMerchant>> {
		const { relations = [], findInput = null } = data;
		return this.merchantService.findAllMerchants(
			relations,
			findInput
		);
	}

	/**
	 * GET merchant by id
	 *
	 * @param id
	 * @param data
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
	@Get(':id')
	async findById(
		@Param('id', UUIDValidationPipe) id: string,
		@Query('data', ParseJsonPipe) data: any
	): Promise<IMerchant> {
		const { relations = [] } = data;
		return this.merchantService.findById(
			id,
			relations
		);
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
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Post()
	async create(
		@Body(new ValidationPipe({
			transform: true,
			whitelist: true
		})) entity: CreateMerchantDTO
	): Promise<IMerchant> {
		try {
			return await this.merchantService.create(entity);
		} catch (error) {
			throw new BadRequestException(error);
		}
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
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body(new ValidationPipe({
			transform: true,
			whitelist: true
		})) entity: UpdateMerchantDTO
	): Promise<IMerchant> {
		try {
			return await this.merchantService.update(id, entity);
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}
