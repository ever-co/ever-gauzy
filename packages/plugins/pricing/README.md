# @gauzy/plugin-pricing

The pricing capability of the Gauzy platform: price lists, product prices with quantity tiers and
validity windows, tax-inclusivity preferences and foreign-exchange rates.

## What it owns

| table | holds |
|---|---|
| `price_list` | a named, scoped, time-boxed set of prices: `SALE` lists compete on price, `OVERRIDE` lists win outright for their context |
| `product_price` | one row per `(variant, currency, price list, quantity tier)` — the effective price of a product variant, never a second name for it |
| `price_preference` | how a currency, region or channel presents prices (tax-inclusive or not) when neither the price nor its list says |
| `exchange_rate` | the conversion between two currencies, valid from an instant |

A variant with no `product_price` row falls back to the legacy `product_variant_price.retailPrice`,
so an installation that never creates a price list keeps pricing exactly as it did before.

## Money

Every money column is `numeric(20,6)` with a sibling three-letter ISO currency column; rates are
`numeric(9,6)` stored as fractions and the exchange rate is `numeric(20,10)`. Nothing is a float and
no service does decimal arithmetic by hand: every calculation goes through the platform money helper
in `@gauzy/core`, which owns the precision, the rounding boundary and the guard rails
(`minMarginPercent`, `maxDiscountPercent`).

## Building

Run `yarn nx build plugin-pricing` to build the library.

## Running unit tests

Run `yarn run test plugin-pricing` to execute the unit tests via [Jest](https://jestjs.io).

## Publishing

After building your library with `yarn nx build plugin-pricing`, go to the dist folder
`dist/packages/plugins/pricing` and run `npm publish`.

## Installation

Install the Pricing Plugin using your preferred package manager:

```bash
npm install @gauzy/plugin-pricing
# or
yarn add @gauzy/plugin-pricing
```

Register the plugin in `apps/api/src/plugins.ts` alongside the other plugins. Its migrations ship
with the package and are ordered by their own timestamps, so the tables are created on the next API
start whether or not any other plugin is installed.
