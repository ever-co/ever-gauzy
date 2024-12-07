import { registerAs } from '@nestjs/config';

/**
 * Application Configuration
 *
 * Defines configuration settings for the application using the @nestjs/config library.
 * This configuration includes properties such as the application name and logo URL.
 * The configuration values are retrieved from environment variables, with default values provided.
 *
 * @returns An object representing the application configuration.
 */
export default registerAs('app', () => ({
    /**
     * The name of the application.
     * If not provided through the environment variable APP_NAME, defaults to 'Gauzy'.
     */
    app_name: process.env.APP_NAME || 'Gauzy',

    /**
     * The URL of the application's logo.
     * If not provided through the environment variable APP_LOGO,
     * defaults to a URL constructed using the CLIENT_BASE_URL environment variable.
     */
    app_logo: process.env.APP_LOGO || `${process.env.CLIENT_BASE_URL}/assets/images/logos/logo_Gauzy.png`,
}));
