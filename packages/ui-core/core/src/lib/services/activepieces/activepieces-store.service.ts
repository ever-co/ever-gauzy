import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
	ID,
	IActivepiecesConnection,
	IActivepiecesMcpServerPublic
} from '@gauzy/contracts';

@Injectable({
	providedIn: 'root'
})
export class ActivepiecesStoreService {
	// Selected integration ID
	private _selectedIntegrationId$: BehaviorSubject<string> = new BehaviorSubject(null);
	public selectedIntegrationId$: Observable<string> = this._selectedIntegrationId$.asObservable();

	// Connections state
	private _connections$: BehaviorSubject<IActivepiecesConnection[]> = new BehaviorSubject([]);
	public connections$: Observable<IActivepiecesConnection[]> = this._connections$.asObservable();

	// Current connection (single)
	private _currentConnection$: BehaviorSubject<IActivepiecesConnection> = new BehaviorSubject(null);
	public currentConnection$: Observable<IActivepiecesConnection> = this._currentConnection$.asObservable();

	// MCP Servers state
	private _mcpServers$: BehaviorSubject<IActivepiecesMcpServerPublic[]> = new BehaviorSubject([]);
	public mcpServers$: Observable<IActivepiecesMcpServerPublic[]> = this._mcpServers$.asObservable();

	// Current MCP Server (single)
	private _currentMcpServer$: BehaviorSubject<IActivepiecesMcpServerPublic> = new BehaviorSubject(null);
	public currentMcpServer$: Observable<IActivepiecesMcpServerPublic> = this._currentMcpServer$.asObservable();

	// Loading states
	private _isLoading$: BehaviorSubject<boolean> = new BehaviorSubject(false);
	public isLoading$: Observable<boolean> = this._isLoading$.asObservable();

	private _isMcpLoading$: BehaviorSubject<boolean> = new BehaviorSubject(false);
	public isMcpLoading$: Observable<boolean> = this._isMcpLoading$.asObservable();

	// Error states
	private _error$: BehaviorSubject<string> = new BehaviorSubject(null);
	public error$: Observable<string> = this._error$.asObservable();

	private _mcpError$: BehaviorSubject<string> = new BehaviorSubject(null);
	public mcpError$: Observable<string> = this._mcpError$.asObservable();

	// Project ID
	private _projectId$: BehaviorSubject<string> = new BehaviorSubject(null);
	public projectId$: Observable<string> = this._projectId$.asObservable();

	// Integration status
	private _isEnabled$: BehaviorSubject<boolean> = new BehaviorSubject(false);
	public isEnabled$: Observable<boolean> = this._isEnabled$.asObservable();

	/**
	 * Set the selected integration ID
	 */
	setSelectedIntegrationId(integrationId: ID): void {
		this._selectedIntegrationId$.next(integrationId);
	}

	/**
	 * Get the selected integration ID
	 */
	getSelectedIntegrationId(): string {
		return this._selectedIntegrationId$.getValue();
	}

	/**
	 * Set connections list
	 */
	setConnections(connections: IActivepiecesConnection[]): void {
		this._connections$.next(connections);
	}

	/**
	 * Get connections
	 */
	getConnections(): IActivepiecesConnection[] {
		return this._connections$.getValue();
	}

	/**
	 * Set current connection
	 */
	setCurrentConnection(connection: IActivepiecesConnection): void {
		this._currentConnection$.next(connection);
	}

	/**
	 * Get current connection
	 */
	getCurrentConnection(): IActivepiecesConnection {
		return this._currentConnection$.getValue();
	}

	/**
	 * Add a connection to the list
	 */
	addConnection(connection: IActivepiecesConnection): void {
		const currentConnections = this._connections$.getValue();
		this._connections$.next([...currentConnections, connection]);
	}

	/**
	 * Update a connection in the list
	 */
	updateConnection(connection: IActivepiecesConnection): void {
		const currentConnections = this._connections$.getValue();
		const updatedConnections = currentConnections.map((c) => (c.id === connection.id ? connection : c));
		this._connections$.next(updatedConnections);
	}

