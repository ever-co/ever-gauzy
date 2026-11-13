<!-- markdownlint-disable -->

# sqlite-reports-old vs sqlite-reports-new

| endpoint | metric | sqlite-reports-old | sqlite-reports-new | sqlite-reports-old→sqlite-reports-new |
|---|---|---|---|---|
| report-daily-week | seq p50 ms | 278.22 | 47.43 | 5.87× faster |
| report-daily-week | seq p90 ms | 307.58 | 67.28 | 4.57× faster |
| report-daily-week | c8 rps | 3.6 | 21.1 | 5.86× more |
| report-daily-week | c8 p99 ms (n=36/176) | 2439.19 | 560.35 | 4.35× faster |
| report-daily-month | seq p50 ms | 1514.58 | 162.49 | 9.32× faster |
| report-daily-month | seq p90 ms | 2733.23 | 194.91 | 14.02× faster |
| report-daily-month | c8 rps | 0.3 | 5.9 | 19.67× more |
| report-daily-month | c8 p99 ms (n=10/55) | 24755.41 | 1480.56 | 16.72× faster |
| report-daily-month-employee | seq p50 ms | 1463.4 | 143.7 | 10.18× faster |
| report-daily-month-employee | seq p90 ms | 1742.96 | 169.54 | 10.28× faster |
| report-daily-month-employee | c8 rps | 0.6 | 6.8 | 11.33× more |
| report-daily-month-employee | c8 p99 ms (n=12/61) | 14617.14 | 1314.02 | 11.12× faster |
| report-daily-chart-month | seq p50 ms | 36.45 | 19.11 | 1.91× faster |
| report-daily-chart-month | seq p90 ms | 53.63 | 24.24 | 2.21× faster |
| report-daily-chart-month | c8 rps | 32.5 | 54.5 | 1.68× more |
| report-daily-chart-month | c8 p99 ms (n=267/444) | 869.8 | 254.58 | 3.42× faster |
| report-weekly | seq p50 ms | 74.84 | 25.51 | 2.93× faster |
| report-weekly | seq p90 ms | 92.03 | 37.05 | 2.48× faster |
| report-weekly | c8 rps | 14.6 | 37.7 | 2.58× more |
| report-weekly | c8 p99 ms (n=124/310) | 688.77 | 347.01 | 1.98× faster |
| report-owed-month | seq p50 ms | 158.05 | 93.98 | 1.68× faster |
| report-owed-month | seq p90 ms | 194.22 | 107.66 | 1.80× faster |
| report-owed-month | c8 rps | 6.3 | 9.9 | 1.57× more |
| report-owed-month | c8 p99 ms (n=57/88) | 1766.9 | 951.69 | 1.86× faster |
| activity-report-week | seq p50 ms | 142.22 | 127.08 | 1.12× faster |
| activity-report-week | seq p90 ms | 179.68 | 144.52 | 1.24× faster |
| activity-report-week | c8 rps | 7.1 | 7.7 | 1.08× more |
| activity-report-week | c8 p99 ms (n=64/69) | 1295.31 | 1201.22 | 1.08× faster |
| activity-daily-apps-week | seq p50 ms | 21.71 | 14.48 | 1.50× faster |
| activity-daily-apps-week | seq p90 ms | 23.77 | 18.03 | 1.32× faster |
| activity-daily-apps-week | c8 rps | 36.7 | 77.9 | 2.12× more |
| activity-daily-apps-week | c8 p99 ms (n=300/630) | 810.42 | 174.17 | 4.65× faster |
| statistics-counts-week | seq p50 ms | 10.4 | 10.09 | 1.03× faster |
| statistics-counts-week | seq p90 ms | 11.86 | 13.06 | 1.10× slower |
| statistics-counts-week | c8 rps | 88.7 | 95.4 | 1.08× more |
| statistics-counts-week | c8 p99 ms (n=716/771) | 507.97 | 212.71 | 2.39× faster |
