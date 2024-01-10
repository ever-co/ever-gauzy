import { ThrottlerGuard } from '@nestjs/throttler';
import { Injectable } from '@nestjs/common';
import { environment } from '@gauzy/config';

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
	protected async getTracker(req: Record<string, any>): Promise<string> {
		let tracker: string;

		// Handle Cloudflare proxy
		if (req.headers && req.headers['cf-connecting-ip']) {
			if (req.headers['cf-connecting-ip'].split(', ').length) {
				var first = req.headers['cf-connecting-ip'].split(', ');
				tracker = first[0];
				if (!environment.production) {
					console.log(`Cloudflare Request IP: ${tracker}`);
				}
			} else {
				tracker = req.ips.length > 0 ? req.ips[0] : req.ip;
				if (!environment.production && tracker !== '::1') {
					console.log(`Request IP: ${tracker}`);
				}
			}
		} else {
			tracker = req.ips.length > 0 ? req.ips[0] : req.ip;
			if (!environment.production && tracker !== '::1') {
				console.log(`Request IP: ${tracker}`);
			}
		}

		return tracker;
	}
}
