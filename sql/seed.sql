INSERT INTO disease_master (disease_code, disease_name, therapeutic_area)
VALUES
('OBESITY', 'Obesity / chronic weight management', 'Cardiometabolic'),
('T2D', 'Type 2 diabetes', 'Diabetes'),
('CKD', 'Chronic kidney disease', 'Cardiometabolic'),
('CVD', 'Cardiovascular disease', 'Cardiometabolic'),
('MASH', 'Metabolic dysfunction-associated steatohepatitis', 'Cardiometabolic'),
('HAEM_A', 'Haemophilia A', 'Rare disease')
ON CONFLICT (disease_code) DO NOTHING;

INSERT INTO subgroup_master
(disease_code, subgroup_dimension, subgroup_code, subgroup_label, sort_order)
VALUES
('OBESITY', 'BMI_CLASS', 'BMI_27_29', 'BMI 27-29.9', 1),
('OBESITY', 'BMI_CLASS', 'BMI_30_34', 'BMI 30-34.9', 2),
('OBESITY', 'BMI_CLASS', 'BMI_35_39', 'BMI 35-39.9', 3),
('OBESITY', 'BMI_CLASS', 'BMI_40_PLUS', 'BMI 40+', 4),
('OBESITY', 'T2D_STATUS', 'WITH_T2D', 'With type 2 diabetes', 1),
('OBESITY', 'T2D_STATUS', 'WITHOUT_T2D', 'Without type 2 diabetes', 2),
('OBESITY', 'CVD_STATUS', 'WITH_CVD', 'Established CVD', 1),
('OBESITY', 'CVD_STATUS', 'WITHOUT_CVD', 'Without established CVD', 2),
('CKD', 'CKD_STAGE', 'G3A', 'CKD G3a', 1),
('CKD', 'CKD_STAGE', 'G3B', 'CKD G3b', 2),
('CKD', 'CKD_STAGE', 'G4', 'CKD G4', 3),
('MASH', 'FIBROSIS_STAGE', 'F2', 'Fibrosis F2', 1),
('MASH', 'FIBROSIS_STAGE', 'F3', 'Fibrosis F3', 2)
ON CONFLICT DO NOTHING;

INSERT INTO source_registry
(source_code, source_name, source_type, base_endpoint, refresh_frequency_hours)
VALUES
('WORLD_BANK', 'World Bank', 'PUBLIC_API', 'https://api.worldbank.org/v2', 48),
('CLINICALTRIALS', 'ClinicalTrials.gov', 'PUBLIC_API', 'https://clinicaltrials.gov/api/v2', 48),
('OPENFDA', 'openFDA', 'PUBLIC_API', 'https://api.fda.gov', 48),
('WHO', 'World Health Organization', 'PUBLIC_DATASET', 'https://www.who.int/data', 48),
('NPPA', 'National Pharmaceutical Pricing Authority', 'REGULATORY_SOURCE', 'https://nppa.gov.in', 48)
ON CONFLICT (source_code) DO NOTHING;

INSERT INTO scenario (scenario_id, disease_code, scenario_name, description, is_default)
VALUES
('BASE', 'OBESITY', 'Base case', 'Base early-stage assumptions', TRUE),
('LOW', 'OBESITY', 'Low impact', 'Lower price and uptake assumptions', FALSE),
('HIGH', 'OBESITY', 'High impact', 'Higher price and uptake assumptions', FALSE)
ON CONFLICT DO NOTHING;

INSERT INTO treatment
(disease_code, treatment_code, treatment_name, treatment_type)
VALUES
('OBESITY', 'CURRENT_RX', 'Current pharmacotherapy', 'CURRENT'),
('OBESITY', 'LIFESTYLE', 'Lifestyle / no pharmacotherapy', 'CURRENT'),
('OBESITY', 'NEW_DRUG', 'Early-stage intervention', 'NEW')
ON CONFLICT DO NOTHING;

INSERT INTO treatment_cost
(treatment_code, country_code, currency, annual_drug_cost, annual_admin_cost, annual_monitoring_cost, adherence, persistence, discontinuation, data_origin, validation_status)
VALUES
('CURRENT_RX', 'IND', 'INR', 30000, 500, 2000, 0.75, 0.75, 0.20, 'DEFAULT_ASSUMPTION', 'POC_INPUT'),
('LIFESTYLE', 'IND', 'INR', 0, 0, 1500, 1.00, 1.00, 0.00, 'DEFAULT_ASSUMPTION', 'POC_INPUT'),
('NEW_DRUG', 'IND', 'INR', 120000, 2000, 4000, 0.85, 0.80, 0.15, 'DEFAULT_ASSUMPTION', 'POC_INPUT');

INSERT INTO market_share
(disease_code, treatment_code, country_code, scenario_id, model_year, market_share)
VALUES
('OBESITY', 'CURRENT_RX', 'IND', 'BASE', 1, 0.70),
('OBESITY', 'LIFESTYLE', 'IND', 'BASE', 1, 0.30)
ON CONFLICT DO NOTHING;

INSERT INTO clinical_outcome
(disease_code, outcome_code, outcome_name, current_annual_rate, new_relative_risk, cost_per_event, currency, validation_status)
VALUES
('OBESITY', 'DIAB_CARE', 'Diabetes-related event / care', 0.050, 0.85, 25000, 'INR', 'POC_INPUT'),
('OBESITY', 'CV_EVENT', 'Cardiovascular event', 0.010, 0.90, 120000, 'INR', 'POC_INPUT'),
('OBESITY', 'HOSP', 'Hospitalization / complication', 0.020, 0.92, 45000, 'INR', 'POC_INPUT')
ON CONFLICT DO NOTHING;
