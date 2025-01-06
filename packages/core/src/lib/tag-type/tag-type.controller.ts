import { ApiTags, ApiResponse, ApiOperation } from '@nestjs/swagger';
import { Controller, HttpStatus, Get, Query, UseGuards, ValidationPipe } from '@nestjs/common';
import { FindOptionsWhere } from 'typeorm';
import { IPagination } from '@gauzy/contracts';
import { CrudController, PaginationParams } from '../core/crud';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { TagType } from './tag-type.entity';
import { TagTypeService } from './tag-type.service';

@ApiTags('TagTypes')
@UseGuards(TenantPermissionGuard, PermissionGuard)
@Controller('/tag-types')
export class TagTypeController extends CrudController<TagType> {
	constructor(private readonly tagTypesService: TagTypeService) {
		super(tagTypesService);
	}

	/**
	 * GET tag types count
	 *
	 * @param data
	 * @returns
	 */
	@ApiOperation({ summary: 'Find Tag Types Count ' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Count Tag Types',
		type: TagType
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get('count')
	async getCount(@Query() options: FindOptionsWhere<TagType>): Promise<number> {
		return await this.tagTypesService.countBy(options);
	}

	/**
	 * GET all tag types
	 *
	 * @param options
	 * @returns
	 */
	@ApiOperation({
		summary: 'Find all tag types.'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found tag types.',
		type: TagType
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get()
	async findAll(@Query(new ValidationPipe()) options: PaginationParams<TagType>): Promise<IPagination<TagType>> {
		return await this.tagTypesService.findAll(options);
	}
}
