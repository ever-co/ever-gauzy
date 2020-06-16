import {
	Controller,
	HttpStatus,
	Get,
	Post,
	Body,
	HttpCode,
	Put,
	Param,
	UseGuards
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { KeyResult } from './keyresult.entity';
import { CrudController } from '../core';
import { AuthGuard } from '@nestjs/passport';
import { KeyResultService } from './keyresult.service';

@ApiTags('KeyResults')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class KeyResultController extends CrudController<KeyResult> {
	constructor(private readonly keyResultService: KeyResultService) {
		super(keyResultService);
	}

	@ApiOperation({ summary: 'Find all keyresults.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found keyresults',
		type: KeyResult
	})
	@Post('/create')
	async createKeyResult(@Body() entity: KeyResult): Promise<any> {
		console.log('hello');
		return this.keyResultService.create(entity);
	}

	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	@Get(':id')
	async getAll(@Param('id') findInput: string) {
		return this.keyResultService.findAll({ where: { goalId: findInput } });
	}

	@ApiOperation({ summary: 'Update an existing record' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'The record has been successfully edited.'
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
		@Param('id') id: string,
		@Body() entity: KeyResult
	): Promise<KeyResult> {
		//We are using create here because create calls the method save()
		//We need save() to save ManyToMany relations
		try {
			return this.keyResultService.create({
				id,
				...entity
			});
		} catch (error) {
			console.log(error);
			return;
		}
	}
}
