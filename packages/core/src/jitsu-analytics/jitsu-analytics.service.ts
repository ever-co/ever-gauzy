import { Injectable, Logger } from '@nestjs/common';
import { AnalyticsInterface, jitsuAnalytics } from '@jitsu/js';
import { environment } from '@gauzy/config';

@Injectable()
export class JitsuAnalyticsService {
	private logger = new Logger(JitsuAnalyticsService.name);
	jitsuClient: AnalyticsInterface = jitsuAnalytics({
		host: environment.JITSU_SERVER_HOST || '',
		writeKey: environment.JITSU_SERVER_WRITE_KEY || '',
		debug: false,
		echoEvents: false,
	});
	constructor() {}

	async track(
		event: string,
		properties?: Record<string, any> | null
	): Promise<any> {
		this.logger.log(
			`Jitsu Tracking Entity Events`,
			JSON.stringify(properties)
		);
		return await this.jitsuClient.track(event, properties);
	}
}
