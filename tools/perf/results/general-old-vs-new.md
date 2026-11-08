<!-- markdownlint-disable -->

# general-old vs general-new

| endpoint | metric | general-old | general-new | general-old→general-new |
|---|---|---|---|---|
| health | seq p50 ms | 5.12 | 6.14 | 1.20× slower |
| health | seq p90 ms | 6.78 | 7.66 | 1.13× slower |
| health | c8 rps | 308.2 | 282.2 | 1.09× less |
| health | c8 p99 ms (n=2468/2261) | 42.06 | 53.35 | 1.27× slower |
| health | SQL ms/req | 0.02 | 0.02 | 1.00× faster |
| health | SQL/req | 1 | 1 | 1.00× fewer statements |
| feature-toggle-definition | seq p50 ms | 1.2 | 0.99 | 1.21× faster |
| feature-toggle-definition | seq p90 ms | 1.77 | 1.36 | 1.30× faster |
| feature-toggle-definition | c8 rps | 1167.7 | 1074.8 | 1.09× less |
| feature-toggle-definition | c8 p99 ms (n=9352/8605) | 19.87 | 22.28 | 1.12× slower |
| feature-toggle-definition | SQL ms/req | 0 | 0 |  |
| feature-toggle-definition | SQL/req | 0 | 0 |  |
| user-me | seq p50 ms | 12.22 | 12.83 | 1.05× slower |
| user-me | seq p90 ms | 14.67 | 16.75 | 1.14× slower |
| user-me | c8 rps | 144.4 | 128.4 | 1.12× less |
| user-me | c8 p99 ms (n=1160/1031) | 91.04 | 102.47 | 1.13× slower |
| user-me | SQL ms/req | 0.2 | 0.2 | 1.00× faster |
| user-me | SQL/req | 5 | 5 | 1.00× fewer statements |
| role-permissions-me | seq p50 ms | 30.44 | 31.78 | 1.04× slower |
| role-permissions-me | seq p90 ms | 36.13 | 38.67 | 1.07× slower |
| role-permissions-me | c8 rps | 34.3 | 35.2 | 1.03× more |
| role-permissions-me | c8 p99 ms (n=281/292) | 525.18 | 503.12 | 1.04× faster |
| role-permissions-me | SQL ms/req | 1.08 | 1.05 | 1.03× faster |
| role-permissions-me | SQL/req | 4 | 4 | 1.00× fewer statements |
| tags | seq p50 ms | 56.47 | 57.5 | 1.02× slower |
| tags | seq p90 ms | 64.83 | 68.94 | 1.06× slower |
| tags | c8 rps | 54.5 | 56.7 | 1.04× more |
| tags | c8 p99 ms (n=440/459) | 257.41 | 200.52 | 1.28× faster |
| tags | SQL ms/req | 34.78 | 35.44 | 1.02× slower |
| tags | SQL/req | 5 | 5 | 1.00× fewer statements |
| organization-team-me | seq p50 ms | 13.48 | 13.5 | 1.00× slower |
| organization-team-me | seq p90 ms | 17.89 | 16.62 | 1.08× faster |
| organization-team-me | c8 rps | 110.5 | 101.2 | 1.09× less |
| organization-team-me | c8 p99 ms (n=888/816) | 110.01 | 156.17 | 1.42× slower |
| organization-team-me | SQL ms/req | 0.21 | 0.18 | 1.17× faster |
| organization-team-me | SQL/req | 5 | 5 | 1.00× fewer statements |
| projects-pagination | seq p50 ms | 21.04 | 19.41 | 1.08× faster |
| projects-pagination | seq p90 ms | 24.99 | 23.78 | 1.05× faster |
| projects-pagination | c8 rps | 84.8 | 80.9 | 1.05× less |
| projects-pagination | c8 p99 ms (n=680/652) | 130.43 | 142.27 | 1.09× slower |
| projects-pagination | SQL ms/req | 0.48 | 0.45 | 1.07× faster |
| projects-pagination | SQL/req | 7 | 7 | 1.00× fewer statements |
| employees-pagination | seq p50 ms | 24.59 | 24.06 | 1.02× faster |
| employees-pagination | seq p90 ms | 29.19 | 30.59 | 1.05× slower |
| employees-pagination | c8 rps | 71.5 | 62.7 | 1.14× less |
| employees-pagination | c8 p99 ms (n=576/504) | 331.66 | 161.26 | 2.06× faster |
| employees-pagination | SQL ms/req | 0.58 | 0.57 | 1.02× faster |
| employees-pagination | SQL/req | 7 | 7 | 1.00× fewer statements |
| tasks-pagination | seq p50 ms | 16.17 | 15.81 | 1.02× faster |
| tasks-pagination | seq p90 ms | 21.45 | 18.18 | 1.18× faster |
| tasks-pagination | c8 rps | 108.5 | 98.3 | 1.10× less |
| tasks-pagination | c8 p99 ms (n=872/792) | 119.28 | 257.09 | 2.16× slower |
| tasks-pagination | SQL ms/req | 0.49 | 0.49 | 1.00× faster |
| tasks-pagination | SQL/req | 6 | 6 | 1.00× fewer statements |
| teams-pagination | seq p50 ms | 18.14 | 18 | 1.01× faster |
| teams-pagination | seq p90 ms | 21.61 | 21.88 | 1.01× slower |
| teams-pagination | c8 rps | 97.7 | 97.6 | 1.00× less |
| teams-pagination | c8 p99 ms (n=784/784) | 118.62 | 109.24 | 1.09× faster |
| teams-pagination | SQL ms/req | 0.29 | 0.28 | 1.04× faster |
| teams-pagination | SQL/req | 7 | 7 | 1.00× fewer statements |
| employee-by-id | seq p50 ms | 15.22 | 14.98 | 1.02× faster |
| employee-by-id | seq p90 ms | 19.71 | 18.45 | 1.07× faster |
| employee-by-id | c8 rps | 106 | 104.5 | 1.01× less |
| employee-by-id | c8 p99 ms (n=854/840) | 126.65 | 104.31 | 1.21× faster |
| employee-by-id | SQL ms/req | 0.23 | 0.22 | 1.05× faster |
| employee-by-id | SQL/req | 5 | 5 | 1.00× fewer statements |
