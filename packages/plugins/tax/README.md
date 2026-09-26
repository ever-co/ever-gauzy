# @gauzy/plugin-tax

Tax categories, tax rates, the parts a rate is made of, the regimes that select which rates apply, and the
resolution a document is taxed through.

The plugin owns five tables:

| table | what it holds |
|---|---|
| `tax_category` | the taxable class of a variant or a party (`STANDARD`, `REDUCED`, `ZERO`, `DIGITAL`, …), one of which is the organization default |
| `tax_rate` | one rate of a category, scoped geographically and in time, optionally compound and optionally inclusive, with a priority, a direction, an amount type and an optional external provider key |
| `tax_rate_part` | one part of a rate: a base share, a **signed** share of the rate, an arithmetic (`PERCENT`/`FIXED`) and an optional posting code. A rate that declares no part is one implied part (`TAX`, 100 %, base 1), so every rate written before the table existed keeps its exact breakdown |
| `tax_regime` | a named set of rates with a trigger (region, country, province, postal pattern, registration requirement, window), selected once per document from the party's assignment or from the destination |
| `tax_regime_rate` | the membership pivot. A rate with **no** row is general and always a candidate; a rate with **at least one** row is a candidate only when one of its regimes is the selected one |

Rates are the **rate table** a sale document is taxed from, not a ledger. `packages/core` already owns the
tax ledger (`tax_line`) and the money rules (`packages/core/src/lib/money`); the tax plugin resolves which
rates apply and computes what they come to, and hands the caller tax-line-shaped rows that the caller
persists through the core ledger. This package never writes a `tax_line` row of its own — it adds the four
columns a part's evidence lands in (`taxRatePartId`, `postingKey`, `quantity`, `taxRegimeId`) and the unique
index that makes one row per `(owner, rate, part)` true in the database rather than by convention.

Four platform tables gain a reference this package owns: `product_variant.taxCategoryId` and
`organization_contact.taxCategoryId` on the thing being sold and the party buying it, and
`organization_contact.taxRegimeId` / `organization_vendor.taxRegimeId` for the tax treatment a party is
manually assigned. All four columns are created by the core kernel without their foreign key, and this
package's migrations add the constraints once `tax_category` and `tax_regime` exist.

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
