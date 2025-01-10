/**
 * Enum representing the supported grant types for authentication.
 */
export enum GrantType {
    /**
     * User provides username and password for authentication.
     */
    Password = 'password',

    /**
     * Application authenticates itself using client ID and secret.
     */
    ClientCredentials = 'client_credentials',
}
