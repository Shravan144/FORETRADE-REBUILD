$compose = "infra/compose/docker-compose.yml"
docker compose -f $compose ps
Invoke-RestMethod http://localhost:8000/healthz | ConvertTo-Json
