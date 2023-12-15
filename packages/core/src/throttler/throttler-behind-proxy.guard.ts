import { ThrottlerGuard } from '@nestjs/throttler';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
	protected getTracker(req: Record<string, any>): string {
		const tracker = req.ips.length > 0 ? req.ips[0] : req.ip;
		return tracker;
	}
}
