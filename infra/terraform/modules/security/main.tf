variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "documents_bucket_arn" {
  type = string
}

variable "ingest_queue_arn" {
  type = string
}

resource "aws_ssm_parameter" "database_url" {
  name        = "/${var.project_name}/${var.environment}/database-url"
  description = "String de conexao PostgreSQL para RDS"
  type        = "SecureString"
  value       = "CHANGE_ME_VIA_AWS_CLI_OR_CONSOLE"

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "anthropic_api_key" {
  name        = "/${var.project_name}/${var.environment}/anthropic-api-key"
  description = "Chave da API da Anthropic (Claude)"
  type        = "SecureString"
  value       = "CHANGE_ME_VIA_AWS_CLI_OR_CONSOLE"

  lifecycle {
    ignore_changes = [value]
  }
}

data "aws_iam_policy_document" "ecs_task_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_execution" {
  name               = "${var.project_name}-ecs-execution-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume.json
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_ssm" {
  name = "${var.project_name}-ecs-execution-ssm"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameters",
          "ssm:GetParameter"
        ]
        Resource = [
          aws_ssm_parameter.database_url.arn,
          aws_ssm_parameter.anthropic_api_key.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role" "api_task" {
  name               = "${var.project_name}-api-task-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume.json
}

resource "aws_iam_role_policy" "api_least_privilege" {
  name = "${var.project_name}-api-least-privilege"
  role = aws_iam_role.api_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "AllowPutPresignedUploadToDocumentsBucket"
        Effect   = "Allow"
        Action   = ["s3:PutObject"]
        Resource = ["${var.documents_bucket_arn}/uploads/*"]
      },
      {
        Sid      = "AllowPublishIngestJobToSqs"
        Effect   = "Allow"
        Action   = ["sqs:SendMessage"]
        Resource = [var.ingest_queue_arn]
      }
    ]
  })
}

resource "aws_iam_role" "worker_task" {
  name               = "${var.project_name}-worker-task-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume.json
}

resource "aws_iam_role_policy" "worker_least_privilege" {
  name = "${var.project_name}-worker-least-privilege"
  role = aws_iam_role.worker_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "AllowReadUploadedDocumentsFromS3"
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = ["${var.documents_bucket_arn}/uploads/*"]
      },
      {
        Sid    = "AllowConsumeIngestQueue"
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [var.ingest_queue_arn]
      }
    ]
  })
}
