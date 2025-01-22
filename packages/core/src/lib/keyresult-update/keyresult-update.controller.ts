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
	Query,
	Delete
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CrudController } from './../core/crud';
import { KeyResultUpdate } from './keyresult-update.entity';
import { KeyResultUpdateService } from './keyresult-update.service';
import { IKeyResultUpdate } from '@gauzy/contracts';
import { ParseJsonPipe, UUIDValidationPipe, UseValidationPipe } from './../shared/pipes';
import { CommandBus } from '@nestjs/cqrs';
import { KeyResultUpdateBulkDeleteCommand } from './commands';
import { TenantPermissionGuard } from './../shared/guards';
import { CreateKeyresultUpdateDTO, UpdateKeyresultUpdateDTO } from './dto';

@ApiTags('KeyResultsUpdate')
@UseGuards(TenantPermissionGuard)
@Controller('/key-result-updates')
export class KeyResultUpdateController extends CrudController<KeyResultUpdate> {
	constructor(
		private readonly commandBus: CommandBus,
		private readonly keyResultUpdateService: KeyResultUpdateService
	) {
		super(keyResultUpdateService);
	}

	@ApiOperation({ summary: 'Create an update' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Update created',
		type: KeyResultUpdate
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post()
	@UseValidationPipe({ transform: true })
	async create(@Body() entity: CreateKeyresultUpdateDTO): Promise<IKeyResultUpdate> {
		return this.keyResultUpdateService.create(entity);
	}

	@ApiOperation({ summary: 'Get all updates of keyresult' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found updates',
		type: KeyResultUpdate
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Updates not found'
	})
	@Get(':id')
	async getAll(@Param('id') id: string) {
		return this.keyResultUpdateService.findAll({
			where: { keyResultId: id },
			relations: ['keyResult']
		});
	}

	@ApiOperation({ summary: 'Update an existing keyresult update' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The update has been successfully edited.'
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Update not found'
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description: 'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	@UseValidationPipe({ transform: true })
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: UpdateKeyresultUpdateDTO
	): Promise<IKeyResultUpdate> {
		//We are using create here because create calls the method save()
		//We need save() to save ManyToMany relations
		try {
			return await this.keyResultUpdateService.create({
				id,
				...entity
			});
		} catch (error) {
			console.log(error);
			return;
		}
	}

	@ApiOperation({
		summary: 'Delete updates by Key Result Id'
	})
	@ApiResponse({
		status: HttpStatus.OK,
		description: "Found key result's updates",
		type: KeyResultUpdate
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'updates not found'
	})
	@Delete('deleteBulkByKeyResultId')
	async deleteBulkByKeyResultId(@Query('data', ParseJsonPipe) data: any): Promise<any> {
		const { id = null } = data;
		return this.commandBus.execute(new KeyResultUpdateBulkDeleteCommand(id));
	}
}
