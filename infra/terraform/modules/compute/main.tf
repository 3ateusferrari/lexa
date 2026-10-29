variable "project_name" {
  type = string
}

variable "aws_region" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "compute_sg_id" {
  type = string
}

variable "ecs_execution_role_arn" {
  type = string
}

variable "api_task_role_arn" {
  type = string
}

variable "worker_task_role_arn" {
  type = string
}

variable "database_url_ssm_arn" {
  type = string
}

variable "anthropic_api_key_ssm_arn" {
  type = string
}

variable "documents_bucket_name" {
  type = string
}

variable "ingest_queue_url" {
  type = string
}

resource "aws_ecr_repository" "app" {
  name                 = "${var.project_name}-app"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/${var.project_name}"
  retention_in_days = 14
}

resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_task_definition" "api" {
  family                   = "${var.project_name}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = var.ecs_execution_role_arn
  task_role_arn            = var.api_task_role_arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = "${aws_ecr_repository.app.repository_url}:latest"
      essential = true
      portMappings = [
        {
          containerPort = 3000
          hostPort      = 3000
          protocol      = "tcp"
        }
      ]
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "3000" },
        { name = "S3_DOCUMENTS_BUCKET", value = var.documents_bucket_name },
        { name = "SQS_INGEST_QUEUE_URL", value = var.ingest_queue_url }
      ]
      secrets = [
        { name = "DATABASE_URL", valueFrom = var.database_url_ssm_arn },
        { name = "ANTHROPIC_API_KEY", valueFrom = var.anthropic_api_key_ssm_arn }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.ecs.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "api"
        }
      }
    }
  ])
}

resource "aws_ecs_task_definition" "worker" {
  family                   = "${var.project_name}-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = var.ecs_execution_role_arn
  task_role_arn            = var.worker_task_role_arn

  container_definitions = jsonencode([
    {
      name      = "worker"
      image     = "${aws_ecr_repository.app.repository_url}:latest"
      essential = true
      command   = ["node", "dist/modules/worker/sqs-worker.js"]
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "S3_DOCUMENTS_BUCKET", value = var.documents_bucket_name },
        { name = "SQS_INGEST_QUEUE_URL", value = var.ingest_queue_url }
      ]
      secrets = [
        { name = "DATABASE_URL", valueFrom = var.database_url_ssm_arn }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.ecs.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "worker"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "api" {
  name            = "${var.project_name}-api-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.public_subnet_ids
    security_groups  = [var.compute_sg_id]
    assign_public_ip = true
  }
}

resource "aws_ecs_service" "worker" {
  name            = "${var.project_name}-worker-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.public_subnet_ids
    security_groups  = [var.compute_sg_id]
    assign_public_ip = true
  }
}

output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_log_group_name" {
  value = aws_cloudwatch_log_group.ecs.name
}
