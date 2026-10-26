import {
	Controller,
	HttpStatus,
	Get,
	Post,
	Body,
	HttpCode,
	Put,
	Param,
	UseGuards,
	Delete,
	ValidationPipe,
	UsePipes
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { KeyResult } from './keyresult.entity';
import { CrudController } from './../core/crud';
import { KeyResultService } from './keyresult.service';
import { TenantPermissionGuard, PermissionGuard } from './../shared/guards';
import {
	BulkBodyLoadTransformPipe,
	UUIDValidationPipe,
	UseValidationPipe,
	AbstractValidationPipe
} from './../shared/pipes';
import { ID, IKeyResult, PermissionsEnum } from '@gauzy/contracts';
import { CreateKeyResultDTO, KeyResultBulkInputDTO, UpdateKeyResultDTO } from './dto';
import { DeleteResult } from 'typeorm';
import { Permissions } from './../shared/decorators';
import { TenantOrganizationBaseDTO } from './../core/dto';

@ApiTags('KeyResults')
@UseGuards(TenantPermissionGuard)
@Controller('/key-results')
export class KeyResultController extends CrudController<KeyResult> {
	constructor(private readonly keyResultService: KeyResultService) {
		super(keyResultService);
	}

	@ApiOperation({ summary: 'Create a key result' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Key Result Created',
		type: KeyResult
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Key Result not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.GOALS_EDIT)
	@Post()
	@UseValidationPipe({ transform: true })
	async create(@Body() entity: CreateKeyResultDTO): Promise<KeyResult> {
		return this.keyResultService.create(entity);
	}

	@ApiOperation({ summary: 'Create Bulk key result' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Key Results Created',
		type: KeyResult
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Key Result not found'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.GOALS_EDIT)
	@Post('/bulk')
	async createBulkKeyResults(
		@Body(BulkBodyLoadTransformPipe, new ValidationPipe({ transform: true })) entity: KeyResultBulkInputDTO
	): Promise<KeyResult[]> {
		return this.keyResultService.createBulk(entity.list);
	}

	@ApiOperation({ summary: 'Get key result by ID' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found Key Result',
		type: KeyResult
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Key Result not found'
	})
	@Get(':id')
	async getAll(@Param('id') findInput: string) {
		return this.keyResultService.findAll({
			where: { id: findInput },
			relations: ['updates', 'goal', 'lead', 'owner']
		});
	}

	@ApiOperation({ summary: 'Update an existing keyresult' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The keyresult has been successfully edited.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Key Result not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.GOALS_EDIT)
	@Put(':id')
	@UseValidationPipe({ transform: true })
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: UpdateKeyResultDTO): Promise<IKeyResult> {
		//We are using create here because create calls the method save()
		//We need save() to save ManyToMany relations
		return await this.keyResultService.create({ ...entity, id });
	}

	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.GOALS_EDIT)
	@Delete(':id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return this.keyResultService.delete(id);
	}

	/**
	 * Soft deletes a record by id.
	 *
	 * Overrides the inherited `CrudController.softRemove()` route only to attach a permission. The base declares the route
	 * with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member of the
	 * tenant could retire the row. It now states `GOALS_EDIT` (owner decision 2, 2026-10-22; GHSA-v79w-54p2-wmh5). The
	 * GraphQL field that mirrors it states the same.
	 *
	 * @param id The record to soft delete.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The soft-deleted record.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record soft deleted successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.GOALS_EDIT)
	@Delete(':id/soft')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRemove(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<KeyResult> {
		return await super.softRemove(id, ...options);
	}

	/**
	 * Restores a record by id.
	 *
	 * Overrides the inherited `CrudController.softRecover()` route only to attach a permission. The base declares the route
	 * with no permission metadata, and `PermissionGuard` answers `true` to empty metadata, so any member of the
	 * tenant could restore the row. It now states `GOALS_EDIT` (owner decision 2, 2026-10-22; GHSA-v79w-54p2-wmh5). The
	 * GraphQL field that mirrors it states the same.
	 *
	 * @param id The record to restore.
	 * @param options The inherited options, forwarded to the service.
	 * @returns The restored record.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({ status: HttpStatus.ACCEPTED, description: 'Record restored successfully' })
	@ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Record not found or not in a soft-deleted state' })
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.GOALS_EDIT)
	@Put(':id/recover')
	@UsePipes(new AbstractValidationPipe({ whitelist: true }, { query: TenantOrganizationBaseDTO }))
	async softRecover(@Param('id', UUIDValidationPipe) id: ID, ...options: any[]): Promise<KeyResult> {
		return await super.softRecover(id, ...options);
	}
}
