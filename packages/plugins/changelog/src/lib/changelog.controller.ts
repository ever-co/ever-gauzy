import {
	Controller,
	HttpStatus,
	Get,
	UseGuards,
	HttpCode,
	Post,
	Body,
	Param,
	Put,
	Query,
	ValidationPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { IChangelog, IChangelogCreateInput, IChangelogUpdateInput, ID, IPagination } from '@gauzy/contracts';
import { AuthGuard, CrudController, UUIDValidationPipe } from '@gauzy/core';
import { Public } from '@gauzy/common';
import { Changelog } from './changelog.entity';
import { ChangelogService } from './changelog.service';
import { ChangelogCreateCommand, ChangelogUpdateCommand } from './commands';
import { ChangelogQueryDTO } from './dto/changelog-query.dto';

@ApiTags('Changelog')
@UseGuards(AuthGuard)
@Controller('/changelog')
export class ChangelogController extends CrudController<Changelog> {
	constructor(private readonly changelogService: ChangelogService, private readonly commandBus: CommandBus) {
		super(changelogService);
	}

	/**
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
		@Query(new ValidationPipe({ transform: true })) options: ChangelogQueryDTO
	): Promise<IPagination<IChangelog>> {
		return await this.changelogService.findAllChangelogs({ where: options });
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
	@Put('/:id')
	async update(@Param('id', UUIDValidationPipe) id: ID, @Body() entity: IChangelogUpdateInput): Promise<IChangelog> {
		return await this.commandBus.execute(new ChangelogUpdateCommand({ ...entity, id }));
	}
}
