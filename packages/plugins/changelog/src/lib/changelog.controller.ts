import {
	Controller,
	HttpStatus,
	Get,
	UseGuards,
	HttpCode,
	Post,
	Body,
	Delete,
	Param,
	Put,
	Query,
	ValidationPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { IChangelog, IChangelogCreateInput, IChangelogUpdateInput, ID, IPagination, RolesEnum } from '@gauzy/contracts';
import { AuthGuard, CrudController, RoleGuard, Roles, UUIDValidationPipe } from '@gauzy/core';
import { Public } from '@gauzy/common';
import { DeleteResult } from 'typeorm';
import { Changelog } from './changelog.entity';
import { ChangelogService } from './changelog.service';
import { ChangelogCreateCommand, ChangelogUpdateCommand } from './commands';
import { ChangelogQueryDTO } from './dto/changelog-query.dto';

/**
 * Changelog is PLATFORM-level content: the public GET feeds the "What's New"
 * sidebar plus the login/register pages, and every write is a broadcast to all
 * of them. Writes are therefore SUPER_ADMIN-only — before this guard any
 * authenticated user could rewrite what every visitor sees on the login page.
 */
@ApiTags('Changelog')
@UseGuards(AuthGuard)
@Controller('/changelog')
export class ChangelogController extends CrudController<Changelog> {
	constructor(private readonly changelogService: ChangelogService, private readonly commandBus: CommandBus) {
		super(changelogService);
	}

	/**
	 * Public list of changelog entries, newest first (see the service for the
	 * ordering/cap). `whitelist` matters here: the DTO'd query goes straight
	 * into a TypeORM `where`, so unknown params must be stripped, not passed.
	 *
	 * @param options
	 * @returns
	 */
	@ApiOperation({ summary: 'Find all Changelog.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found records',
		type: Changelog
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'No records found'
	})
	@Public()
	@Get('/')
	async findChangelog(
		@Query(new ValidationPipe({ transform: true, whitelist: true })) options: ChangelogQueryDTO
	): Promise<IPagination<IChangelog>> {
		return await this.changelogService.findAllChangelogs(options);
	}

	/**
	 *
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Create new record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Record has been successfully created.'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.SUPER_ADMIN)
	@Post('/')
	async create(@Body() entity: IChangelogCreateInput): Promise<IChangelog> {
		return await this.commandBus.execute(new ChangelogCreateCommand(entity));
	}

	/**
	 *
	 * @param id
	 * @param entity
	 * @returns
	 */
	@ApiOperation({ summary: 'Update record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Record has been successfully edited.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.SUPER_ADMIN)
	@Put('/:id')
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: IChangelogUpdateInput): Promise<IChangelog> {
		return await this.commandBus.execute(new ChangelogUpdateCommand({ ...entity, id }));
	}

	/**
	 * Overrides the inherited CRUD delete purely to attach the SUPER_ADMIN
	 * guard — the base route ships with class-level AuthGuard only.
	 *
	 * @param id
	 * @returns
	 */
	@ApiOperation({ summary: 'Delete record' })
	@ApiResponse({
		status: HttpStatus.NO_CONTENT,
		description: 'Record has been successfully deleted.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.SUPER_ADMIN)
	@Delete('/:id')
	async delete(@Param('id', UUIDValidationPipe) id: ID): Promise<DeleteResult> {
		return await this.changelogService.delete(id);
	}

	/**
	 * Same guard-only override for the inherited soft-delete route.
	 */
	@ApiOperation({ summary: 'Soft delete a record by ID' })
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'Record soft deleted successfully'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.SUPER_ADMIN)
	@Delete('/:id/soft')
	async softRemove(@Param('id', UUIDValidationPipe) id: ID): Promise<Changelog> {
		return await this.changelogService.softRemove(id);
	}

	/**
	 * Same guard-only override for the inherited soft-recover route.
	 */
	@ApiOperation({ summary: 'Restore a soft-deleted record by ID' })
	@ApiResponse({
		status: HttpStatus.ACCEPTED,
		description: 'Record restored successfully'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@UseGuards(RoleGuard)
	@Roles(RolesEnum.SUPER_ADMIN)
	@Put('/:id/recover')
	async softRecover(@Param('id', UUIDValidationPipe) id: ID): Promise<Changelog> {
		return await this.changelogService.softRecover(id);
	}
}
