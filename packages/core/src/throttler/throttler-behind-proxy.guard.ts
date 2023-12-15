import { ThrottlerGuard } from '@nestjs/throttler';
import { Injectable } from '@nestjs/common';
import { environment } from '@gauzy/config';

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
	protected getTracker(req: Record<string, any>): string {
		const tracker = req.ips.length > 0 ? req.ips[0] : req.ip;
		if (!environment.production) {
			console.log(`Request IP: ${tracker}`);
		}

		return tracker;
	}
}
