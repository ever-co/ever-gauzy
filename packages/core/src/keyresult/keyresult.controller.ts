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
	Delete
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { KeyResult } from './keyresult.entity';
import { CrudController } from './../core/crud';
import { KeyResultService } from './keyresult.service';
import { TenantPermissionGuard } from './../shared/guards';
import { UUIDValidationPipe } from './../shared/pipes';

@ApiTags('KeyResults')
@UseGuards(TenantPermissionGuard)
@Controller()
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
	@Post('/create')
	async createKeyResult(@Body() entity: KeyResult): Promise<any> {
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
	@Post('/createBulk')
	async createBulkKeyResults(@Body() entity: KeyResult[]): Promise<any> {
		return this.keyResultService.createBulk(entity);
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
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@HttpCode(HttpStatus.ACCEPTED)
	@Put(':id')
	async update(
		@Param('id', UUIDValidationPipe) id: string,
		@Body() entity: KeyResult
	): Promise<KeyResult> {
		//We are using create here because create calls the method save()
		//We need save() to save ManyToMany relations
		try {
			return await this.keyResultService.create({
				id,
				...entity
			});
		} catch (error) {
			console.log(error);
			return;
		}
	}

	@HttpCode(HttpStatus.ACCEPTED)
	@Delete(':id')
	async deleteKeyResult(@Param('id', UUIDValidationPipe) id: string): Promise<any> {
		return this.keyResultService.delete(id);
	}
}
