import { LocalStore } from '../../desktop-store';
import { INetworkState } from '../../interfaces';
import { FetchCommand } from '../../utils';

interface IGauzyAPIResponse {
	status: number;
	message: string;
}

/**
 * Represents a class responsible for checking the connectivity with the API server.
 * Implements the INetworkState interface.
 */
export class ApiServerConnectivity implements INetworkState {
	/**
	 * Checks if the connection with the API server is established.
	 * @returns A promise that resolves to a boolean indicating the connectivity status.
	 */
	public async established(): Promise<boolean> {
		try {
			// Retrieve the server URL from the LocalStore
			const serverUrl = `${LocalStore.getServerUrl()}/api`;
			// Create a curl command
			const command = new FetchCommand(serverUrl);
			// Make a GET request to the server
			const response = await command.execute<IGauzyAPIResponse>();
			// Check responses
			console.info('stderr', response?.stderr);
			// Check responses
			console.info('stdout', response?.stdout);
			// Check if response data is not empty or falsy
			return response?.stdout?.status === 200;
		} catch (error) {
			// Log any errors that occur during the request
			console.error('[ApiServerConnectivity]:', error);
			return false;
		}
	}
}
