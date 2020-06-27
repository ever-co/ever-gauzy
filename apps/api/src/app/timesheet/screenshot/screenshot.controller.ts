import { Controller, UseGuards } from '@nestjs/common';
import { Screenshot } from '../screenshot.entity';
import { CrudController } from '../../core/crud/crud.controller';
import { ScreenshotService } from './screenshot.service';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Screenshot')
@UseGuards(AuthGuard('jwt'))
@Controller()
export class ScreenshotController extends CrudController<Screenshot> {
	constructor(private readonly screenshotService: ScreenshotService) {
		super(screenshotService);
	}
}
