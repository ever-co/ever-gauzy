import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Store } from './store.service';

interface IConnectionStatus {
	status: number;
}

@Injectable({
	providedIn: 'root' // Better practice for service registration
})
export class ServerConnectionService {
	private readonly CONNECTION_ENDPOINT = '/api';
	private readonly LOCALHOST_URL = 'http://localhost:3000';

	constructor(private readonly httpClient: HttpClient, private readonly store: Store) {}

	/**
	 * Checks the server connection status
	 * @param endPoint The server endpoint to check
	 * @returns Promise<boolean> Resolves with true if connection is successful or user is already authenticated, false otherwise
	 */
	async checkServerConnection(endPoint: string): Promise<boolean> {
		if (endPoint === this.LOCALHOST_URL) {
			this.handleLocalhostSkip(endPoint);
			return true;
		}

		const url = this.buildConnectionUrl(endPoint);
		this.logConnectionAttempt(url);

		try {
			const response = await this.attemptServerConnection(url);
			return this.handleSuccessfulConnection(response, url);
		} catch (error) {
			return this.handleConnectionError(error as HttpErrorResponse, url);
		}
	}

	private buildConnectionUrl(endPoint: string): string {
		return `${endPoint}${this.CONNECTION_ENDPOINT}`;
	}

	private logConnectionAttempt(url: string): void {
		console.debug(`Checking server connection to URL: ${url}`);
	}

	private async attemptServerConnection(url: string): Promise<IConnectionStatus> {
		const request$ = this.httpClient.get<IConnectionStatus>(url);
		if (!request$) {
			throw new Error('Failed to create HTTP request observable');
		}
		return firstValueFrom(request$);
	}

	private handleSuccessfulConnection(response: IConnectionStatus, url: string): boolean {
		if (!response) {
			console.warn('Server connection response empty');
			return false;
		}

		this.store.serverConnection = response.status;
		console.debug(`Server connection successful for URL: ${url}`, response.status);
		return true;
	}

	private async handleConnectionError(error: HttpErrorResponse, url: string): Promise<boolean> {
		console.error(`Server connection error for URL: ${url}`, error);

		if (this.store.userId) {
			console.warn(`Using cached user session (userId: ${this.store.userId}) despite connection error`);
			return true;
		}

		this.store.serverConnection = 0;
		throw error; // Re-throw for the caller to handle if needed
	}

	private handleLocalhostSkip(endPoint: string): void {
		console.debug(`Skipping server connection check for localhost URL: ${endPoint}`);
		this.store.serverConnection = 200;
	}
}
