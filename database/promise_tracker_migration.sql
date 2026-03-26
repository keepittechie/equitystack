-- Forward migration for Promise Tracker v1
-- Schema only. Demo seed data lives in database/promise_tracker_seed.sql.

USE black_policy_tracker;

START TRANSACTION;

CREATE TABLE IF NOT EXISTS `promises` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `president_id` int(11) NOT NULL,
  `title` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `promise_text` text NOT NULL,
  `promise_date` date DEFAULT NULL,
  `promise_type` enum('Campaign Promise','Official Promise','Public Promise','Executive Agenda','Other') NOT NULL DEFAULT 'Public Promise',
  `campaign_or_official` enum('Campaign','Official') NOT NULL DEFAULT 'Official',
  `topic` varchar(150) DEFAULT NULL,
  `impacted_group` varchar(255) DEFAULT NULL,
  `status` enum('Delivered','In Progress','Partial','Failed','Blocked') NOT NULL DEFAULT 'In Progress',
  `summary` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `is_demo` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_promises_slug` (`slug`),
  KEY `idx_promises_president_id` (`president_id`),
  KEY `idx_promises_status` (`status`),
  KEY `idx_promises_topic` (`topic`),
  KEY `idx_promises_promise_date` (`promise_date`),
  KEY `idx_promises_is_demo` (`is_demo`),
  CONSTRAINT `promises_ibfk_1` FOREIGN KEY (`president_id`) REFERENCES `presidents` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `promise_actions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `promise_id` int(11) NOT NULL,
  `action_type` enum('Executive Order','Bill','Policy','Agency Action','Court-Related Action','Public Reversal','Statement','Other') NOT NULL DEFAULT 'Other',
  `action_date` date DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `related_policy_id` int(11) DEFAULT NULL,
  `related_explainer_id` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_promise_actions_promise_id` (`promise_id`),
  KEY `idx_promise_actions_action_date` (`action_date`),
  KEY `idx_promise_actions_action_type` (`action_type`),
  KEY `idx_promise_actions_related_policy_id` (`related_policy_id`),
  KEY `idx_promise_actions_related_explainer_id` (`related_explainer_id`),
  CONSTRAINT `promise_actions_ibfk_1` FOREIGN KEY (`promise_id`) REFERENCES `promises` (`id`) ON DELETE CASCADE,
  CONSTRAINT `promise_actions_ibfk_2` FOREIGN KEY (`related_policy_id`) REFERENCES `policies` (`id`) ON DELETE SET NULL,
  CONSTRAINT `promise_actions_ibfk_3` FOREIGN KEY (`related_explainer_id`) REFERENCES `explainers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `promise_outcomes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `promise_id` int(11) NOT NULL,
  `outcome_summary` text NOT NULL,
  `outcome_type` enum('Legislative Outcome','Administrative Outcome','Legal Outcome','Economic Outcome','Housing Outcome','Voting Outcome','Narrative Outcome','Other') NOT NULL DEFAULT 'Other',
  `measurable_impact` text DEFAULT NULL,
  `impact_direction` enum('Positive','Negative','Mixed','Blocked') DEFAULT 'Mixed',
  `black_community_impact_note` text DEFAULT NULL,
  `evidence_strength` enum('Strong','Moderate','Limited') DEFAULT 'Moderate',
  `status_override` enum('Delivered','In Progress','Partial','Failed','Blocked') DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_promise_outcomes_promise_id` (`promise_id`),
  KEY `idx_promise_outcomes_impact_direction` (`impact_direction`),
  KEY `idx_promise_outcomes_evidence_strength` (`evidence_strength`),
  KEY `idx_promise_outcomes_status_override` (`status_override`),
  CONSTRAINT `promise_outcomes_ibfk_1` FOREIGN KEY (`promise_id`) REFERENCES `promises` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `promise_sources` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `promise_id` int(11) NOT NULL,
  `source_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_promise_sources` (`promise_id`,`source_id`),
  KEY `idx_promise_sources_promise_id` (`promise_id`),
  KEY `idx_promise_sources_source_id` (`source_id`),
  CONSTRAINT `promise_sources_ibfk_1` FOREIGN KEY (`promise_id`) REFERENCES `promises` (`id`) ON DELETE CASCADE,
  CONSTRAINT `promise_sources_ibfk_2` FOREIGN KEY (`source_id`) REFERENCES `sources` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `promise_action_sources` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `promise_action_id` int(11) NOT NULL,
  `source_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_promise_action_sources` (`promise_action_id`,`source_id`),
  KEY `idx_promise_action_sources_action_id` (`promise_action_id`),
  KEY `idx_promise_action_sources_source_id` (`source_id`),
  CONSTRAINT `promise_action_sources_ibfk_1` FOREIGN KEY (`promise_action_id`) REFERENCES `promise_actions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `promise_action_sources_ibfk_2` FOREIGN KEY (`source_id`) REFERENCES `sources` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `promise_outcome_sources` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `promise_outcome_id` int(11) NOT NULL,
  `source_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_promise_outcome_sources` (`promise_outcome_id`,`source_id`),
  KEY `idx_promise_outcome_sources_outcome_id` (`promise_outcome_id`),
  KEY `idx_promise_outcome_sources_source_id` (`source_id`),
  CONSTRAINT `promise_outcome_sources_ibfk_1` FOREIGN KEY (`promise_outcome_id`) REFERENCES `promise_outcomes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `promise_outcome_sources_ibfk_2` FOREIGN KEY (`source_id`) REFERENCES `sources` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

COMMIT;
