variable "project_name" {
  type = string
}

variable "alert_email" {
  type = string
}

variable "dlq_name" {
  type = string
}

resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-cloudwatch-alerts-topic"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

resource "aws_cloudwatch_metric_alarm" "api_5xx_errors" {
  alarm_name          = "${var.project_name}-api-high-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Disparado quando a API retorna mais de 5 erros HTTP 5XX em 5 minutos"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"
}

resource "aws_cloudwatch_metric_alarm" "dlq_messages_visible" {
  alarm_name          = "${var.project_name}-dlq-messages-detected"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "Disparado imediatamente quando uma mensagem de falha e movida para a Dead-Letter Queue"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  dimensions = {
    QueueName = var.dlq_name
  }
}

resource "aws_cloudwatch_metric_alarm" "rag_latency_high" {
  alarm_name          = "${var.project_name}-rag-p95-latency-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  extended_statistic  = "p95"
  threshold           = 4
  alarm_description   = "Disparado quando a latencia p95 das consultas RAG ultrapassa 4 segundos"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"
}

output "alerts_sns_topic_arn" {
  value = aws_sns_topic.alerts.arn
}
