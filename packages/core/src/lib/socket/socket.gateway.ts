import {
	WebSocketGateway,
	WebSocketServer,
	OnGatewayConnection,
	OnGatewayDisconnect,
	ConnectedSocket
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { environment } from '@gauzy/config';
import * as jwt from 'jsonwebtoken';
import { Injectable } from '@nestjs/common';
import { SocketService } from './socket.service';

/**
 * Gateway is responsible only for handling socket lifecycle events:
 * - client connection
 * - authentication
 * - disconnection
 *
 * It delegates all state management and event emission to SocketService.
 */
@WebSocketGateway({ cors: { origin: '*' }, pingInterval: 60000, pingTimeout: 120000 }) // TODO: configure proper CORS for production
@Injectable()
export class SocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
	@WebSocketServer()
	server: Server;

	constructor(private readonly socketService: SocketService) {}

	/**
	 * Called whenever a client attempts to establish a socket connection.
	 * Validates JWT and registers the client in the SocketService.
	 */
	handleConnection(@ConnectedSocket() client: Socket): void {
		const token = (client.handshake.headers['authorization'] as string)?.split(' ')[1];

		if (!token) {
			console.warn('No JWT token provided. Disconnecting client.');
			client.disconnect();
		}

		try {
			const payload: any = jwt.verify(token, environment.JWT_SECRET);

			/**
			 * IMPORTANT:
			 * Here you can decide which identifier you want to use:
			 * - payload.userId
			 * - payload.employeeId
			 * - payload.tenantId
			 *
			 * For now we call it `clientKey` so it’s flexible.
			 */
			const clientKey = payload.employeeId;

			this.socketService.registerClient(clientKey, client);
			console.log(`✅ Client connected via socket ${client.id}`);
		} catch (err) {
			console.warn('Invalid JWT token. Disconnecting client.');
			client.disconnect();
		}
	}

	/**
	 * Called whenever a client disconnects.
	 * Removes the client from SocketService storage.
	 */
	handleDisconnect(@ConnectedSocket() client: Socket): void {
		this.socketService.removeClient(client.id);
		console.log(`❌ Socket ${client.id} disconnected`);
	}
}
