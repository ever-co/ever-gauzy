import {
	HttpHealthIndicator,	
	TypeOrmHealthIndicator
} from '@nestjs/terminus';

export const getTerminusOptions = (
	db: TypeOrmHealthIndicator,
	http: HttpHealthIndicator
) => ({
	endpoints: [
		{
			// The health check will be available with /health
			url: '/health',
			// All the indicator which will be checked when requesting /health
			healthIndicators: [
				async () => http.pingCheck('google', 'https://google.com'),
				async () => db.pingCheck('database', { timeout: 30000 })
			]
		}
	]
});
