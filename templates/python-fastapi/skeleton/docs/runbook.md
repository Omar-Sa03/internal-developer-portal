# Runbook

## The service is unhealthy

1. Check the **Production readiness** card on the catalog page: it shows Argo CD health,
   policy violations and the latest CI run in one place.
2. Inspect pods and events:

   ```bash
   kubectl -n ${{ values.service_name }} get pods
   kubectl -n ${{ values.service_name }} describe pod <pod>
   kubectl -n ${{ values.service_name }} logs deploy/${{ values.service_name }}
   ```

3. Check the Grafana dashboard tagged `${{ values.service_name }}` for error rate and latency.

## Rolling back

Revert the image tag change in `helm/service/values.yaml` on `main`. Argo CD syncs the
previous version automatically.
