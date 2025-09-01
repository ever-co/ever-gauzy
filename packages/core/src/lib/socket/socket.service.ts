import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';

/**
 * SocketService manages connected clients and provides
 * methods to emit real-time events to them.
 *
 * Now supports multiple sockets per clientKey (e.g. user opened app
 * in multiple browsers or tabs).
 *
 * This service is still in-memory — for scaling with multiple server
 * instances you should use a shared adapter (e.g. Redis).
 */
@Injectable()
export class SocketService {
	/**
	 * In-memory map of connected clients.
	 * Each clientKey (e.g. employeeId, userId, tenantId) can have multiple sockets.
	 */
	private readonly clients = new Map<string, Set<Socket>>();

	/**
	 * Register a client under a given identifier (clientKey).
	 * Supports multiple sockets per clientKey.
	 */
	registerClient(clientKey: string, socket: Socket): void {
		if (!this.clients.has(clientKey)) {
			this.clients.set(clientKey, new Set());
		}
		this.clients.get(clientKey).add(socket);
	}

	/**
	 * Remove a client socket by its socket ID.
	 * Cleans up empty sets when last socket disconnects.
	 */
	removeClient(socketId: string): void {
		for (const [key, sockets] of this.clients.entries()) {
			for (const socket of sockets) {
				if (socket.id === socketId) {
					sockets.delete(socket);
					if (sockets.size === 0) {
						this.clients.delete(key);
					}
					return;
				}
			}
		}
	}

	/**
	 * Emit a "timer:changed" event to all sockets of a single client.
	 */
	sendTimerChanged(clientKey: string): void {
		const sockets = this.clients.get(clientKey);
		if (sockets) {
			sockets.forEach((socket) => {
				if (socket.connected) {
					socket.emit('timer:changed');
				}
			});
		}
	}

	/**
	 * Emit "timer:changed" event to multiple clients.
	 */
	sendTimerChangedMany(clientKeys: string[]): void {
		clientKeys.forEach((key) => this.sendTimerChanged(key));
	}

	/**
	 * Generic event emitter to all sockets of a single client.
	 */
	emitToClient(clientKey: string, event: string, payload: any): void {
		const sockets = this.clients.get(clientKey);
		if (sockets) {
			sockets.forEach((socket) => {
				if (socket.connected) {
					socket.emit(event, payload);
				}
			});
		}
	}

	/**
	 * Broadcast event to all connected clients.
	 */
	broadcast(event: string, payload: any): void {
		this.clients.forEach((sockets) => {
			sockets.forEach((socket) => {
				if (socket.connected) {
					socket.emit(event, payload);
				}
			});
		});
	}
}
