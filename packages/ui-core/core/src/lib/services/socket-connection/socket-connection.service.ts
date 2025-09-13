import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Router } from '@angular/router';
import { environment } from '@gauzy/ui-config';
import { Store } from '../store/store.service';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SocketConnectionService {
	// Socket instance for real-time communication
	public socket: Socket;
	public connected$ = new BehaviorSubject<boolean>(false);

	constructor(private readonly store: Store, private readonly router: Router) {}

	/**
	 * Initialize Socket.IO connection with authentication headers and reconnection logic
	 * Sockets are used to avoid excessive polling which crashes or overloads the backend server.
	 * The current implementation listens to timer status updates only.
	 * The architecture can be extended to listen to other events in the future.
	 */
	public connect(): void {
		const token = this.store.token;
		const baseUrl = environment.API_BASE_URL;

		if (this.socket && this.socket.connected) {
			console.log('⚠️ Socket already connected, skipping...');
			return;
		}

		// If no token is available, redirect to the login page
		if (!token) {
			console.warn('No token found, redirecting to login...');
			this.router.navigate(['/auth/login']);
			return;
		}

		this.socket = io(baseUrl, {
			extraHeaders: { Authorization: `Bearer ${token}` },
			reconnection: true, // enable automatic reconnection
			reconnectionAttempts: Infinity, // retry indefinitely
			reconnectionDelay: 2000, // initial delay between reconnection attempts
			reconnectionDelayMax: 10000, // max delay for reconnections
			timeout: 10000 // connection timeout
		});

		// Log when the socket is successfully connected
		this.socket.on('connect', () => {
			this.connected$.next(true);
			const url = new URL(baseUrl);
			console.log(
				`Socket connected with ID: ${this.socket.id} | Host: ${url.hostname} | Port: ${url.port || 'default'}`
			);
		});

		// Log socket disconnections
		this.socket.on('disconnect', (reason) => {
			this.connected$.next(false);
			console.warn('Socket disconnected:', reason);
		});
	}
}
