CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS disease_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disease_code VARCHAR(64) UNIQUE NOT NULL,
    disease_name VARCHAR(255) NOT NULL,
    therapeutic_area VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subgroup_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disease_code VARCHAR(64) NOT NULL REFERENCES disease_master(disease_code) ON DELETE CASCADE,
    subgroup_dimension VARCHAR(128) NOT NULL,
    subgroup_code VARCHAR(128) NOT NULL,
    subgroup_label VARCHAR(255) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(disease_code, subgroup_dimension, subgroup_code)
);

CREATE TABLE IF NOT EXISTS source_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_code VARCHAR(64) UNIQUE NOT NULL,
    source_name VARCHAR(255) NOT NULL,
    source_type VARCHAR(64) NOT NULL,
    base_endpoint TEXT,
    refresh_frequency_hours INTEGER NOT NULL DEFAULT 48,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_checked_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    parser_version VARCHAR(64) DEFAULT '1.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS model_parameter (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disease_code VARCHAR(64) NOT NULL,
    indication VARCHAR(255),
    subgroup_dimension VARCHAR(128),
    subgroup_value VARCHAR(128),
    country_code VARCHAR(16),
    region VARCHAR(128),
    payer_type VARCHAR(128),
    perspective VARCHAR(128),
    scenario_id VARCHAR(64) NOT NULL DEFAULT 'BASE',
    parameter_category VARCHAR(128) NOT NULL,
    parameter_name VARCHAR(128) NOT NULL,
    parameter_value NUMERIC,
    parameter_text TEXT,
    unit VARCHAR(64),
    lower_bound NUMERIC,
    upper_bound NUMERIC,
    effective_from DATE,
    effective_to DATE,
    source_code VARCHAR(64),
    source_record_id VARCHAR(255),
    source_url TEXT,
    source_publication_date DATE,
    source_last_updated TIMESTAMPTZ,
    retrieved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    data_origin VARCHAR(64) NOT NULL DEFAULT 'DEFAULT_ASSUMPTION',
    validation_status VARCHAR(64) NOT NULL DEFAULT 'PENDING_REVIEW',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_user_override BOOLEAN NOT NULL DEFAULT FALSE,
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_model_parameter_lookup
ON model_parameter (
    disease_code,
    country_code,
    scenario_id,
    parameter_name,
    is_active,
    retrieved_at DESC
);

CREATE TABLE IF NOT EXISTS treatment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disease_code VARCHAR(64) NOT NULL,
    treatment_code VARCHAR(64) NOT NULL,
    treatment_name VARCHAR(255) NOT NULL,
    treatment_type VARCHAR(64) NOT NULL CHECK (treatment_type IN ('CURRENT', 'NEW')),
    drug_class VARCHAR(255),
    route VARCHAR(64),
    dose VARCHAR(128),
    frequency VARCHAR(128),
    source_code VARCHAR(64),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(disease_code, treatment_code)
);

