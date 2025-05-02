# @gauzy/plugin-posthog-ui

## Overview

The PostHog Angular Plugin seamlessly integrates your Angular applications with [PostHog](https://posthog.com), an open-source product analytics platform. This integration enables you to capture, monitor, and analyze user behavior, feature usage, and application events in real-time.

## Features

-   **Event Tracking**: Capture custom events and user actions
-   **Page View Analytics**: Automatic page view tracking with Angular Router integration
-   **User Identification**: Identify and track individual users across sessions
-   **Session Recording**: Record user sessions for playback and analysis
-   **Feature Flags**: Implement feature flags and A/B testing in your Angular app
-   **Error Monitoring**: Track frontend errors and exceptions
-   **HTTP Request Tracking**: Automatic tracking of API calls with timing metrics
-   **Form Tracking**: Track form submissions and field interactions
-   **Group Analytics**: Organize users into companies, teams, or organizations
-   **Super Properties**: Set properties that persist across events
-   **SSR Compatibility**: Safe to use with Server-Side Rendering

## Installation

Install the PostHog Angular Plugin using your preferred package manager:

```bash
npm install @gauzy/plugin-posthog-ui posthog-js
# or
yarn add @gauzy/plugin-posthog-ui posthog-js
```

## Configuration

### Basic Setup

Import the `PostHogModule` in your application module:

```typescript
// app.module.ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { PostHogModule } from '@gauzy/plugin-posthog-ui';
import { environment } from '../environments/environment';

@NgModule({
	declarations: [AppComponent],
	imports: [
		BrowserModule,
		PostHogModule.forRoot({
			apiKey: environment.posthogApiKey,
			apiHost: environment.posthogHost || 'https://app.posthog.com',
			// Optional configuration
			captureHttpEvents: true,
			options: {
				capture_pageview: false, // We handle this with the Router
				persistence: 'localStorage',
				session_recording: {
					enabled: environment.production
				}
			}
		})
	],
	bootstrap: [AppComponent]
})
export class AppModule {}
```

### Environment Configuration

Add these variables to your environment files:

```typescript
// environments/environment.ts
export const environment = {
	production: false,
	posthogApiKey: 'YOUR_POSTHOG_API_KEY',
	posthogHost: 'https://app.posthog.com' // or your self-hosted instance
};
```

## Usage

### Basic Event Tracking

Inject the PostHog service or manager in your components:

```typescript
import { Component } from '@angular/core';
import { PostHogServiceManager } from '@gauzy/plugin-posthog-ui';

@Component({
	selector: 'app-example',
	template: `<button (click)="trackButtonClick()">Click Me</button>`
})
export class ExampleComponent {
	constructor(private posthogManager: PostHogServiceManager) {}

	trackButtonClick() {
		this.posthogManager.trackEvent('button_clicked', {
			buttonName: 'example_button',
			section: 'homepage'
		});
	}
}
```

### Directive-Based Event Tracking

Use the included directives to track events directly in your templates:

```html
<!-- Basic event tracking -->
<button [phTrack]="'signup_button_clicked'" [phProperties]="{ location: 'header', variant: 'primary' }">Sign Up</button>

<!-- Advanced configuration -->
<button
	[phTrack]="'button_clicked'"
	[phProperties]="{ buttonName: 'submit' }"
	[phOnInit]="true"
	[phEventType]="'click'"
	[phStopPropagation]="true"
>
	Submit
</button>
```

### Form Tracking

Track form submissions and field interactions:

```html
<form
	phFormTrack
	[phFormName]="'signup_form'"
	[phTrackFields]="true"
	[phExcludeFields]="['password', 'credit-card']"
	[phSanitizeValues]="true"
	(ngSubmit)="onSubmit()"
>
	<input name="email" type="email" />
	<input name="password" type="password" />
	<button type="submit">Submit</button>
</form>
```

### User Identification

Identify your users when they log in:

```typescript
login(user) {
  // After successful authentication
  this.posthogManager.identifyUser(user.id, {
    email: user.email,
    name: user.name,
    plan: user.subscriptionPlan,
    signupDate: user.createdAt
  });
}
```

### Feature Flags

Check if a feature flag is enabled:

```typescript
import { Component, OnInit } from '@angular/core';
import { PostHogServiceManager } from '@gauzy/plugin-posthog-ui';

@Component({
	selector: 'app-feature',
	template: `
		<div *ngIf="newFeatureEnabled">
			<h2>New Feature</h2>
			<!-- Feature content -->
		</div>
	`
})
export class FeatureComponent implements OnInit {
	newFeatureEnabled = false;

	constructor(private posthogManager: PostHogServiceManager) {}

	ngOnInit() {
		this.newFeatureEnabled = this.posthogManager.isFeatureEnabled('new-feature');
	}
}
```

### Group Analytics

Associate users with organizations or teams:

```typescript
// When a user joins or switches to a team
this.posthogManager.setGroup('company', 'company-id-123', {
	name: 'Acme Corp',
	industry: 'Technology',
	tier: 'Enterprise'
});
```

### Error Tracking

The library automatically tracks unhandled errors and HTTP errors. You can also manually track errors:

```typescript
try {
	// Some risky operation
} catch (error) {
	this.posthogManager.trackError(error, {
		context: 'payment_processing',
		user_action: 'checkout'
	});
}
```

### Super Properties

Set properties that will be sent with every event:

```typescript
// Set once during app initialization
this.posthogManager.register({
	app_version: '1.2.3',
	theme: 'dark',
	locale: 'en-US'
});
```

## API Reference

### PostHogServiceManager

The high-level service for interacting with PostHog:

| Method                                                                    | Description                                     |
| ------------------------------------------------------------------------- | ----------------------------------------------- |
| `initialize(config: PostHogModuleConfig)`                                 | Initialize PostHog with configuration           |
| `trackEvent(eventName: string, properties?: object)`                      | Track a custom event                            |
| `trackPageView(url?: string, properties?: object)`                        | Capture a page view event                       |
| `identifyUser(userId: string, properties?: object)`                       | Identify a user                                 |
| `resetUser()`                                                             | Reset the current user's identity               |
| `setGroup(groupType: string, groupKey: string, groupProperties?: object)` | Associate user with a group                     |
| `isFeatureEnabled(flagKey: string)`                                       | Check if a feature flag is enabled              |
| `getFeatureFlagValue<T>(flagKey: string, defaultValue: T)`                | Get the value of a feature flag                 |
| `reloadFeatureFlags()`                                                    | Reload feature flags from PostHog               |
| `setUserProperties(properties: object)`                                   | Set properties for the current user             |
| `optInTracking()`                                                         | Opt user in to tracking                         |
| `optOutTracking()`                                                        | Opt user out of tracking                        |
| `trackError(error: Error, properties?: object)`                           | Track an error with context                     |
| `getPostHogInstance()`                                                    | Get the raw PostHog instance for advanced usage |

### PostHogService

The low-level service offering direct access to all PostHog capabilities:

| Method                                                                          | Description                           |
| ------------------------------------------------------------------------------- | ------------------------------------- |
| `initialize(apiKey: string, config?: object)`                                   | Initialize PostHog                    |
| `captureEvent(eventName: string, properties?: object, sendInstantly?: boolean)` | Track a custom event                  |
| `capturePageview(url?: string, properties?: object)`                            | Capture a page view event             |
| `captureError(error: Error, properties?: object)`                               | Track an error or exception           |
| `identify(distinctId: string, userProperties?: object, callback?: () => void)`  | Identify a user                       |
| `alias(alias: string, distinctId?: string, callback?: () => void)`              | Create an alias for a user            |
| `group(groupType: string, groupKey: string, groupProperties?: object)`          | Associate user with a group           |
| `reset()`                                                                       | Reset the current user                |
| `isFeatureEnabled(key: string, options: { send_event: boolean })`               | Check if a feature flag is enabled    |
| `getFeatureFlag(key: string, defaultValue?: any)`                               | Get a feature flag value              |
| `setFeatureFlagOverride(key: string, value: any)`                               | Override a feature flag (for testing) |
| `reloadFeatureFlags()`                                                          | Reload feature flags                  |
| `getFeatureFlags(keys: string[])`                                               | Get multiple feature flag values      |
| `startSessionRecording()`                                                       | Start session recording               |
| `stopSessionRecording()`                                                        | Stop session recording                |
| `register(properties: object, days?: number)`                                   | Register super properties             |
| `registerOnce(properties: object, defaultValue?: any, days?: number)`           | Register properties once              |
| `unregister(propertyName: string)`                                              | Unregister a super property           |
| `getDistinctId()`                                                               | Get the current user's distinct ID    |
| `optOut()`                                                                      | Opt out of tracking                   |
| `optIn()`                                                                       | Opt in to tracking                    |
| `isOptedOut()`                                                                  | Check if user has opted out           |
| `setPersonProperties(properties: object)`                                       | Set person properties                 |
| `setPersonPropertiesOnce(properties: object)`                                   | Set person properties once            |
| `getInstance()`                                                                 | Get the raw PostHog instance          |

### Directives

| Directive             | Description                                              |
| --------------------- | -------------------------------------------------------- |
| `[phTrack]`           | Track events on user interactions                        |
| `[phProperties]`      | Properties to include with the tracked event             |
| `[phOnInit]`          | Whether to capture the event on component initialization |
| `[phEventType]`       | Type of event to listen for (click, mouseenter, focus)   |
| `[phStopPropagation]` | Whether to stop event propagation                        |
| `phFormTrack`         | Track form submissions and field interactions            |
| `[phFormName]`        | Name identifier for the form being tracked               |
| `[phTrackFields]`     | Whether to track individual field interactions           |
| `[phExcludeFields]`   | Fields to exclude from tracking                          |
| `[phSanitizeValues]`  | Whether to sanitize field values                         |
| `[phTrackFocus]`      | Whether to track field focus events                      |
| `[phTrackBlur]`       | Whether to track field blur events                       |
| `[phTrackChange]`     | Whether to track field change events                     |

## Testing

The PostHog module includes a testing utility:

```typescript
// test.module.ts
import { PostHogModule } from '@gauzy/plugin-posthog-ui';

@NgModule({
	imports: [PostHogModule.forTesting()]
})
export class TestModule {}
```

## Building

Run `yarn nx build plugin-posthog-ui` to build the library.

## Running unit tests

Run `yarn nx test plugin-posthog-ui` to execute the unit tests via [Jest](https://jestjs.io).

## Publishing

After building your library with `yarn nx build plugin-posthog-ui`, go to the dist folder `dist/packages/plugins/posthog-ui` and run `npm publish`.
