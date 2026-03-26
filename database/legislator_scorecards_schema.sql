CREATE TABLE legislators (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  bioguide_id VARCHAR(32) NULL,
  full_name VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NULL,
  chamber ENUM('House','Senate') NOT NULL,
  party VARCHAR(100) NULL,
  state VARCHAR(50) NULL,
  district VARCHAR(25) NULL,
  status ENUM('Active','Former') NOT NULL DEFAULT 'Active',
  website_url VARCHAR(500) NULL,
  congress_api_url VARCHAR(500) NULL,
  photo_url VARCHAR(500) NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_legislators_bioguide (bioguide_id)
);

CREATE TABLE legislator_tracked_bill_roles (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  legislator_id INT NOT NULL,
  tracked_bill_id INT NOT NULL,
  role ENUM('Primary Sponsor','Cosponsor','Committee Chair','Committee Member') NOT NULL,
  source_system VARCHAR(100) NULL,
  source_url VARCHAR(500) NULL,
  role_date DATE NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ltbr_legislator
    FOREIGN KEY (legislator_id) REFERENCES legislators(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_ltbr_tracked_bill
    FOREIGN KEY (tracked_bill_id) REFERENCES tracked_bills(id)
    ON DELETE CASCADE,
  UNIQUE KEY uniq_legislator_bill_role (legislator_id, tracked_bill_id, role)
);

CREATE TABLE legislator_future_bill_positions (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  legislator_id INT NOT NULL,
  future_bill_id INT NOT NULL,
  position_type ENUM('Sponsor','Cosponsor','Public Support','Public Opposition','Advocacy Lead') NOT NULL,
  notes TEXT NULL,
  source_url VARCHAR(500) NULL,
  source_date DATE NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_lfbp_legislator
    FOREIGN KEY (legislator_id) REFERENCES legislators(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_lfbp_future_bill
    FOREIGN KEY (future_bill_id) REFERENCES future_bills(id)
    ON DELETE CASCADE,
  UNIQUE KEY uniq_legislator_future_bill_position (legislator_id, future_bill_id, position_type)
);

CREATE TABLE legislator_scorecard_snapshots (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  legislator_id INT NOT NULL,
  snapshot_label VARCHAR(100) NOT NULL,
  scoring_window_start DATE NULL,
  scoring_window_end DATE NULL,
  total_tracked_bills INT NOT NULL DEFAULT 0,
  sponsored_bill_count INT NOT NULL DEFAULT 0,
  cosponsored_bill_count INT NOT NULL DEFAULT 0,
  positive_bill_count INT NOT NULL DEFAULT 0,
  negative_bill_count INT NOT NULL DEFAULT 0,
  mixed_bill_count INT NOT NULL DEFAULT 0,
  blocked_bill_count INT NOT NULL DEFAULT 0,
  direct_black_impact_bill_count INT NOT NULL DEFAULT 0,
  avg_policy_impact_score DECIMAL(8,2) NULL,
  net_weighted_impact DECIMAL(10,2) NULL,
  score_notes TEXT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_lss_legislator
    FOREIGN KEY (legislator_id) REFERENCES legislators(id)
    ON DELETE CASCADE
);
