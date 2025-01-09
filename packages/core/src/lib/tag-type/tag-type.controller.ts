import { ApiTags, ApiResponse, ApiOperation } from '@nestjs/swagger';
import {
	Controller,
	HttpStatus,
	Get,
	Query,
	UseGuards,
	ValidationPipe,
	HttpCode,
	Post,
	Body,
	Param,
	Put
} from '@nestjs/common';
import { FindOptionsWhere, UpdateResult } from 'typeorm';
import { ID, IPagination, ITagType, PermissionsEnum } from '@gauzy/contracts';
import { CrudController, PaginationParams } from '../core/crud';
import { PermissionGuard, TenantPermissionGuard } from '../shared/guards';
import { TagType } from './tag-type.entity';
import { TagTypeService } from './tag-type.service';
import { Permissions, UseValidationPipe, UUIDValidationPipe } from '../shared';
import { CreateTagTypeDTO, UpdateTagTypeDTO } from './dto';

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
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TAG_TYPES_VIEW)
	@Get('/count')
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
	@Permissions(PermissionsEnum.ALL_ORG_VIEW, PermissionsEnum.ORG_TAG_TYPES_VIEW)
	@Get('/')
	async findAll(@Query(new ValidationPipe()) options: PaginationParams<TagType>): Promise<IPagination<TagType>> {
		return await this.tagTypesService.findAll(options);
	}

	/**
	 * Create new tag type
	 *
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.CREATED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TAG_TYPES_ADD)
	@Post('/')
	@UseValidationPipe({ whitelist: true })
	async create(@Body() entity: CreateTagTypeDTO): Promise<ITagType> {
		return this.tagTypesService.create(entity);
	}

	/**
	 * Update existing tag Type by ID
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	@HttpCode(HttpStatus.ACCEPTED)
	@Permissions(PermissionsEnum.ALL_ORG_EDIT, PermissionsEnum.ORG_TAG_TYPES_EDIT)
	@Put('/:id')
	@UseValidationPipe({ whitelist: true })
	async update(
		@Param('id', UUIDValidationPipe) id: ID,
		@Body() entity: UpdateTagTypeDTO
	): Promise<ITagType | UpdateResult> {
		return this.tagTypesService.update(id, entity);
	}
}
