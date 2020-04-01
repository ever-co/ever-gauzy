import { Controller, Post, Body } from '@nestjs/common';
import { HubstaffService } from './hubstaff.service';
import { Observable } from 'rxjs';

@Controller()
export class HubstaffController {
	constructor(private _hubstaffService: HubstaffService) {}

	@Post('/access-tokens')
	getAccessTokens(@Body() body): Observable<any> {
		return this._hubstaffService.getAccessTokens(body);
	}

	@Post('/organizations')
	getOrganizations(@Body() token): Observable<any> {
		return this._hubstaffService.getOrganizations(token);
	}
}
