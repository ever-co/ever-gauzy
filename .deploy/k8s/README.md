# Kubernetes

Let's assume current k8s kube config file saved as `k8s-ever-kubeconfig.yaml`

## Verify connectivity

kubectl --kubeconfig="k8s-ever-kubeconfig.yaml" get nodes

## Deploy

-   To Deploy

`kubectl --kubeconfig="k8s-ever-kubeconfig.yaml" --context do-sfo2-k8s-ever apply -f k8s-manifest.yaml`

Note: it assume we have context called `do-sfo2-k8s-ever` defined already

-   To Describe Deployment

`kubectl describe deployment --kubeconfig="k8s-ever-kubeconfig.yaml"`

-   To Redeploy (if use latest docker images versions)

`kubectl --kubeconfig="k8s-ever-kubeconfig.yaml" --context do-sfo2-k8s-ever rollout restart -f k8s-manifest.yaml`

## Monitoring

See <https://marketplace.digitalocean.com/apps/kubernetes-monitoring-stack>

`kubectl --kubeconfig="k8s-ever-kubeconfig.yaml" port-forward svc/kube-prometheus-stack-grafana 8090:80 -n kube-prometheus-stack`

Your Grafana instance will now be available at http://localhost:8090.

Default credentials:

Username: admin
Password: prom-operator

Note: change password after login!

`kubectl --kubeconfig="k8s-ever-kubeconfig.yaml" port-forward svc/kube-prometheus-stack-prometheus 9090 -n kube-prometheus-stack`

Your Prometheus instance will now be available at http://localhost:9090.

## Links

-   [Load Balancers Configs in DO](https://www.digitalocean.com/docs/kubernetes/how-to/configure-load-balancers)
-   [K8s Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/#ingress-controllers)
-   [K8s Ingress with Nginx + SSL LetsEncrypt](https://www.digitalocean.com/community/tutorials/how-to-set-up-an-nginx-ingress-with-cert-manager-on-digitalocean-kubernetes)
-   [Github Actions with DO](https://github.com/do-community/example-doctl-action/blob/master/.github/workflows/workflow.yaml)
