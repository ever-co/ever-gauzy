import {
	Controller,
	UseGuards,
	Post,
	HttpStatus,
	Body,
	Get,
	Query
} from '@nestjs/common';
import { ApiTags, ApiResponse, ApiOperation } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { AuthGuard } from '@nestjs/passport';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { CandidateCv } from './candidate-cv.entity';
import { CandidateCvService } from './candidate-cv.service';
import { ICandidateCvCreateInput } from 'libs/models/src/lib/candidate-cv.model';

@ApiTags('CandidateDocks')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class CandidateCvController extends CrudController<CandidateCv> {
	constructor(private readonly candidateCvService: CandidateCvService) {
		super(candidateCvService);
	}
	candidate: import('../candidate/candidate.entity').Candidate;
	id?: string;
	name?: string;
	candidateId: string;
	cvUrl?: string;
	createdAt?: Date;
	updatedAt?: Date;

	@ApiOperation({ summary: 'Create records in Bulk' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Records have been successfully created.' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	// @UseGuards(PermissionGuard)
	// @Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@Post()
	async createBulk(
		@Body() input: ICandidateCvCreateInput[],
		...options: any[]
	): Promise<CandidateCv[]> {
		return;
	}

	@ApiOperation({ summary: 'Find all organizations.' })
	@ApiResponse({
		status: HttpStatus.OK,
		description: 'Found organizations',
		type: CandidateCv
	})
	@ApiResponse({
		status: HttpStatus.NOT_FOUND,
		description: 'Record not found'
	})
	// @UseGuards(PermissionGuard)
	// @Permissions(PermissionsEnum.ALL_ORG_VIEW)
	@Get()
	async findAll(): // @Query('data') data: string
	Promise<any> {
		// const { relations, findInput } = JSON.parse(data);
		return; // this.candidateCVService.findAll({ where: findInput, relations });
	}
}
