/**
 * Represents a configuration object for Jitsu server settings.
 */
export interface IJitsuConfig {
    /**
     * The host address of the Jitsu server.
     */
    readonly serverHost: string;

    /**
     * The write key for authenticating with the Jitsu server.
     */
    readonly serverWriteKey: string;

    /**
     * Whether to enable debug mode.
     */
    readonly debug: boolean;

    /**
     * Whether to echo events.
     */
    readonly echoEvents: boolean;
}
