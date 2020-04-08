import { Controller, Post, Body } from '@nestjs/common';
import { HubstaffService } from './hubstaff.service';
import { Observable } from 'rxjs';
import { IIntegration } from '@gauzy/models';

@Controller()
export class HubstaffController {
	constructor(private _hubstaffService: HubstaffService) {}

	@Post('/add-integration')
	addIntegration(@Body() body): Promise<IIntegration> {
		return this._hubstaffService.addIntegration(body);
	}

	@Post('/organizations')
	getOrganizations(@Body() token): Observable<any> {
		return this._hubstaffService.getOrganizations(token);
	}
}
