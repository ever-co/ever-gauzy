import { Controller, UseGuards, HttpStatus, Get, Query } from '@nestjs/common';
import { Activity } from '../activity.entity';
import { CrudController } from '../../core/crud/crud.controller';
import { ActivityService } from './activity.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { IGetActivitiesInput } from '@gauzy/models';

@ApiTags('Activity')
@UseGuards(AuthGuard('jwt'))
@Controller('activity')
export class ActivityController extends CrudController<Activity> {
	constructor(private readonly activityService: ActivityService) {
		super(activityService);
	}

	@ApiOperation({ summary: 'Get Activites' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('/')
	async getActivites(@Query() request: IGetActivitiesInput) {
		return this.activityService.getActivites(request);
	}
}
