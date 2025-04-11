# @gauzy/plugin-posthog

## Overview

The PostHog Plugin seamlessly integrates your server with [PostHog](https://posthog.com), an open-source analytics platform. This integration enables you to capture, monitor, and analyze user behavior and application events in real time.

## Features

-   **Error Tracking**: Automatically report exceptions and errors to PostHog’s new error tracking feature.
-   **User Behavior Insights**: Gain deep insights into user interactions within your application.
-   **Event Tracking**: Capture custom application events for detailed analysis.

## Building

Run `yarn nx build plugin-posthog` to build the library.

## Running unit tests

Run `yarn nx test plugin-posthog` to execute the unit tests via [Jest](https://jestjs.io).

## Publishing

After building your library with `yarn nx build plugin-posthog`, go to the dist folder `dist/packages/plugins/posthog` and run `npm publish`.

## Installation

Install the PostHog Plugin using your preferred package manager:

```bash
npm install @gauzy/plugin-posthog
# or
yarn add @gauzy/plugin-posthog
```
