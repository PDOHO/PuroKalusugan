-- 4. NEW BLAZING FAST GET DASHBOARD STATS RPC
-- Replaces linear table scans with materialized view scans
DROP FUNCTION IF EXISTS public.get_dashboard_service_stats_mv(text, text, date, date);
CREATE OR REPLACE FUNCTION public.get_dashboard_service_stats_mv(
    p_municipality text DEFAULT NULL,
    p_barangay text DEFAULT NULL,
    p_start_date date DEFAULT NULL,
    p_end_date date DEFAULT NULL
)
RETURNS json
SECURITY DEFINER
AS $$
DECLARE
    v_result json;
    v_sql text;
BEGIN
    v_sql := $query$
    WITH raw_summary AS (
        SELECT * FROM public.mv_patient_first_services WHERE 1=1
    $query$;

    IF p_municipality IS NOT NULL THEN
        v_sql := v_sql || ' AND lmuni = LOWER($1)';
    END IF;
    IF p_barangay IS NOT NULL THEN
        v_sql := v_sql || ' AND lbrgy = LOWER($2)';
    END IF;

    v_sql := v_sql || $query$
    ),
    patient_period_summary AS (
        SELECT 
            patient_id, lmuni, lbrgy,
            CASE WHEN ($3::date IS NULL OR first_nutrition_date >= $3::date) AND ($4::date IS NULL OR first_nutrition_date <= $4::date) THEN first_nutrition_date ELSE NULL END as first_nutrition_date,
            CASE WHEN ($3::date IS NULL OR first_cancer_date >= $3::date) AND ($4::date IS NULL OR first_cancer_date <= $4::date) THEN first_cancer_date ELSE NULL END as first_cancer_date,
            CASE WHEN ($3::date IS NULL OR first_immunization_date >= $3::date) AND ($4::date IS NULL OR first_immunization_date <= $4::date) THEN first_immunization_date ELSE NULL END as first_immunization_date,
            CASE WHEN ($3::date IS NULL OR first_hpn_date >= $3::date) AND ($4::date IS NULL OR first_hpn_date <= $4::date) THEN first_hpn_date ELSE NULL END as first_hpn_date,
            CASE WHEN ($3::date IS NULL OR first_dm_date >= $3::date) AND ($4::date IS NULL OR first_dm_date <= $4::date) THEN first_dm_date ELSE NULL END as first_dm_date,
            CASE WHEN ($3::date IS NULL OR first_maternal_health_date >= $3::date) AND ($4::date IS NULL OR first_maternal_health_date <= $4::date) THEN first_maternal_health_date ELSE NULL END as first_maternal_health_date,
            CASE WHEN ($3::date IS NULL OR first_road_safety_date >= $3::date) AND ($4::date IS NULL OR first_road_safety_date <= $4::date) THEN first_road_safety_date ELSE NULL END as first_road_safety_date,
            CASE WHEN ($3::date IS NULL OR first_mental_health_date >= $3::date) AND ($4::date IS NULL OR first_mental_health_date <= $4::date) THEN first_mental_health_date ELSE NULL END as first_mental_health_date,
            CASE WHEN ($3::date IS NULL OR first_tb_date >= $3::date) AND ($4::date IS NULL OR first_tb_date <= $4::date) THEN first_tb_date ELSE NULL END as first_tb_date,
            CASE WHEN ($3::date IS NULL OR first_hiv_date >= $3::date) AND ($4::date IS NULL OR first_hiv_date <= $4::date) THEN first_hiv_date ELSE NULL END as first_hiv_date,
            CASE WHEN ($3::date IS NULL OR first_wash_date >= $3::date) AND ($4::date IS NULL OR first_wash_date <= $4::date) THEN first_wash_date ELSE NULL END as first_wash_date,
            CASE WHEN ($3::date IS NULL OR first_health_promotion_date >= $3::date) AND ($4::date IS NULL OR first_health_promotion_date <= $4::date) THEN first_health_promotion_date ELSE NULL END as first_health_promotion_date,
            CASE WHEN ($3::date IS NULL OR first_fpe_date >= $3::date) AND ($4::date IS NULL OR first_fpe_date <= $4::date) THEN first_fpe_date ELSE NULL END as first_fpe_date,
            CASE WHEN ($3::date IS NULL OR first_philhealth_date >= $3::date) AND ($4::date IS NULL OR first_philhealth_date <= $4::date) THEN first_philhealth_date ELSE NULL END as first_philhealth_date,
            CASE WHEN ($3::date IS NULL OR first_referral_date >= $3::date) AND ($4::date IS NULL OR first_referral_date <= $4::date) THEN first_referral_date ELSE NULL END as first_referral_date,
            CASE WHEN ($3::date IS NULL OR first_large_scale_pk_activity_date >= $3::date) AND ($4::date IS NULL OR first_large_scale_pk_activity_date <= $4::date) THEN first_large_scale_pk_activity_date ELSE NULL END as first_large_scale_pk_activity_date,
            CASE WHEN ($3::date IS NULL OR absolute_first_service_date >= $3::date) AND ($4::date IS NULL OR absolute_first_service_date <= $4::date) THEN absolute_first_service_date ELSE NULL END as absolute_first_service_date
        FROM raw_summary
    ),
    filtered_period AS (
        SELECT *,
            (first_nutrition_date IS NOT NULL) as nutrition,
            (first_cancer_date IS NOT NULL) as cancer,
            (first_immunization_date IS NOT NULL) as immunization,
            (first_hpn_date IS NOT NULL) as hpn,
            (first_dm_date IS NOT NULL) as dm,
            (first_maternal_health_date IS NOT NULL) as maternal_health,
            (first_road_safety_date IS NOT NULL) as road_safety,
            (first_mental_health_date IS NOT NULL) as mental_health,
            (first_tb_date IS NOT NULL) as tb,
            (first_hiv_date IS NOT NULL) as hiv,
            (first_wash_date IS NOT NULL) as wash,
            (first_health_promotion_date IS NOT NULL) as health_promotion,
            (first_fpe_date IS NOT NULL) as fpe,
            (first_philhealth_date IS NOT NULL) as philhealth,
            (first_referral_date IS NOT NULL) as referral,
            (first_large_scale_pk_activity_date IS NOT NULL) as large_scale_pk_activity,
            (absolute_first_service_date IS NOT NULL) as is_new_patient
        FROM patient_period_summary
        WHERE 
            first_nutrition_date IS NOT NULL OR first_cancer_date IS NOT NULL OR first_immunization_date IS NOT NULL OR
            first_hpn_date IS NOT NULL OR first_dm_date IS NOT NULL OR first_maternal_health_date IS NOT NULL OR
            first_road_safety_date IS NOT NULL OR first_mental_health_date IS NOT NULL OR first_tb_date IS NOT NULL OR
            first_hiv_date IS NOT NULL OR first_wash_date IS NOT NULL OR first_health_promotion_date IS NOT NULL OR
            first_fpe_date IS NOT NULL OR first_philhealth_date IS NOT NULL OR first_referral_date IS NOT NULL OR
            first_large_scale_pk_activity_date IS NOT NULL OR absolute_first_service_date IS NOT NULL
    ),
    served_by_muni AS (
        SELECT 
            lmuni,
            COUNT(DISTINCT patient_id) as served,
            COUNT(DISTINCT patient_id) FILTER (WHERE wash OR health_promotion OR fpe OR philhealth) as households_served
        FROM filtered_period
        GROUP BY lmuni
    ),
    served_by_brgy AS (
        SELECT 
            lmuni,
            lbrgy,
            COUNT(DISTINCT patient_id) as served,
            COUNT(DISTINCT patient_id) FILTER (WHERE wash OR health_promotion OR fpe OR philhealth) as households_served,
            COUNT(DISTINCT patient_id) FILTER (WHERE nutrition) as nutrition_served,
            COUNT(DISTINCT patient_id) FILTER (WHERE cancer) as cancer_served,
            COUNT(DISTINCT patient_id) FILTER (WHERE immunization) as immunization_served,
            COUNT(DISTINCT patient_id) FILTER (WHERE hpn) as hpn_served,
            COUNT(DISTINCT patient_id) FILTER (WHERE dm) as dm_served,
            COUNT(DISTINCT patient_id) FILTER (WHERE maternal_health) as maternal_health_served,
            COUNT(DISTINCT patient_id) FILTER (WHERE road_safety) as road_safety_served,
            COUNT(DISTINCT patient_id) FILTER (WHERE mental_health) as mental_health_served,
            COUNT(DISTINCT patient_id) FILTER (WHERE tb) as tb_served,
            COUNT(DISTINCT patient_id) FILTER (WHERE hiv) as hiv_served,
            COUNT(DISTINCT patient_id) FILTER (WHERE wash) as wash_served,
            COUNT(DISTINCT patient_id) FILTER (WHERE health_promotion) as health_promotion_served,
            COUNT(DISTINCT patient_id) FILTER (WHERE fpe) as fpe_served,
            COUNT(DISTINCT patient_id) FILTER (WHERE philhealth) as philhealth_served,
            COUNT(DISTINCT patient_id) FILTER (WHERE referral) as referral_served,
            COUNT(DISTINCT patient_id) FILTER (WHERE large_scale_pk_activity) as large_scale_activities
        FROM filtered_period
        GROUP BY lmuni, lbrgy
    ),
    monthly_trends AS (
        SELECT 
            TO_CHAR(d, 'Mon') as month_name,
            TO_CHAR(d, 'YYYY-MM') as month_date,
            COUNT(DISTINCT patient_id) as served
        FROM (
            SELECT patient_id, first_nutrition_date as d FROM filtered_period WHERE nutrition UNION ALL
            SELECT patient_id, first_cancer_date as d FROM filtered_period WHERE cancer UNION ALL
            SELECT patient_id, first_immunization_date as d FROM filtered_period WHERE immunization UNION ALL
            SELECT patient_id, first_hpn_date as d FROM filtered_period WHERE hpn UNION ALL
            SELECT patient_id, first_dm_date as d FROM filtered_period WHERE dm UNION ALL
            SELECT patient_id, first_maternal_health_date as d FROM filtered_period WHERE maternal_health UNION ALL
            SELECT patient_id, first_road_safety_date as d FROM filtered_period WHERE road_safety UNION ALL
            SELECT patient_id, first_mental_health_date as d FROM filtered_period WHERE mental_health UNION ALL
            SELECT patient_id, first_tb_date as d FROM filtered_period WHERE tb UNION ALL
            SELECT patient_id, first_hiv_date as d FROM filtered_period WHERE hiv UNION ALL
            SELECT patient_id, first_wash_date as d FROM filtered_period WHERE wash UNION ALL
            SELECT patient_id, first_health_promotion_date as d FROM filtered_period WHERE health_promotion UNION ALL
            SELECT patient_id, first_fpe_date as d FROM filtered_period WHERE fpe UNION ALL
            SELECT patient_id, first_philhealth_date as d FROM filtered_period WHERE philhealth UNION ALL
            SELECT patient_id, first_referral_date as d FROM filtered_period WHERE referral UNION ALL
            SELECT patient_id, first_large_scale_pk_activity_date as d FROM filtered_period WHERE large_scale_pk_activity UNION ALL
            SELECT patient_id, absolute_first_service_date as d FROM filtered_period WHERE is_new_patient
        ) dates
        WHERE d IS NOT NULL
        GROUP BY TO_CHAR(d, 'Mon'), TO_CHAR(d, 'YYYY-MM')
    )
    SELECT json_build_object(
        'total_served', COALESCE((SELECT COUNT(DISTINCT patient_id) FROM filtered_period), 0),
        'total_households_served', COALESCE((SELECT COUNT(DISTINCT patient_id) FROM filtered_period WHERE wash OR health_promotion OR fpe OR philhealth), 0),
        'total_new_patients', COALESCE((SELECT COUNT(DISTINCT patient_id) FROM filtered_period WHERE is_new_patient), 0),
        'muniStats', COALESCE((SELECT json_agg(row_to_json(m)) FROM served_by_muni m), '[]'::json),
        'barangayStats', COALESCE((SELECT json_agg(row_to_json(b)) FROM served_by_brgy b), '[]'::json),
        'monthlyTrends', COALESCE((SELECT json_agg(row_to_json(mt)) FROM monthly_trends mt), '[]'::json)
    );
    $query$;

    EXECUTE v_sql INTO v_result USING p_municipality, p_barangay, p_start_date, p_end_date;
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
