import { Injectable, Scope, Logger } from '@nestjs/common';

/**
 * Convert bytes to Mb
 * @param bytes - The number of bytes to convert
 * @returns The number of Mb
 */
function bytesToMb(bytes: number): number {
	return Math.round((bytes / 1024 / 1024) * 100) / 100;
}

@Injectable({ scope: Scope.DEFAULT })
export class MemoryMetric {
	private static instance: MemoryMetric;
	private readonly logger: Logger;

	constructor() {
		this.logger = new Logger('MemoryMetric');
		this.logger.debug('MemoryMetric initialized');
		MemoryMetric.instance = this;
	}

	/**
	 * Get the shared instance of the MemoryMetric class.
	 * @returns The shared instance of the MemoryMetric class.
	 */
	static get shared(): MemoryMetric {
		if (!MemoryMetric.instance) {
			MemoryMetric.instance = new MemoryMetric();
		}
		return MemoryMetric.instance;
	}

	/**
	 * Log the current memory usage
	 * @param label - The label to log the memory usage for
	 */
	public logStatus(label: string): void {
		const memoryUsage = process.memoryUsage();
		this.logger.debug(
			`Memory Usage (${label}): [Heap Used: ${bytesToMb(memoryUsage.heapUsed)}Mb, Heap Total: ${bytesToMb(
				memoryUsage.heapTotal
			)}Mb, RSS: ${bytesToMb(memoryUsage.rss)}Mb, External: ${bytesToMb(
				memoryUsage.external
			)}Mb, Array Buffers: ${bytesToMb(memoryUsage.arrayBuffers)}Mb]`
		);
	}
}
