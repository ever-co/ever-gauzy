import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import * as moment from 'moment';
import { Public } from './../shared/decorators';

@Controller()
export class HomeController {
	
	@Get('/')
	@Public()
	async home(@Res() res: Response) {
		return res.status(HttpStatus.OK).json({
			status: HttpStatus.OK,
			message: `Gauzy API`
		});
	}

	@Get('/moment')
	@Public()
	async getMoment(@Res() res: Response) {
		return res.status(HttpStatus.OK).json({
			status: HttpStatus.OK,
			data: {
				timezone: `TIMEZONE (${moment.tz.guess()})`,
				date: `${moment()}`
			}
		});
	}
}
