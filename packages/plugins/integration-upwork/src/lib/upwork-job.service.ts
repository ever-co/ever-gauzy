import { Injectable, BadRequestException } from '@nestjs/common';
import * as UpworkApi from 'upwork-api';
import { Profile } from 'upwork-api/lib/routers/jobs/profile.js';
import { IUpworkApiConfig } from '@gauzy/contracts';

@Injectable()
export class UpworkJobService {
	/*
	 * Get job by key
	 * This call returns the complete job object by job key. It's only available for users with `manage_recruiting` permissions within the team that the job is posted in.
	 */
	public async getJobProfileByKey(config: IUpworkApiConfig, jobKey: string): Promise<any> {
		try {
			const api = new UpworkApi(config);
			const profile = new Profile(api);

			return new Promise((resolve, reject) => {
				api.setAccessToken(config.accessToken, config.accessSecret, () => {
					profile.getSpecific(jobKey, (error: any, data: any) => (error ? reject(error) : resolve(data)));
				});
			});
		} catch (error) {
			throw new BadRequestException('Cannot get job by key');
		}
	}
}
