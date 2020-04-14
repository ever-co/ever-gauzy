import { Controller, UseGuards, Post, HttpStatus, Body } from '@nestjs/common';
import { ApiTags, ApiResponse, ApiOperation } from '@nestjs/swagger';
import { CrudController } from '../core/crud/crud.controller';
import { AuthGuard } from '@nestjs/passport';
import { PermissionGuard } from '../shared/guards/auth/permission.guard';
import { CandidateCv } from './candidate-cv.entity';
import { CandidateCvService } from './candidate-cv.service';
import { ICandidateCvCreateInput } from 'libs/models/src/lib/candidate-cv.model';
import { PermissionsEnum } from '@gauzy/models';
import { Permissions } from '../shared/decorators/permissions';

@ApiTags('CandidateCv')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class CandidateCvController extends CrudController<CandidateCv> {
	constructor(private readonly candidateCvService: CandidateCvService) {
		super(candidateCvService);
	}

	@ApiOperation({ summary: 'Create cv' })
	@ApiResponse({
		status: HttpStatus.CREATED,
		description: 'Records have been successfully created.' /*, type: T*/
	})
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@UseGuards(PermissionGuard)
	@Permissions(PermissionsEnum.ORG_CANDIDATES_EDIT)
	@Post('/createCv')
	async createCv(
		@Body() input: ICandidateCvCreateInput[],
		...options: any[]
	): Promise<CandidateCv[]> {
		return;
	}
}
