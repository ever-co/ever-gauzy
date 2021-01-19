import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller()
export class HomeController {
	@Get('/')
	async home(@Res() res: Response) {
		return res.status(HttpStatus.OK).json({
			status: HttpStatus.OK,
			message: `Gauzy API`
		});
	}
}
