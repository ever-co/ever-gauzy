import { Module } from '@nestjs/common';
import { SocketGateway } from './socket.gateway';
import { SocketService } from './socket.service';

/**
 * SocketModule bundles WebSocket gateway and service.
 * Exporting SocketService allows other modules to send real-time events.
 */
@Module({
	providers: [SocketGateway, SocketService],
	exports: [SocketService]
})
export class SocketModule {}
