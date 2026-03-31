CREATE TABLE IF NOT EXISTS operator_job_runs (
  id VARCHAR(191) NOT NULL,
  action_id VARCHAR(128) NOT NULL,
  action_title VARCHAR(255) NOT NULL,
  workflow_family VARCHAR(64) NOT NULL,
  runner_type VARCHAR(64) NOT NULL DEFAULT 'cli',
  status VARCHAR(64) NOT NULL,
  summary TEXT NULL,
  error_json LONGTEXT NULL,
  input_json LONGTEXT NULL,
  command_json LONGTEXT NULL,
  job_log_path VARCHAR(512) NULL,
  artifacts_json LONGTEXT NULL,
  session_ids_json LONGTEXT NULL,
  output_json LONGTEXT NULL,
  metadata_json LONGTEXT NULL,
  cancellation_json LONGTEXT NULL,
  executor_model VARCHAR(128) NULL,
  executor_backend VARCHAR(128) NULL,
  executor_host VARCHAR(255) NULL,
  executor_transport VARCHAR(128) NULL,
  execution_mode VARCHAR(128) NULL,
  created_at DATETIME(3) NOT NULL,
  queued_at DATETIME(3) NULL,
  started_at DATETIME(3) NULL,
  finished_at DATETIME(3) NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_operator_job_runs_status (status),
  KEY idx_operator_job_runs_workflow_family (workflow_family),
  KEY idx_operator_job_runs_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS operator_job_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_run_id VARCHAR(191) NOT NULL,
  level VARCHAR(32) NOT NULL DEFAULT 'info',
  message LONGTEXT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_operator_job_logs_job_run_id_created_at (job_run_id, created_at),
  CONSTRAINT fk_operator_job_logs_job_run
    FOREIGN KEY (job_run_id) REFERENCES operator_job_runs (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS operator_workflow_sessions (
  id VARCHAR(191) NOT NULL,
  workflow_family VARCHAR(64) NOT NULL,
  canonical_session_key VARCHAR(255) NOT NULL,
  canonical_state VARCHAR(64) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  recommended_action_id VARCHAR(128) NULL,
  source VARCHAR(64) NOT NULL DEFAULT 'canonical_artifacts',
  title VARCHAR(255) NOT NULL,
  summary TEXT NULL,
  href VARCHAR(255) NULL,
  operator_surface_href VARCHAR(255) NULL,
  metadata_json LONGTEXT NULL,
  related_job_run_ids_json LONGTEXT NULL,
  executor_model VARCHAR(128) NULL,
  executor_backend VARCHAR(128) NULL,
  executor_host VARCHAR(255) NULL,
  executor_transport VARCHAR(128) NULL,
  execution_mode VARCHAR(128) NULL,
  created_at DATETIME(3) NOT NULL,
  started_at DATETIME(3) NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_operator_workflow_sessions_family_active (workflow_family, active),
  KEY idx_operator_workflow_sessions_updated_at (updated_at),
  KEY idx_operator_workflow_sessions_session_key (canonical_session_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS operator_artifacts (
  id VARCHAR(191) NOT NULL,
  session_id VARCHAR(191) NOT NULL,
  workflow_family VARCHAR(64) NOT NULL,
  artifact_key VARCHAR(128) NOT NULL,
  label VARCHAR(255) NOT NULL,
  stage VARCHAR(128) NULL,
  canonical_path TEXT NULL,
  file_name VARCHAR(255) NULL,
  exists_flag TINYINT(1) NOT NULL DEFAULT 0,
  generated_at DATETIME(3) NULL,
  source VARCHAR(64) NOT NULL DEFAULT 'canonical_artifact',
  latest_job_run_id VARCHAR(191) NULL,
  related_job_run_ids_json LONGTEXT NULL,
  metadata_json LONGTEXT NULL,
  executor_model VARCHAR(128) NULL,
  executor_backend VARCHAR(128) NULL,
  executor_host VARCHAR(255) NULL,
  executor_transport VARCHAR(128) NULL,
  execution_mode VARCHAR(128) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_operator_artifacts_session_id (session_id),
  KEY idx_operator_artifacts_workflow_family (workflow_family),
  KEY idx_operator_artifacts_artifact_key (artifact_key),
  KEY idx_operator_artifacts_latest_job_run_id (latest_job_run_id),
  CONSTRAINT fk_operator_artifacts_session
    FOREIGN KEY (session_id) REFERENCES operator_workflow_sessions (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_operator_artifacts_latest_job
    FOREIGN KEY (latest_job_run_id) REFERENCES operator_job_runs (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS operator_review_queue_items (
  id VARCHAR(191) NOT NULL,
  workflow_family VARCHAR(64) NOT NULL,
  session_id VARCHAR(191) NOT NULL,
  source_artifact_id VARCHAR(191) NULL,
  source_artifact_path TEXT NULL,
  queue_type VARCHAR(128) NOT NULL,
  state VARCHAR(64) NOT NULL,
  priority VARCHAR(64) NOT NULL DEFAULT 'unknown',
  recommended_action_id VARCHAR(128) NULL,
  title VARCHAR(255) NOT NULL,
  detail_text TEXT NULL,
  href VARCHAR(255) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  metadata_json LONGTEXT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_operator_review_queue_session_id_active (session_id, active),
  KEY idx_operator_review_queue_workflow_family (workflow_family),
  KEY idx_operator_review_queue_state (state),
  CONSTRAINT fk_operator_review_queue_session
    FOREIGN KEY (session_id) REFERENCES operator_workflow_sessions (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_operator_review_queue_source_artifact
    FOREIGN KEY (source_artifact_id) REFERENCES operator_artifacts (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS operator_system_signals (
  id VARCHAR(191) NOT NULL,
  workflow_family VARCHAR(64) NULL,
  signal_type VARCHAR(128) NOT NULL,
  severity VARCHAR(32) NOT NULL DEFAULT 'info',
  state VARCHAR(64) NOT NULL DEFAULT 'open',
  title VARCHAR(255) NOT NULL,
  summary TEXT NULL,
  href VARCHAR(255) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  session_id VARCHAR(191) NULL,
  artifact_id VARCHAR(191) NULL,
  job_run_id VARCHAR(191) NULL,
  metadata_json LONGTEXT NULL,
  observed_at DATETIME(3) NOT NULL,
  resolved_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_operator_system_signals_active (active),
  KEY idx_operator_system_signals_workflow_family (workflow_family),
  KEY idx_operator_system_signals_severity (severity),
  CONSTRAINT fk_operator_system_signals_session
    FOREIGN KEY (session_id) REFERENCES operator_workflow_sessions (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_operator_system_signals_artifact
    FOREIGN KEY (artifact_id) REFERENCES operator_artifacts (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_operator_system_signals_job
    FOREIGN KEY (job_run_id) REFERENCES operator_job_runs (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS operator_command_history (
  id VARCHAR(191) NOT NULL,
  raw_command TEXT NOT NULL,
  normalized_command VARCHAR(255) NOT NULL,
  result_type VARCHAR(64) NOT NULL,
  result_status VARCHAR(64) NOT NULL,
  title VARCHAR(255) NULL,
  summary TEXT NULL,
  action_id VARCHAR(128) NULL,
  selected_session_id VARCHAR(191) NULL,
  related_session_id VARCHAR(191) NULL,
  related_job_id VARCHAR(191) NULL,
  confirmation_required TINYINT(1) NOT NULL DEFAULT 0,
  payload_json LONGTEXT NULL,
  executed_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_operator_command_history_executed_at (executed_at),
  KEY idx_operator_command_history_result_status (result_status),
  KEY idx_operator_command_history_related_job (related_job_id),
  CONSTRAINT fk_operator_command_history_selected_session
    FOREIGN KEY (selected_session_id) REFERENCES operator_workflow_sessions (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_operator_command_history_related_session
    FOREIGN KEY (related_session_id) REFERENCES operator_workflow_sessions (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_operator_command_history_job
    FOREIGN KEY (related_job_id) REFERENCES operator_job_runs (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS operator_schedules (
  id VARCHAR(191) NOT NULL,
  title VARCHAR(255) NOT NULL,
  action_id VARCHAR(128) NOT NULL,
  workflow_family VARCHAR(64) NOT NULL,
  schedule_type VARCHAR(64) NOT NULL,
  schedule_expression VARCHAR(255) NULL,
  timezone VARCHAR(64) NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  safe_auto_run TINYINT(1) NOT NULL DEFAULT 0,
  requires_human_checkpoint TINYINT(1) NOT NULL DEFAULT 1,
  execution_mode VARCHAR(128) NULL,
  default_input_json LONGTEXT NULL,
  default_context_json LONGTEXT NULL,
  last_run_at DATETIME(3) NULL,
  next_run_at DATETIME(3) NULL,
  last_job_id VARCHAR(191) NULL,
  status VARCHAR(64) NOT NULL DEFAULT 'manual',
  last_result_summary TEXT NULL,
  metadata_json LONGTEXT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_operator_schedules_enabled_next_run (enabled, next_run_at),
  KEY idx_operator_schedules_action_id (action_id),
  KEY idx_operator_schedules_workflow_family (workflow_family),
  KEY idx_operator_schedules_status (status),
  CONSTRAINT fk_operator_schedules_last_job
    FOREIGN KEY (last_job_id) REFERENCES operator_job_runs (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE operator_job_runs
  ADD COLUMN IF NOT EXISTS executor_transport VARCHAR(128) NULL AFTER executor_host,
  ADD COLUMN IF NOT EXISTS execution_mode VARCHAR(128) NULL AFTER executor_transport;

ALTER TABLE operator_workflow_sessions
  ADD COLUMN IF NOT EXISTS executor_transport VARCHAR(128) NULL AFTER executor_host,
  ADD COLUMN IF NOT EXISTS execution_mode VARCHAR(128) NULL AFTER executor_transport;

ALTER TABLE operator_artifacts
  ADD COLUMN IF NOT EXISTS executor_transport VARCHAR(128) NULL AFTER executor_host,
  ADD COLUMN IF NOT EXISTS execution_mode VARCHAR(128) NULL AFTER executor_transport;

ALTER TABLE operator_schedules
  ADD COLUMN IF NOT EXISTS execution_mode VARCHAR(128) NULL AFTER requires_human_checkpoint;
