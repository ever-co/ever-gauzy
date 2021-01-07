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
