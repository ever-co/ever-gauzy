<!-- markdownlint-disable -->

# baseline vs fixed4

| endpoint | metric | baseline | fixed4 | baseline→fixed4 |
|---|---|---|---|---|
| health | seq p50 ms | 13.76 | 9.53 | 1.44× faster |
| health | seq p90 ms | 17.19 | 10.94 | 1.57× faster |
| health | c16 rps | 76.8 | 170.6 | 2.22× more |
| health | c16 p99 ms | 875.9 | 464.94 | 1.88× faster |
| health | SQL/req | 1 | 1 | 1.00× faster |
| health | Redis/req | 2 | 2 | 1.00× faster |
| feature-toggle-definition | seq p50 ms | 6.26 | 2.08 | 3.01× faster |
| feature-toggle-definition | seq p90 ms | 6.79 | 2.66 | 2.55× faster |
| feature-toggle-definition | c16 rps | 267.5 | 627.9 | 2.35× more |
| feature-toggle-definition | c16 p99 ms | 88.87 | 45.02 | 1.97× faster |
| feature-toggle-definition | SQL/req | 0 | 0 |  |
| feature-toggle-definition | Redis/req | 1 | 0 |  |
| user-me | seq p50 ms | 44.06 | 24.33 | 1.81× faster |
| user-me | seq p90 ms | 50.33 | 26.91 | 1.87× faster |
| user-me | c16 rps | 37 | 57.1 | 1.54× more |
| user-me | c16 p99 ms | 1233.4 | 1469.46 | 1.19× slower |
| user-me | SQL/req | 6 | 5 | 1.20× faster |
| user-me | Redis/req | 1 | 0 |  |
| role-permissions-me | seq p50 ms | 135.52 | 61.04 | 2.22× faster |
| role-permissions-me | seq p90 ms | 162.34 | 74.65 | 2.17× faster |
| role-permissions-me | c16 rps | 7.6 | 17.3 | 2.28× more |
| role-permissions-me | c16 p99 ms | 3417.59 | 1696.7 | 2.01× faster |
| role-permissions-me | SQL/req | 5 | 4 | 1.25× faster |
| role-permissions-me | Redis/req | 1 | 0 |  |
| tags | seq p50 ms | 1427.97 | 112.98 | 12.64× faster |
| tags | seq p90 ms | 1792.05 | 128.55 | 13.94× faster |
| tags | c16 rps | 2.8 | 32.6 | 11.64× more |
| tags | c16 p99 ms | 6905.35 | 1276.6 | 5.41× faster |
| tags | SQL/req | 6.07 | 5.03 | 1.21× faster |
| tags | Redis/req | 1 | 0 |  |
| organization-team-me | seq p50 ms | 46.92 | 25.76 | 1.82× faster |
| organization-team-me | seq p90 ms | 62.23 | 29.45 | 2.11× faster |
| organization-team-me | c16 rps | 24.8 | 49.9 | 2.01× more |
| organization-team-me | c16 p99 ms | 901.46 | 833.83 | 1.08× faster |
| organization-team-me | SQL/req | 6 | 5 | 1.20× faster |
| organization-team-me | Redis/req | 1 | 0 |  |
| projects-pagination | seq p50 ms | 62.76 | 38.54 | 1.63× faster |
| projects-pagination | seq p90 ms | 78.03 | 43.92 | 1.78× faster |
| projects-pagination | c16 rps | 21.5 | 37.5 | 1.74× more |
| projects-pagination | c16 p99 ms | 881.73 | 912.8 | 1.04× slower |
| projects-pagination | SQL/req | 8 | 7 | 1.14× faster |
| projects-pagination | Redis/req | 1 | 0 |  |
| employees-pagination | seq p50 ms | 116.75 | 51.88 | 2.25× faster |
| employees-pagination | seq p90 ms | 136.88 | 59.86 | 2.29× faster |
| employees-pagination | c16 rps | 10 | 26.6 | 2.66× more |
| employees-pagination | c16 p99 ms | 2058.02 | 1217.02 | 1.69× faster |
| employees-pagination | SQL/req | 8.03 | 7 | 1.15× faster |
| employees-pagination | Redis/req | 1 | 0 |  |
| tasks-pagination | seq p50 ms | 53.28 | 28.98 | 1.84× faster |
| tasks-pagination | seq p90 ms | 65.08 | 33.85 | 1.92× faster |
| tasks-pagination | c16 rps | 23.3 | 48.7 | 2.09× more |
| tasks-pagination | c16 p99 ms | 895.64 | 879.38 | 1.02× faster |
| tasks-pagination | SQL/req | 8 | 6 | 1.33× faster |
| tasks-pagination | Redis/req | 1 | 0 |  |
| teams-pagination | seq p50 ms | 61.41 | 31.19 | 1.97× faster |
| teams-pagination | seq p90 ms | 63.73 | 34.81 | 1.83× faster |
| teams-pagination | c16 rps | 26.6 | 47.8 | 1.80× more |
| teams-pagination | c16 p99 ms | 740.7 | 953.05 | 1.29× slower |
| teams-pagination | SQL/req | 8 | 7 | 1.14× faster |
| teams-pagination | Redis/req | 1 | 0 |  |
| employee-by-id | seq p50 ms | 54.35 | 27.54 | 1.97× faster |
| employee-by-id | seq p90 ms | 61.46 | 32.48 | 1.89× faster |
| employee-by-id | c16 rps | 26.1 | 51.9 | 1.99× more |
| employee-by-id | c16 p99 ms | 742.07 | 756.57 | 1.02× slower |
| employee-by-id | SQL/req | 6 | 5 | 1.20× faster |
| employee-by-id | Redis/req | 1 | 0 |  |