CREATE TABLE IF NOT EXISTS treatment_cost (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    treatment_code VARCHAR(64) NOT NULL,
    country_code VARCHAR(16) NOT NULL,
    currency VARCHAR(16) NOT NULL,
    annual_drug_cost NUMERIC NOT NULL DEFAULT 0,
    annual_admin_cost NUMERIC NOT NULL DEFAULT 0,
    annual_monitoring_cost NUMERIC NOT NULL DEFAULT 0,
    annual_device_cost NUMERIC NOT NULL DEFAULT 0,
    adherence NUMERIC NOT NULL DEFAULT 1,
    persistence NUMERIC NOT NULL DEFAULT 1,
    discontinuation NUMERIC NOT NULL DEFAULT 0,
    source_code VARCHAR(64),
    source_url TEXT,
    effective_year INTEGER,
    data_origin VARCHAR(64) NOT NULL DEFAULT 'DEFAULT_ASSUMPTION',
    validation_status VARCHAR(64) NOT NULL DEFAULT 'PENDING_REVIEW',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market_share (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disease_code VARCHAR(64) NOT NULL,
    treatment_code VARCHAR(64) NOT NULL,
    country_code VARCHAR(16) NOT NULL,
    scenario_id VARCHAR(64) NOT NULL DEFAULT 'BASE',
    model_year INTEGER NOT NULL,
    market_share NUMERIC NOT NULL CHECK (market_share >= 0 AND market_share <= 1),
    data_origin VARCHAR(64) NOT NULL DEFAULT 'USER_OVERRIDE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(disease_code, treatment_code, country_code, scenario_id, model_year)
);

CREATE TABLE IF NOT EXISTS clinical_outcome (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disease_code VARCHAR(64) NOT NULL,
    outcome_code VARCHAR(64) NOT NULL,
    outcome_name VARCHAR(255) NOT NULL,
    current_annual_rate NUMERIC NOT NULL DEFAULT 0,
    new_relative_risk NUMERIC NOT NULL DEFAULT 1,
    cost_per_event NUMERIC NOT NULL DEFAULT 0,
    currency VARCHAR(16) NOT NULL DEFAULT 'INR',
    source_code VARCHAR(64),
    source_url TEXT,
    validation_status VARCHAR(64) NOT NULL DEFAULT 'PENDING_REVIEW',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(disease_code, outcome_code)
);

CREATE TABLE IF NOT EXISTS scenario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id VARCHAR(64) NOT NULL,
    disease_code VARCHAR(64) NOT NULL,
    scenario_name VARCHAR(255) NOT NULL,
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(disease_code, scenario_id)
);

CREATE TABLE IF NOT EXISTS scenario_parameter (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disease_code VARCHAR(64) NOT NULL,
    scenario_id VARCHAR(64) NOT NULL,
    parameter_name VARCHAR(128) NOT NULL,
    parameter_value NUMERIC,
    unit VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(disease_code, scenario_id, parameter_name)
);

CREATE TABLE IF NOT EXISTS budget_impact_run (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disease_code VARCHAR(64) NOT NULL,
    country_code VARCHAR(16),
    scenario_id VARCHAR(64) NOT NULL DEFAULT 'BASE',
    model_name VARCHAR(255),
    currency VARCHAR(16) NOT NULL DEFAULT 'INR',
    perspective VARCHAR(128),
    base_year INTEGER NOT NULL,
    time_horizon_years INTEGER NOT NULL,
    inputs_json JSONB NOT NULL,
    summary_json JSONB NOT NULL,
    annual_results_json JSONB NOT NULL,
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS data_refresh_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_code VARCHAR(64) NOT NULL,
    job_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    job_completed_at TIMESTAMPTZ,
    records_requested INTEGER DEFAULT 0,
    records_received INTEGER DEFAULT 0,
    records_inserted INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_unchanged INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    status VARCHAR(64) NOT NULL DEFAULT 'RUNNING',
    error_message TEXT
);

CREATE TABLE IF NOT EXISTS import_job (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_filename VARCHAR(255) NOT NULL,
    imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    disease_code VARCHAR(64),
    status VARCHAR(64) NOT NULL DEFAULT 'IMPORTED',
    row_count INTEGER DEFAULT 0,
    validation_messages JSONB DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS clinical_trial_snapshot (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nct_id VARCHAR(32) NOT NULL,
    disease_code VARCHAR(64),
    condition_text TEXT,
    intervention_name TEXT,
    phase VARCHAR(128),
    overall_status VARCHAR(128),
    sponsor TEXT,
    enrollment INTEGER,
    min_age TEXT,
    max_age TEXT,
    sex VARCHAR(32),
    primary_outcomes JSONB,
    secondary_outcomes JSONB,
    source_url TEXT,
    source_last_updated TIMESTAMPTZ,
    retrieved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trial_nct_retrieved
ON clinical_trial_snapshot(nct_id, retrieved_at DESC);
