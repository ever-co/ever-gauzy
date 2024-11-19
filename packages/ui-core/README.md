# @gauzy/ui-core

The `@gauzy/ui-core` library is generated with [Nx](https://nx.dev) and is intended to be used within the Gauzy ecosystem. Before installing, make sure you have a Gauzy workspace set up and that all necessary dependencies are in place.

## Getting Started

- **Core Components:** Offers a collection of essential UI components and utilities for building user interfaces in Angular applications.
- **Shared Pipes:** Provides reusable pipes for transforming data and formatting strings in Angular applications.
- **Shared Services:** Offers a collection of shared services for common functionality, such as authentication, localization, and data access.
- **Shared Directives:** Provides reusable directives for common UI elements, such as tooltips, dropdowns, and modals.

## Code scaffolding

Run `yarn nx g @gauzy/ui-core:component my-component --project=ui-core` to generate a new component. You can also use `nx g @gauzy/ui-core:directive|pipe|service|guard|interface|enum|module`.

## Build

Run `yarn nx build ui-core` to build the library.

## Running unit tests

Run `yarn nx test ui-core` to execute the unit tests via [Jest](https://jestjs.io).

## Publishing

After building your library with `nx build ui-core`, go to the dist folder `dist/packages/ui-core` and run `npm publish`.

## Installation

To install the `@gauzy/ui-core` library, run the following command in your Angular project:

```bash
npm install @gauzy/ui-core
# or
yarn add @gauzy/ui-core
