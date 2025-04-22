# @gauzy/plugin-posthog-ui

## Overview

The PostHog Angular Plugin seamlessly integrates your Angular applications with [PostHog](https://posthog.com), an open-source product analytics platform. This integration enables you to capture, monitor, and analyze user behavior, feature usage, and application events in real-time.

## Features

-   **Event Tracking**: Capture custom events and user actions
-   **Page View Analytics**: Automatic page view tracking with Angular Router integration
-   **User Identification**: Identify and track individual users across sessions
-   **Session Recording**: Record user sessions for playback and analysis
-   **Feature Flags**: Implement feature flags and A/B testing in your Angular app
-   **Funnel Analysis**: Track user journeys through defined conversion funnels
-   **Heatmaps**: Visualize user clicks and interactions on your UI
-   **HTTP Request Tracking**: Automatic tracking of API calls with timing metrics
-   **Error Monitoring**: Track frontend errors and exceptions
-   **Group Analytics**: Organize users into companies, teams, or organizations
-   **Cohort Analysis**: Define and analyze user cohorts based on behavior
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

Inject the PostHog service in your components:

```typescript
import { Component } from '@angular/core';
import { PostHogService } from '@gauzy/plugin-posthog-ui';

@Component({
	selector: 'app-example',
	template: `<button (click)="trackButtonClick()">Click Me</button>`
})
export class ExampleComponent {
	constructor(private posthog: PostHogService) {}

	trackButtonClick() {
		this.posthog.captureEvent('button_clicked', {
			buttonName: 'example_button',
			section: 'homepage'
		});
	}
}
```

### Directive-Based Event Tracking

Use the provided directive to track events directly in your templates:

```html
<button [phTrack]="'signup_button_clicked'" [phProperties]="{ location: 'header', variant: 'primary' }">Sign Up</button>
```

### User Identification

Identify your users when they log in:

```typescript
login(user) {
  // After successful authentication
  this.posthog.identify(user.id, {
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
import { PostHogService } from '@gauzy/plugin-posthog-ui';

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

	constructor(private posthog: PostHogService) {}

	ngOnInit() {
		this.posthog.isFeatureEnabled('new-feature').then((enabled) => {
			this.newFeatureEnabled = enabled;
		});
	}
}
```

### Group Analytics

Associate users with organizations or teams:

```typescript
// When a user joins or switches to a team
this.posthog.group('company', 'company-id-123', {
	name: 'Acme Corp',
	industry: 'Technology',
	tier: 'Enterprise'
});
```

### Super Properties

Set properties that will be sent with every event:

```typescript
// Set once during app initialization
this.posthog.register({
	app_version: '1.2.3',
	theme: 'dark',
	locale: 'en-US'
});
```

## API Reference

### PostHogService

The main service for interacting with PostHog:

| Method                                                                 | Description                                       |
| ---------------------------------------------------------------------- | ------------------------------------------------- |
| `initialize(apiKey: string, config?: object)`                          | Initialize PostHog with API key and configuration |
| `captureEvent(eventName: string, properties?: object)`                 | Track a custom event                              |
| `capturePageview(url?: string, properties?: object)`                   | Capture a page view event                         |
| `identify(distinctId: string, properties?: object)`                    | Identify a user                                   |
| `reset()`                                                              | Reset the current user's identity                 |
| `alias(alias: string, distinctId?: string)`                            | Alias a user ID                                   |
| `group(groupType: string, groupKey: string, groupProperties?: object)` | Associate user with a group                       |
| `isFeatureEnabled(key: string, options?: object)`                      | Check if a feature flag is enabled                |
| `getFeatureFlag(key: string, defaultValue?: any)`                      | Get the value of a feature flag                   |
| `getAllFeatureFlags()`                                                 | Get all feature flags for the current user        |
| `reloadFeatureFlags()`                                                 | Reload feature flags from PostHog                 |
| `register(properties: object)`                                         | Register super properties                         |
| `registerOnce(properties: object)`                                     | Register super properties once                    |
| `unregister(property: string)`                                         | Unregister a super property                       |
| `startSessionRecording()`                                              | Start session recording                           |
| `stopSessionRecording()`                                               | Stop session recording                            |
| `getInstance()`                                                        | Get the raw PostHog instance for advanced usage   |

### Directives

| Directive        | Description                                              |
| ---------------- | -------------------------------------------------------- |
| `[phTrack]`      | Track events on user interactions                        |
| `[phProperties]` | Properties to include with the tracked event             |
| `[phOnInit]`     | Whether to capture the event on component initialization |

### Guards

| Guard               | Description                                                      |
| ------------------- | ---------------------------------------------------------------- |
| `PostHogRouteGuard` | Track route changes and enforce feature flag access restrictions |

## Building

Run `yarn nx build plugin-posthog-ui` to build the library.

## Running unit tests

Run `yarn nx test plugin-posthog-ui` to execute the unit tests via [Jest](https://jestjs.io).

## Publishing

After building your library with `yarn nx build plugin-posthog-ui`, go to the dist folder `dist/packages/plugins/posthog-ui` and run `npm publish`.
