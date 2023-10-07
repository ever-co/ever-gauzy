/**
 * Represents a configuration object for Jitsu server settings.
 */
export interface IJitsuConfig {
    /**
     * API Host. Default value: same host as script origin
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
