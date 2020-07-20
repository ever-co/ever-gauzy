import {
	Controller,
	UseGuards,
	HttpStatus,
	Get,
	Query,
	Post
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

	@ApiOperation({ summary: 'Get Activites' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Get('/')
	async getActivites(@Query() request: IGetActivitiesInput) {
		const defaultParams: Partial<IGetActivitiesInput> = {
			page: 0,
			limit: 30
		};

		request = Object.assign({}, defaultParams, request);

		return this.activityService.getActivites(request);
	}

	@ApiOperation({ summary: 'Save bulk Activites' })
	@ApiResponse({
		status: HttpStatus.BAD_REQUEST,
		description:
			'Invalid input, The response body may contain clues as to what went wrong'
	})
	@Post('/bulk')
	async bulkSaveActivites(@Query() request: IBulkActivitiesInput) {
		return this.activityService.bulkSave(request.activities);
	}
}
