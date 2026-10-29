output "public_frontend_url" {
  description = "URL publica HTTPS do CloudFront"
  value       = "https://${module.cdn.cloudfront_domain_name}"
}

output "ecr_repository_url" {
  description = "URL do repositorio ECR para push de imagens Docker"
  value       = module.compute.ecr_repository_url
}

output "rds_endpoint" {
  description = "Endpoint privado do RDS PostgreSQL"
  value       = module.database.db_endpoint
}

output "documents_bucket_name" {
  description = "Bucket S3 privado de documentos"
  value       = module.storage_queue.documents_bucket_name
}

output "ingest_queue_url" {
  description = "URL da fila SQS de ingestao"
  value       = module.storage_queue.ingest_queue_url
}
