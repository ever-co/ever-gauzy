import { Controller, UseGuards } from '@nestjs/common';
import { Activity } from '../activity.entity';
import { CrudController } from '../../core/crud/crud.controller';
import { ActivityService } from './activity.service';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Activity')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class ActivityController extends CrudController<Activity> {
	constructor(private readonly activityService: ActivityService) {
		super(activityService);
	}
}
