import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
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
}
