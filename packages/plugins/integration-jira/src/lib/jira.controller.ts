import { Public } from '@gauzy/common';
import { Body, Controller, Get, Post, Type } from '@nestjs/common';
import { JiraModuleOptions } from './jira.types';

/**
 * Factory function to create a NestJS controller class for handling webhook hooks.
 * @param path The path at which the controller should listen for webhook requests.
 */
export function getControllerClass({ path, config }: JiraModuleOptions): Type<any> {
	@Public()
	@Controller(path)
	class HookController {
		/**
		 * General schema can be seen here: https://bitbucket.org/atlassian/connect-schemas/raw/master/jira-global-schema.json
		 */
		connectAppDescriptor = {
			/**
			 * Name of the Connect app
			 */
			name: config.appName || 'Atlassian Connect Example Node App',

			/**
			 * Description for the Connect app
			 */
			description: config.appDescription || 'Atlassian Connect Example Node App',

			/**
			 *  A unique key to identify your Connect app. This key must be <= 64 characters.
			 */
			// key: envVars.APP_KEY,
			key: config.appKey || 'com.example.node-connect-app',

			/**
			 * The base url of the server, which is used for all communications between Connect and the app.
			 *
			 * The tunneled URL which is set in the `prestart.ts`
			 */
			baseUrl: config.baseUrl,

			/**
			 * The vendor who is offering this Connect app.
			 */
			vendor: {
				name: config.vendorName,
				url: config.vendorUrl
			},

			/**
			 * Defines the authentication type to use when signing requests between the host application and the Connect app.
			 * Types include: `jwt`, `JWT`, `none`, `NONE`
			 *
			 * Pages defined in the Connect app(by default) run within the iframe inside Jira,
			 * Defining this authentication will pass the JWT token for each page running within the iframe.
			 */
			authentication: {
				type: 'jwt'
			},

			/**
			 * Sets the scopes requested by the app
			 * https://developer.atlassian.com/cloud/jira/platform/scopes-for-connect-apps/
			 */
			scopes: ['READ', 'WRITE'],

			/**
			 * The API version is an OPTIONAL integer. If omitted we will infer an API version of 1.
			 */
			apiVersion: 1,

			/**
			 * Allows an app to register callbacks for events that occur in the lifecycle of an installation.
			 * When a lifecycle event is fired, a POST request will be made to the appropriate URL registered for the event.
			 *
			 * https://developer.atlassian.com/cloud/jira/platform/connect-app-descriptor/#lifecycle
			 *
			 */
			lifecycle: {
				installed: '/api/jira/installed',
				uninstalled: '/api/jira/uninstalled'
			},

			/**
			 * Extensions for the different parts of Jira
			 * like links, panels, pages, permissions, workflows etc.
			 */
			modules: {
				/**
				 * This is the first page where the user lands after clicking on the `Get Started` link after installing the app
				 * You can think of this page as the main index page for the app.
				 */
				postInstallPage: {
					url: '/pages/get-started',
					key: 'get-started',
					name: {
						value: 'Get Started'
					}
				},

				/**
				 * Defines the new sections in the application menus.
				 *
				 * https://developer.atlassian.com/cloud/jira/platform/modules/web-section/
				 */
				webSections: [
					{
						key: 'connect-node-app-section',
						location: 'admin_plugins_menu',
						weight: 0,
						name: {
							value: 'Connect Example Node App'
						}
					}
				],

				/**
				 * The list of pages/views within the app.
				 * https://developer.atlassian.com/cloud/jira/software/modules/page/
				 */
				generalPages: [
					{
						/**
						 * The url to retrieve the content from. This must be relative to the add-on's baseUrl.
						 */
						url: '/pages/introduction',
						/**
						 * A key to identify this module.
						 * The key is used to generate the url to your add-on's module.
						 * The url is generated as a combination of your add-on key and module key.
						 *
						 * For instance:
						 * The node app URL `https://<TUNNELED_URL>/config` is now mapped to `https://<JIRAHOST_INSTANCE>/plugins/servlet/ac/com.example.node-connect-app/config`
						 */
						key: 'introduction',

						/**
						 * Defines the location in the application interface where the page's link should appear.
						 * For finding locations, please use these web fragment finders:
						 * Jira -> https://marketplace.atlassian.com/apps/1211656/web-fragment-finder?hosting=cloud&tab=overview
						 * Confluence -> https://marketplace.atlassian.com/apps/1215092/web-fragment-finder-for-confluence?hosting=cloud&tab=overview
						 */
						location: 'admin_plugins_menu/connect-node-app-section',
						/**
						 * A human-readable name for the page.
						 */
						name: {
							value: 'Introduction'
						}
					},
					{
						url: '/pages/config',
						key: 'config',
						location: 'admin_plugins_menu/connect-node-app-section',
						name: {
							value: 'Connect JSON Manifest'
						}
					},
					{
						url: '/pages/lifecycle-events',
						key: 'lifecycle-events',
						location: 'admin_plugins_menu/connect-node-app-section',
						name: {
							value: 'Lifecycle Events'
						}
					},
					{
						url: '/pages/modules',
						key: 'modules',
						location: 'admin_plugins_menu/connect-node-app-section',
						name: {
							value: 'Connect Modules'
						}
					},
					{
						url: '/pages/connect-library',
						key: 'js-library',
						location: 'admin_plugins_menu/connect-node-app-section',
						name: {
							value: 'Connect JS library'
						}
					},
					{
						url: `/pages/context?input={ac.input}`,
						key: 'context',
						location: 'admin_plugins_menu/connect-node-app-section',
						name: {
							value: 'Context Parameters'
						}
					},
					{
						url: '/pages/authentication',
						key: 'authentication',
						location: 'admin_plugins_menu/connect-node-app-section',
						name: {
							value: 'Iframe JWT Authentication'
						}
					},
					{
						url: '/pages/making-api-requests',
						key: 'api-requests',
						location: 'admin_plugins_menu/connect-node-app-section',
						name: {
							value: 'Making API Requests'
						}
					},
					{
						url: '/pages/webhooks',
						key: 'webhooks',
						location: 'admin_plugins_menu/connect-node-app-section',
						name: {
							value: 'Webhooks'
						}
					},
					{
						url: '/pages/marketplace',
						key: 'marketplace',
						location: 'admin_plugins_menu/connect-node-app-section',
						name: {
							value: 'Atlassian Marketplace'
						}
					}
				],

				/**
				 * List of all the webhooks for the Connect app.
				 * For this example, we've added some Jira webhooks events.
				 *
				 * https://developer.atlassian.com/cloud/jira/platform/webhooks/
				 */
				webhooks: [
					{
						event: 'jira:issue_created',
						url: '/api/jira/issue-created'
					},
					{
						event: 'jira:issue_deleted',
						url: '/api/jira/issue-deleted'
					},
					{
						event: 'jira:issue_updated',
						url: '/api/jira/issue-updated'
					}
				]
			}
		};

		@Post('issue-created')
		issueCreated(@Body() body: any) {
			// TODO handle Issue Created
			console.log(JSON.stringify(body));
			return;
		}
		@Post('issue-deleted')
		issueDeleted(@Body() body: any) {
			// TODO handle Issue Deleted
			console.log(JSON.stringify(body));
			return;
		}
		@Post('issue-updated')
		issueUpdated(@Body() body: any) {
			// TODO handle Issue Updated
			console.log(JSON.stringify(body));
			return;
		}

		@Post('installed')
		installed(@Body() body: any) {
			// This function is needed to install the App
			console.log(JSON.stringify(body));
			return;
		}
		@Post('uninstalled')
		uninstalled(@Body() body: any) {
			console.log(JSON.stringify(body));
			return;
		}

		@Get('atlassian-connect.json')
		atlassianConnect() {
			return this.connectAppDescriptor;
		}
	}

	return HookController;
}
