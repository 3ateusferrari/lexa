module "budget" {
  source            = "./modules/budget"
  project_name      = var.project_name
  monthly_limit_usd = var.monthly_budget_limit_usd
  alert_email       = var.alert_email
}

module "network" {
  source       = "./modules/network"
  project_name = var.project_name
  depends_on   = [module.budget]
}

module "storage_queue" {
  source       = "./modules/storage_queue"
  project_name = var.project_name
  depends_on   = [module.budget]
}

module "security" {
  source               = "./modules/security"
  project_name         = var.project_name
  environment          = var.environment
  documents_bucket_arn = module.storage_queue.documents_bucket_arn
  ingest_queue_arn     = module.storage_queue.ingest_queue_arn
  depends_on           = [module.budget]
}

module "database" {
  source                = "./modules/database"
  project_name          = var.project_name
  private_db_subnet_ids = module.network.private_db_subnet_ids
  rds_sg_id             = module.network.rds_sg_id
  db_instance_class     = var.db_instance_class
  db_password_ssm_arn   = module.security.database_url_ssm_arn
  depends_on            = [module.budget]
}

module "compute" {
  source                    = "./modules/compute"
  project_name              = var.project_name
  aws_region                = var.aws_region
  public_subnet_ids         = module.network.public_subnet_ids
  compute_sg_id             = module.network.compute_sg_id
  ecs_execution_role_arn    = module.security.ecs_execution_role_arn
  api_task_role_arn         = module.security.api_task_role_arn
  worker_task_role_arn      = module.security.worker_task_role_arn
  database_url_ssm_arn      = module.security.database_url_ssm_arn
  anthropic_api_key_ssm_arn = module.security.anthropic_api_key_ssm_arn
  documents_bucket_name     = module.storage_queue.documents_bucket_name
  ingest_queue_url          = module.storage_queue.ingest_queue_url
  depends_on                = [module.database]
}

module "cdn" {
  source       = "./modules/cdn"
  project_name = var.project_name
  depends_on   = [module.budget]
}

module "oidc_github" {
  source            = "./modules/oidc_github"
  project_name      = var.project_name
  github_repository = var.github_repository
  depends_on        = [module.budget]
}
