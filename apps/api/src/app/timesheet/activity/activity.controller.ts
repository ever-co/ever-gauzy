import {
	Controller,
	UseGuards,
	HttpStatus,
	Get,
	Query,
	Post,
	Body
} from '@nestjs/common';
import { Activity } from '../activity.entity';
import { CrudController } from '../../core/crud/crud.controller';
import { ActivityService } from './activity.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { IGetActivitiesInput, IBulkActivitiesInput } from '@gauzy/models';

@ApiTags('Activity')
@UseGuards(AuthGuard('jwt'))
@Controller('activity')
export class ActivityController extends CrudController<Activity> {
	constructor(private readonly activityService: ActivityService) {
		super(activityService);
	}

	@ApiOperation({ summary: 'Get Activities' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('/')
	async getActivities(@Query() request: IGetActivitiesInput) {
		const defaultParams: Partial<IGetActivitiesInput> = {
			page: 0,
			limit: 30
		};
		request = Object.assign({}, defaultParams, request);
		return this.activityService.getActivities(request);
	}

	@ApiOperation({ summary: 'Get Daily Activities' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('/daily')
	async getDailyActivities(@Query() request: IGetActivitiesInput) {
		return this.activityService.getDailyActivities(request);
	}

	@ApiOperation({ summary: 'Save bulk Activities' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('/bulk')
	async bulkSaveActivities(@Body() entities: IBulkActivitiesInput) {
		return this.activityService.bulkSave(entities.activities);
	}
}
