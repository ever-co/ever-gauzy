<!-- markdownlint-disable -->

# reports-old vs reports-new

| endpoint | metric | reports-old | reports-new | reports-old→reports-new |
|---|---|---|---|---|
| report-daily-week | seq p50 ms | 546.78 | 289.3 | 1.89× faster |
| report-daily-week | seq p90 ms | 602.8 | 317.57 | 1.90× faster |
| report-daily-week | c8 rps | 2.2 | 8.8 | 4.00× more |
| report-daily-week | c8 p99 ms (n=24/75) | 4875.1 | 1365.35 | 3.57× faster |
| report-daily-week | SQL ms/req | 258.34 | 22.95 | 11.26× faster |
| report-daily-week | SQL/req | 5 | 6.05 | 1.21× more statements |
| report-daily-month | seq p50 ms | 2019.7 | 357.27 | 5.65× faster |
| report-daily-month | seq p90 ms | 2181.42 | 544.92 | 4.00× faster |
| report-daily-month | c8 rps | 0.6 | 4.7 | 7.83× more |
| report-daily-month | c8 p99 ms (n=8/42) | 13750.14 | 1984.14 | 6.93× faster |
| report-daily-month | SQL ms/req | 1189.67 | 30.5 | 39.01× faster |
| report-daily-month | SQL/req | 5.07 | 6 | 1.18× more statements |
| report-daily-month-employee | seq p50 ms | 1989.69 | 296.49 | 6.71× faster |
| report-daily-month-employee | seq p90 ms | 2142.64 | 457.68 | 4.68× faster |
| report-daily-month-employee | c8 rps | 0.6 | 4.1 | 6.83× more |
| report-daily-month-employee | c8 p99 ms (n=8/40) | 13515.14 | 2937.29 | 4.60× faster |
| report-daily-month-employee | SQL ms/req | 1162.49 | 28.01 | 41.50× faster |
| report-daily-month-employee | SQL/req | 5.1 | 6 | 1.18× more statements |
| report-daily-chart-month | seq p50 ms | 92.74 | 70.02 | 1.32× faster |
| report-daily-chart-month | seq p90 ms | 233.7 | 139.19 | 1.68× faster |
| report-daily-chart-month | c8 rps | 12.6 | 15.9 | 1.26× more |
| report-daily-chart-month | c8 p99 ms (n=107/134) | 1120.1 | 782.93 | 1.43× faster |
| report-daily-chart-month | SQL ms/req | 20.12 | 9.88 | 2.04× faster |
| report-daily-chart-month | SQL/req | 5 | 5 | 1.00× fewer statements |
| report-weekly | seq p50 ms | 416.55 | 58.5 | 7.12× faster |
| report-weekly | seq p90 ms | 535.58 | 66.05 | 8.11× faster |
| report-weekly | c8 rps | 2.8 | 13.3 | 4.75× more |
| report-weekly | c8 p99 ms (n=29/112) | 4654.54 | 870.64 | 5.35× faster |
| report-weekly | SQL ms/req | 181.43 | 5.45 | 33.29× faster |
| report-weekly | SQL/req | 5.03 | 6 | 1.19× more statements |
| report-owed-month | seq p50 ms | 290.75 | 189.92 | 1.53× faster |
| report-owed-month | seq p90 ms | 346.24 | 222.32 | 1.56× faster |
| report-owed-month | c8 rps | 3.7 | 4.3 | 1.16× more |
| report-owed-month | c8 p99 ms (n=32/43) | 3041.58 | 5045.6 | 1.66× slower |
| report-owed-month | SQL ms/req | 78.19 | 11.23 | 6.96× faster |
| report-owed-month | SQL/req | 6 | 6.03 | 1.01× more statements |
| activity-report-week | seq p50 ms | 200.49 | 192.51 | 1.04× faster |
| activity-report-week | seq p90 ms | 219.18 | 218.39 | 1.00× faster |
| activity-report-week | c8 rps | 7.3 | 8.1 | 1.11× more |
| activity-report-week | c8 p99 ms (n=65/72) | 1526.56 | 1241.05 | 1.23× faster |
| activity-report-week | SQL ms/req | 26.21 | 25.79 | 1.02× faster |
| activity-report-week | SQL/req | 7 | 7 | 1.00× fewer statements |
| activity-daily-apps-week | seq p50 ms | 47.97 | 23.52 | 2.04× faster |
| activity-daily-apps-week | seq p90 ms | 55.43 | 27.05 | 2.05× faster |
| activity-daily-apps-week | c8 rps | 43.7 | 50 | 1.14× more |
| activity-daily-apps-week | c8 p99 ms (n=353/408) | 365.03 | 235.96 | 1.55× faster |
| activity-daily-apps-week | SQL ms/req | 23.24 | 5.96 | 3.90× faster |
| activity-daily-apps-week | SQL/req | 5 | 5 | 1.00× fewer statements |
| statistics-counts-week | seq p50 ms | 18.81 | 36.85 | 1.96× slower |
| statistics-counts-week | seq p90 ms | 21.27 | 46.07 | 2.17× slower |
| statistics-counts-week | c8 rps | 82.1 | 78.9 | 1.04× less |
| statistics-counts-week | c8 p99 ms (n=662/635) | 135.55 | 297.31 | 2.19× slower |
| statistics-counts-week | SQL ms/req | 10.5 | 25.09 | 2.39× slower |
| statistics-counts-week | SQL/req | 8 | 8 | 1.00× fewer statements |
