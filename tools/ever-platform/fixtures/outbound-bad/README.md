# A known-bad README for outbound-calls.test.mjs

| #   | Request                                 | When       |
| --- | --------------------------------------- | ---------- |
| 1   | `GET /.well-known/ever-keys.json`       | at connect |
| 3   | `POST /v1/connect/redeem`               | at connect |
| 25  | `POST /v1/instances/me/billing-links`   | never      |
| 4   | `POST /v1/instances/token/refresh`      | hourly     |
