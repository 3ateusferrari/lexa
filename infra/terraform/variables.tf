variable "aws_region" {
  description = "Região principal da AWS para deploy dos recursos"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Nome do projeto usado como prefixo nos recursos"
  type        = string
  default     = "lexa"
}

variable "environment" {
  description = "Ambiente de execução (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "alert_email" {
  description = "Endereço de e-mail para alertas de orçamento AWS Budgets e alarmes CloudWatch"
  type        = string
  default     = "alertas-lexa@example.com"
}

variable "monthly_budget_limit_usd" {
  description = "Limite mensal em USD para o alarme de custo AWS Budgets"
  type        = string
  default     = "10"
}

variable "github_repository" {
  description = "Repositório GitHub autorizado via OIDC (formato owner/repo)"
  type        = string
  default     = "3ateusferrari/lexa"
}

variable "db_instance_class" {
  description = "Classe da instância RDS PostgreSQL (Free Tier: db.t4g.micro)"
  type        = string
  default     = "db.t4g.micro"
}
