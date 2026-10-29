output "database_url_ssm_arn" {
  value = aws_ssm_parameter.database_url.arn
}

output "anthropic_api_key_ssm_arn" {
  value = aws_ssm_parameter.anthropic_api_key.arn
}

output "ecs_execution_role_arn" {
  value = aws_iam_role.ecs_execution.arn
}

output "api_task_role_arn" {
  value = aws_iam_role.api_task.arn
}

output "worker_task_role_arn" {
  value = aws_iam_role.worker_task.arn
}
