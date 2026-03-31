/**
 * Interface for SIM (Sim Studio) Integration Configuration
 */
export interface ISimConfig {
	/**
	 * Default API key for authenticating SIM API calls (optional global fallback)
	 */
	readonly apiKey?: string;
}
