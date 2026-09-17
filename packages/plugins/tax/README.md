# @gauzy/plugin-tax

Tax categories, tax rates and the resolution a sale document is taxed through.

The plugin owns two tables:

| table | what it holds |
|---|---|
| `tax_category` | the taxable class of a variant or a party (`STANDARD`, `REDUCED`, `ZERO`, `DIGITAL`, …), one of which is the organization default |
| `tax_rate` | one rate of a category, scoped geographically and in time, optionally compound and optionally inclusive, with a priority and an optional external provider key |

Rates are the **rate table** a sale document is taxed from, not a ledger. `packages/core` already owns the
tax ledger (`tax_line`) and the money rules (`packages/core/src/lib/money`); the tax plugin resolves which
rates apply and computes what they come to, and hands the caller tax-line-shaped rows that the caller
persists through the core ledger. This package never writes a `tax_line` row of its own.

Two platform tables gain a reference to a category: `product_variant.taxCategoryId` on the thing being
sold and `organization_contact.taxCategoryId` on the party buying it. The columns are created by the core
kernel without their foreign key, and this package's `AddTaxCategoryForeignKeys` migration adds the two
constraints once `tax_category` exists.

## Building

Run `yarn nx build plugin-tax` to build the library.

## Running unit tests

Run `yarn run test plugin-tax` to execute the unit tests via [Jest](https://jestjs.io).

## Publishing

After building your library with `yarn nx build plugin-tax`, go to the dist folder
`dist/packages/plugins/tax` and run `npm publish`.

## Installation

Install the Tax Plugin using your preferred package manager:

```bash
npm install @gauzy/plugin-tax
# or
yarn add @gauzy/plugin-tax
```