	/**
	 * Remove a connection from the list
	 */
	removeConnection(connectionId: string): void {
		const currentConnections = this._connections$.getValue();
		this._connections$.next(currentConnections.filter((c) => c.id !== connectionId));
	}

	/**
	 * Set MCP servers list
	 */
	setMcpServers(servers: IActivepiecesMcpServerPublic[]): void {
		this._mcpServers$.next(servers);
	}

	/**
	 * Get MCP servers
	 */
	getMcpServers(): IActivepiecesMcpServerPublic[] {
		return this._mcpServers$.getValue();
	}

	/**
	 * Set current MCP server
	 */
	setCurrentMcpServer(server: IActivepiecesMcpServerPublic): void {
		this._currentMcpServer$.next(server);
	}

	/**
	 * Get current MCP server
	 */
	getCurrentMcpServer(): IActivepiecesMcpServerPublic {
		return this._currentMcpServer$.getValue();
	}

	/**
	 * Add an MCP server to the list
	 */
	addMcpServer(server: IActivepiecesMcpServerPublic): void {
		const currentServers = this._mcpServers$.getValue();
		this._mcpServers$.next([...currentServers, server]);
	}

	/**
	 * Update an MCP server in the list
	 */
	updateMcpServer(server: IActivepiecesMcpServerPublic): void {
		const currentServers = this._mcpServers$.getValue();
		const updatedServers = currentServers.map((s) => (s.id === server.id ? server : s));
		this._mcpServers$.next(updatedServers);
	}

	/**
	 * Remove an MCP server from the list
	 */
	removeMcpServer(serverId: string): void {
		const currentServers = this._mcpServers$.getValue();
		this._mcpServers$.next(currentServers.filter((s) => s.id !== serverId));
	}

	/**
	 * Set loading state
	 */
	setLoading(loading: boolean): void {
		this._isLoading$.next(loading);
	}

	/**
	 * Get loading state
	 */
	getLoading(): boolean {
		return this._isLoading$.getValue();
	}

	/**
	 * Set MCP loading state
	 */
	setMcpLoading(loading: boolean): void {
		this._isMcpLoading$.next(loading);
	}

	/**
	 * Get MCP loading state
	 */
	getMcpLoading(): boolean {
		return this._isMcpLoading$.getValue();
	}

	/**
	 * Set error state
	 */
	setError(error: string): void {
		this._error$.next(error);
	}

	/**
	 * Get error state
	 */
	getError(): string {
		return this._error$.getValue();
	}

	/**
	 * Clear error state
	 */
	clearError(): void {
		this._error$.next(null);
	}

	/**
	 * Set MCP error state
	 */
	setMcpError(error: string): void {
		this._mcpError$.next(error);
	}

	/**
	 * Get MCP error state
	 */
	getMcpError(): string {
		return this._mcpError$.getValue();
	}

	/**
	 * Clear MCP error state
	 */
	clearMcpError(): void {
		this._mcpError$.next(null);
	}

	/**
	 * Set project ID
	 */
	setProjectId(projectId: string): void {
		this._projectId$.next(projectId);
	}

	/**
	 * Get project ID
	 */
	getProjectId(): string {
		return this._projectId$.getValue();
	}

	/**
	 * Set integration enabled status
	 */
	setEnabled(enabled: boolean): void {
		this._isEnabled$.next(enabled);
	}

	/**
	 * Get integration enabled status
	 */
	getEnabled(): boolean {
		return this._isEnabled$.getValue();
	}

	/**
	 * Clear all connections
	 */
	clearConnections(): void {
		this._connections$.next([]);
		this._currentConnection$.next(null);
	}

	/**
	 * Clear all MCP servers
	 */
	clearMcpServers(): void {
		this._mcpServers$.next([]);
		this._currentMcpServer$.next(null);
	}

	/**
	 * Reset store state
	 */
	reset(): void {
		this._selectedIntegrationId$.next(null);
		this._connections$.next([]);
		this._currentConnection$.next(null);
		this._mcpServers$.next([]);
		this._currentMcpServer$.next(null);
		this._isLoading$.next(false);
		this._isMcpLoading$.next(false);
		this._error$.next(null);
		this._mcpError$.next(null);
		this._projectId$.next(null);
		this._isEnabled$.next(false);
	}
}
