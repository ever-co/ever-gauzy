import { ConfigService } from '@gauzy/config';
import { Controller } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
	constructor(
		private readonly appService: AppService,
		private readonly configSerice: ConfigService
	) {
		console.log('config', this.configSerice);
	}
}
