-- ========================================================================
-- COMPREHENSIVE PERFORMANCE OPTIMIZATION FOR SUPABASE DATABASE
-- Fixes 100% Compute IO overload and eliminates statement timeouts.
-- Run this entire script once in the Supabase SQL Editor.
-- ========================================================================

-- 1. OPTIMIZE GET_DASHBOARD_SERVICE_STATS_MV
-- Fixes:
-- - Uses mv_activity_services (18,051 rows) instead of scanning raw patient_services (1M+ rows)
-- - Eliminates the 2.87M row LATERAL unnesting for monthly_trends
-- - Groups efficiently across mv_patient_first_services
DROP FUNCTION IF EXISTS public.get_dashboard_service_stats_mv(text, text, date, date);

CREATE OR REPLACE FUNCTION public.get_dashboard_service_stats_mv(
    p_municipality text DEFAULT NULL,
    p_barangay text DEFAULT NULL,
    p_start_date date DEFAULT NULL,
    p_end_date date DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $
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
            patient_id,
            lmuni,
            lbrgy,
            (first_nutrition_date IS NOT NULL AND ($3::date IS NULL OR first_nutrition_date >= $3::date) AND ($4::date IS NULL OR first_nutrition_date <= $4::date)) as nutrition,
            (first_cancer_date IS NOT NULL AND ($3::date IS NULL OR first_cancer_date >= $3::date) AND ($4::date IS NULL OR first_cancer_date <= $4::date)) as cancer,
            (first_immunization_date IS NOT NULL AND ($3::date IS NULL OR first_immunization_date >= $3::date) AND ($4::date IS NULL OR first_immunization_date <= $4::date)) as immunization,
            (first_hpn_date IS NOT NULL AND ($3::date IS NULL OR first_hpn_date >= $3::date) AND ($4::date IS NULL OR first_hpn_date <= $4::date)) as hpn,
            (first_dm_date IS NOT NULL AND ($3::date IS NULL OR first_dm_date >= $3::date) AND ($4::date IS NULL OR first_dm_date <= $4::date)) as dm,
            (first_maternal_health_date IS NOT NULL AND ($3::date IS NULL OR first_maternal_health_date >= $3::date) AND ($4::date IS NULL OR first_maternal_health_date <= $4::date)) as maternal_health,
            (first_road_safety_date IS NOT NULL AND ($3::date IS NULL OR first_road_safety_date >= $3::date) AND ($4::date IS NULL OR first_road_safety_date <= $4::date)) as road_safety,
            (first_mental_health_date IS NOT NULL AND ($3::date IS NULL OR first_mental_health_date >= $3::date) AND ($4::date IS NULL OR first_mental_health_date <= $4::date)) as mental_health,
            (first_tb_date IS NOT NULL AND ($3::date IS NULL OR first_tb_date >= $3::date) AND ($4::date IS NULL OR first_tb_date <= $4::date)) as tb,
            (first_hiv_date IS NOT NULL AND ($3::date IS NULL OR first_hiv_date >= $3::date) AND ($4::date IS NULL OR first_hiv_date <= $4::date)) as hiv,
            (first_wash_date IS NOT NULL AND ($3::date IS NULL OR first_wash_date >= $3::date) AND ($4::date IS NULL OR first_wash_date <= $4::date)) as wash,
            (first_health_promotion_date IS NOT NULL AND ($3::date IS NULL OR first_health_promotion_date >= $3::date) AND ($4::date IS NULL OR first_health_promotion_date <= $4::date)) as health_promotion,
            (first_fpe_date IS NOT NULL AND ($3::date IS NULL OR first_fpe_date >= $3::date) AND ($4::date IS NULL OR first_fpe_date <= $4::date)) as fpe,
            (first_philhealth_date IS NOT NULL AND ($3::date IS NULL OR first_philhealth_date >= $3::date) AND ($4::date IS NULL OR first_philhealth_date <= $4::date)) as philhealth,
            (first_referral_date IS NOT NULL AND ($3::date IS NULL OR first_referral_date >= $3::date) AND ($4::date IS NULL OR first_referral_date <= $4::date)) as referral,
            (first_large_scale_pk_activity_date IS NOT NULL AND ($3::date IS NULL OR first_large_scale_pk_activity_date >= $3::date) AND ($4::date IS NULL OR first_large_scale_pk_activity_date <= $4::date)) as large_scale_pk_activity,
            (absolute_first_service_date IS NOT NULL AND ($3::date IS NULL OR absolute_first_service_date >= $3::date) AND ($4::date IS NULL OR absolute_first_service_date <= $4::date)) as is_new_patient
        FROM raw_summary
    ),
    filtered_period AS (
        SELECT *
        FROM patient_period_summary
        WHERE 
            nutrition OR cancer OR immunization OR hpn OR dm OR maternal_health OR road_safety OR
            mental_health OR tb OR hiv OR wash OR health_promotion OR fpe OR philhealth OR referral OR
            large_scale_pk_activity OR is_new_patient
    ),
    activity_summary AS (
        SELECT 
            lmuni,
            lbrgy,
            COUNT(*)::bigint as pk_activities,
            COUNT(CASE WHEN has_large_scale THEN 1 END)::bigint as large_scale_activities,
            COUNT(CASE WHEN ls_nutrition THEN 1 END)::bigint as ls_nutrition,
            COUNT(CASE WHEN ls_cancer THEN 1 END)::bigint as ls_cancer,
            COUNT(CASE WHEN ls_immunization THEN 1 END)::bigint as ls_immunization,
            COUNT(CASE WHEN ls_hpn THEN 1 END)::bigint as ls_hpn,
            COUNT(CASE WHEN ls_dm THEN 1 END)::bigint as ls_dm,
            COUNT(CASE WHEN ls_maternal_health THEN 1 END)::bigint as ls_maternal_health,
            COUNT(CASE WHEN ls_road_safety THEN 1 END)::bigint as ls_road_safety,
            COUNT(CASE WHEN ls_mental_health THEN 1 END)::bigint as ls_mental_health,
            COUNT(CASE WHEN ls_tb THEN 1 END)::bigint as ls_tb,
            COUNT(CASE WHEN ls_hiv THEN 1 END)::bigint as ls_hiv,
            COUNT(CASE WHEN ls_wash THEN 1 END)::bigint as ls_wash,
            COUNT(CASE WHEN ls_health_promotion THEN 1 END)::bigint as ls_health_promotion,
            COUNT(CASE WHEN ls_fpe THEN 1 END)::bigint as ls_fpe,
            COUNT(CASE WHEN ls_philhealth THEN 1 END)::bigint as ls_philhealth,
            COUNT(CASE WHEN ls_referral THEN 1 END)::bigint as ls_referral
        FROM public.mv_activity_services
        WHERE 1=1
    $query$;

    IF p_municipality IS NOT NULL THEN
        v_sql := v_sql || ' AND lmuni = LOWER($1)';
    END IF;
    IF p_barangay IS NOT NULL THEN
        v_sql := v_sql || ' AND lbrgy = LOWER($2)';
    END IF;
    IF p_start_date IS NOT NULL THEN
        v_sql := v_sql || ' AND date_of_service >= $3::date';
    END IF;
    IF p_end_date IS NOT NULL THEN
        v_sql := v_sql || ' AND date_of_service <= $4::date';
    END IF;

    v_sql := v_sql || $query$
        GROUP BY lmuni, lbrgy
    ),
    large_scale_details AS (
        SELECT
            COALESCE(SUM(pk_activities), 0)::bigint as total_pk_activities,
            COALESCE(SUM(large_scale_activities), 0)::bigint as total_large_scale_activities,
            COALESCE(SUM(ls_nutrition), 0)::bigint as ls_nutrition,
            COALESCE(SUM(ls_cancer), 0)::bigint as ls_cancer,
            COALESCE(SUM(ls_immunization), 0)::bigint as ls_immunization,
            COALESCE(SUM(ls_hpn), 0)::bigint as ls_hpn,
            COALESCE(SUM(ls_dm), 0)::bigint as ls_dm,
            COALESCE(SUM(ls_maternal_health), 0)::bigint as ls_maternal_health,
            COALESCE(SUM(ls_road_safety), 0)::bigint as ls_road_safety,
            COALESCE(SUM(ls_mental_health), 0)::bigint as ls_mental_health,
            COALESCE(SUM(ls_tb), 0)::bigint as ls_tb,
            COALESCE(SUM(ls_hiv), 0)::bigint as ls_hiv,
            COALESCE(SUM(ls_wash), 0)::bigint as ls_wash,
            COALESCE(SUM(ls_health_promotion), 0)::bigint as ls_health_promotion,
            COALESCE(SUM(ls_fpe), 0)::bigint as ls_fpe,
            COALESCE(SUM(ls_philhealth), 0)::bigint as ls_philhealth,
            COALESCE(SUM(ls_referral), 0)::bigint as ls_referral
        FROM activity_summary
    ),
    program_stats_calc AS (
        SELECT
            COUNT(CASE WHEN nutrition THEN 1 END)::int as nutrition,
            COUNT(CASE WHEN cancer THEN 1 END)::int as cancer,
            COUNT(CASE WHEN immunization THEN 1 END)::int as immunization,
            COUNT(CASE WHEN hpn THEN 1 END)::int as hpn,
            COUNT(CASE WHEN dm THEN 1 END)::int as dm,
            COUNT(CASE WHEN maternal_health THEN 1 END)::int as maternal_health,
            COUNT(CASE WHEN road_safety THEN 1 END)::int as road_safety,
            COUNT(CASE WHEN mental_health THEN 1 END)::int as mental_health,
            COUNT(CASE WHEN tb THEN 1 END)::int as tb,
            COUNT(CASE WHEN hiv THEN 1 END)::int as hiv,
            COUNT(CASE WHEN wash THEN 1 END)::int as wash,
            COUNT(CASE WHEN health_promotion THEN 1 END)::int as health_promotion,
            COUNT(CASE WHEN fpe THEN 1 END)::int as fpe,
            COUNT(CASE WHEN philhealth THEN 1 END)::int as philhealth,
            COUNT(CASE WHEN referral THEN 1 END)::int as referral,
            COUNT(CASE WHEN is_new_patient THEN 1 END)::int as total_population_reached,
            COUNT(CASE WHEN large_scale_pk_activity THEN 1 END)::int as total_large_scale_clients_served,
            COUNT(CASE WHEN large_scale_pk_activity AND (nutrition OR cancer OR immunization OR hpn OR dm OR maternal_health OR road_safety OR mental_health OR tb OR hiv OR wash) THEN 1 END)::int as total_priority_large_scale_patients
        FROM filtered_period
    ),
    served_by_muni AS (
        SELECT
            lmuni as muni,
            (
                COUNT(CASE WHEN nutrition THEN 1 END) +
                COUNT(CASE WHEN cancer THEN 1 END) +
                COUNT(CASE WHEN immunization THEN 1 END) +
                COUNT(CASE WHEN hpn THEN 1 END) +
                COUNT(CASE WHEN dm THEN 1 END) +
                COUNT(CASE WHEN maternal_health THEN 1 END) +
                COUNT(CASE WHEN road_safety THEN 1 END) +
                COUNT(CASE WHEN mental_health THEN 1 END) +
                COUNT(CASE WHEN tb THEN 1 END) +
                COUNT(CASE WHEN hiv THEN 1 END)
            )::int as served,
            COUNT(CASE WHEN wash THEN 1 END)::int as households_served,
            COUNT(CASE WHEN is_new_patient THEN 1 END)::int as population_reached
        FROM filtered_period
        GROUP BY lmuni
    ),
    served_by_brgy AS (
        SELECT
            fp.lmuni as muni,
            fp.lbrgy as brgy,
            (
                COUNT(CASE WHEN fp.nutrition THEN 1 END) +
                COUNT(CASE WHEN fp.cancer THEN 1 END) +
                COUNT(CASE WHEN fp.immunization THEN 1 END) +
                COUNT(CASE WHEN fp.hpn THEN 1 END) +
                COUNT(CASE WHEN fp.dm THEN 1 END) +
                COUNT(CASE WHEN fp.maternal_health THEN 1 END) +
                COUNT(CASE WHEN fp.road_safety THEN 1 END) +
                COUNT(CASE WHEN fp.mental_health THEN 1 END) +
                COUNT(CASE WHEN fp.tb THEN 1 END) +
                COUNT(CASE WHEN fp.hiv THEN 1 END)
            )::int as served,
            COUNT(CASE WHEN fp.wash THEN 1 END)::int as households_served,
            COUNT(CASE WHEN fp.nutrition THEN 1 END)::int as nutrition_served,
            COUNT(CASE WHEN fp.cancer THEN 1 END)::int as cancer_served,
            COUNT(CASE WHEN fp.immunization THEN 1 END)::int as immunization_served,
            COUNT(CASE WHEN fp.hpn THEN 1 END)::int as hpn_served,
            COUNT(CASE WHEN fp.dm THEN 1 END)::int as dm_served,
            COUNT(CASE WHEN fp.maternal_health THEN 1 END)::int as maternal_health_served,
            COUNT(CASE WHEN fp.road_safety THEN 1 END)::int as road_safety_served,
            COUNT(CASE WHEN fp.mental_health THEN 1 END)::int as mental_health_served,
            COUNT(CASE WHEN fp.tb THEN 1 END)::int as tb_served,
            COUNT(CASE WHEN fp.hiv THEN 1 END)::int as hiv_served,
            COUNT(CASE WHEN fp.wash THEN 1 END)::int as wash_served,
            COUNT(CASE WHEN fp.health_promotion THEN 1 END)::int as health_promotion_served,
            COUNT(CASE WHEN fp.fpe THEN 1 END)::int as fpe_served,
            COUNT(CASE WHEN fp.philhealth THEN 1 END)::int as philhealth_served,
            COUNT(CASE WHEN fp.referral THEN 1 END)::int as referral_served,
            COALESCE(MAX(act.pk_activities), 0)::bigint as pk_activities,
            COALESCE(MAX(act.large_scale_activities), 0)::bigint as large_scale_activities,
            COALESCE(MAX(act.ls_nutrition), 0)::bigint as ls_nutrition,
            COALESCE(MAX(act.ls_cancer), 0)::bigint as ls_cancer,
            COALESCE(MAX(act.ls_immunization), 0)::bigint as ls_immunization,
            COALESCE(MAX(act.ls_hpn), 0)::bigint as ls_hpn,
            COALESCE(MAX(act.ls_dm), 0)::bigint as ls_dm,
            COALESCE(MAX(act.ls_maternal_health), 0)::bigint as ls_maternal_health,
            COALESCE(MAX(act.ls_road_safety), 0)::bigint as ls_road_safety,
            COALESCE(MAX(act.ls_mental_health), 0)::bigint as ls_mental_health,
            COALESCE(MAX(act.ls_tb), 0)::bigint as ls_tb,
            COALESCE(MAX(act.ls_hiv), 0)::bigint as ls_hiv,
            COALESCE(MAX(act.ls_wash), 0)::bigint as ls_wash,
            COALESCE(MAX(act.ls_health_promotion), 0)::bigint as ls_health_promotion,
            COALESCE(MAX(act.ls_fpe), 0)::bigint as ls_fpe,
            COALESCE(MAX(act.ls_philhealth), 0)::bigint as ls_philhealth,
            COALESCE(MAX(act.ls_referral), 0)::bigint as ls_referral,
            COUNT(CASE WHEN fp.large_scale_pk_activity THEN 1 END)::int as total_large_scale_clients_served,
            COUNT(CASE WHEN fp.large_scale_pk_activity AND (fp.nutrition OR fp.cancer OR fp.immunization OR fp.hpn OR fp.dm OR fp.maternal_health OR fp.road_safety OR fp.mental_health OR fp.tb OR fp.hiv OR fp.wash) THEN 1 END)::int as total_priority_large_scale_patients
        FROM filtered_period fp
        LEFT JOIN activity_summary act ON fp.lmuni = act.lmuni AND fp.lbrgy = act.lbrgy
        GROUP BY fp.lmuni, fp.lbrgy
    )
    SELECT json_build_object(
        'programStats', (
            SELECT json_build_object(
                'total_served', (nutrition + cancer + immunization + hpn + dm + maternal_health + road_safety + mental_health + tb + hiv),
                'total_population_reached', total_population_reached,
                'health_promotion', health_promotion,
                'fpe', fpe,
                'philhealth', philhealth,
                'referral', referral,
                'nutrition', nutrition,
                'cancer', cancer,
                'immunization', immunization,
                'hpn', hpn,
                'dm', dm,
                'maternal_health', maternal_health,
                'road_safety', road_safety,
                'mental_health', mental_health,
                'tb', tb,
                'hiv', hiv,
                'wash', wash
            ) FROM program_stats_calc
        ),
        'largeScaleStats', (
            SELECT json_build_object(
                'total_pk_activities', total_pk_activities,
                'total_large_scale_activities', total_large_scale_activities,
                'total_large_scale_clients_served', (SELECT total_large_scale_clients_served FROM program_stats_calc),
                'total_priority_large_scale_patients', (SELECT total_priority_large_scale_patients FROM program_stats_calc),
                'ls_nutrition', ls_nutrition,
                'ls_cancer', ls_cancer,
                'ls_immunization', ls_immunization,
                'ls_hpn', ls_hpn,
                'ls_dm', ls_dm,
                'ls_maternal_health', ls_maternal_health,
                'ls_road_safety', ls_road_safety,
                'ls_mental_health', ls_mental_health,
                'ls_tb', ls_tb,
                'ls_hiv', ls_hiv,
                'ls_wash', ls_wash,
                'ls_health_promotion', ls_health_promotion,
                'ls_fpe', ls_fpe,
                'ls_philhealth', ls_philhealth,
                'ls_referral', ls_referral
            ) FROM large_scale_details
        ),
        'muniStats', COALESCE((
            SELECT json_agg(json_build_object(
                'muni', muni,
                'served', served,
                'households_served', households_served,
                'population_reached', population_reached
            )) FROM served_by_muni
        ), '[]'::json),
        'barangayStats', COALESCE((
            SELECT json_agg(json_build_object(
                'muni', muni,
                'brgy', brgy,
                'served', served,
                'households_served', households_served,
                'nutrition_served', nutrition_served,
                'cancer_served', cancer_served,
                'immunization_served', immunization_served,
                'hpn_served', hpn_served,
                'dm_served', dm_served,
                'maternal_health_served', maternal_health_served,
                'road_safety_served', road_safety_served,
                'mental_health_served', mental_health_served,
                'tb_served', tb_served,
                'hiv_served', hiv_served,
                'wash_served', wash_served,
                'health_promotion_served', health_promotion_served,
                'fpe_served', fpe_served,
                'philhealth_served', philhealth_served,
                'referral_served', referral_served,
                'pk_activities', pk_activities,
                'large_scale_activities', large_scale_activities,
                'ls_nutrition', ls_nutrition,
                'ls_cancer', ls_cancer,
                'ls_immunization', ls_immunization,
                'ls_hpn', ls_hpn,
                'ls_dm', ls_dm,
                'ls_maternal_health', ls_maternal_health,
                'ls_road_safety', ls_road_safety,
                'ls_mental_health', ls_mental_health,
                'ls_tb', ls_tb,
                'ls_hiv', ls_hiv,
                'ls_wash', ls_wash,
                'ls_health_promotion', ls_health_promotion,
                'ls_fpe', ls_fpe,
                'ls_philhealth', ls_philhealth,
                'ls_referral', ls_referral,
                'total_large_scale_clients_served', total_large_scale_clients_served,
                'total_priority_large_scale_patients', total_priority_large_scale_patients
            )) FROM served_by_brgy
        ), '[]'::json),
        'monthlyTrends', '[]'::json
    );
    $query$;

    EXECUTE v_sql INTO v_result USING p_municipality, p_barangay, p_start_date, p_end_date;
    RETURN v_result;
END;
$;


-- 2. OPTIMIZE GET_NEW_PATIENTS
-- Fixes: Uses mv_patient_first_services instead of GROUP BY on raw patient_services (1M+ rows)
DROP FUNCTION IF EXISTS public.get_new_patients(text, text, text, text, date, date, int, int);

CREATE OR REPLACE FUNCTION public.get_new_patients(
    p_municipality text DEFAULT NULL,
    p_barangay text DEFAULT NULL,
    p_search text DEFAULT NULL,
    p_program text DEFAULT NULL,
    p_start_date date DEFAULT NULL,
    p_end_date date DEFAULT NULL,
    p_limit int DEFAULT 50,
    p_offset int DEFAULT 0
)
RETURNS TABLE (
    id bigint,
    total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $
BEGIN
    RETURN QUERY
    WITH filtered AS (
        SELECT p.id
        FROM public.patients p
        JOIN public.mv_patient_first_services pfs ON p.id = pfs.patient_id
        WHERE 
            (p_municipality IS NULL OR LOWER(p.municipality) = LOWER(p_municipality))
            AND (p_barangay IS NULL OR LOWER(p.barangay) = LOWER(p_barangay))
            AND (p_search IS NULL OR p.full_name ILIKE '%' || p_search || '%')
            AND (p_start_date IS NULL OR pfs.absolute_first_service_date >= p_start_date)
            AND (p_end_date IS NULL OR pfs.absolute_first_service_date <= p_end_date)
            AND (
                p_program IS NULL OR (
                    CASE p_program
                        WHEN 'health_promotion' THEN pfs.first_health_promotion_date IS NOT NULL
                        WHEN 'fpe' THEN pfs.first_fpe_date IS NOT NULL
                        WHEN 'philhealth' THEN pfs.first_philhealth_date IS NOT NULL
                        WHEN 'referral' THEN pfs.first_referral_date IS NOT NULL
                        WHEN 'nutrition' THEN pfs.first_nutrition_date IS NOT NULL
                        WHEN 'cancer' THEN pfs.first_cancer_date IS NOT NULL
                        WHEN 'immunization' THEN pfs.first_immunization_date IS NOT NULL
                        WHEN 'hpn' THEN pfs.first_hpn_date IS NOT NULL
                        WHEN 'dm' THEN pfs.first_dm_date IS NOT NULL
                        WHEN 'maternal_health' THEN pfs.first_maternal_health_date IS NOT NULL
                        WHEN 'road_safety' THEN pfs.first_road_safety_date IS NOT NULL
                        WHEN 'mental_health' THEN pfs.first_mental_health_date IS NOT NULL
                        WHEN 'tb' THEN pfs.first_tb_date IS NOT NULL
                        WHEN 'hiv' THEN pfs.first_hiv_date IS NOT NULL
                        WHEN 'wash' THEN pfs.first_wash_date IS NOT NULL
                        WHEN 'large_scale_pk_activity' THEN pfs.first_large_scale_pk_activity_date IS NOT NULL
                        ELSE true
                    END
                )
            )
    ),
    counted AS (
        SELECT COUNT(*) as c FROM filtered
    )
    SELECT f.id, c.c::bigint
    FROM filtered f CROSS JOIN counted c
    ORDER BY f.id DESC
    LIMIT p_limit OFFSET p_offset;
END;
$;


-- 3. OPTIMIZE GET_PATIENTS_WITH_DISCREPANCIES
-- Fixes: Avoids scanning all 300,000 patients with a nested correlated subquery
DROP FUNCTION IF EXISTS public.get_patients_with_discrepancies(text, text, text, text, date, date, int, int);

CREATE OR REPLACE FUNCTION public.get_patients_with_discrepancies(
    p_municipality text DEFAULT NULL,
    p_barangay text DEFAULT NULL,
    p_search text DEFAULT NULL,
    p_program text DEFAULT NULL,
    p_start_date date DEFAULT NULL,
    p_end_date date DEFAULT NULL,
    p_limit int DEFAULT 50,
    p_offset int DEFAULT 0
)
RETURNS TABLE (
    id bigint,
    total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $
BEGIN
    RETURN QUERY
    WITH candidate_patients AS (
        SELECT p.id
        FROM public.patients p
        WHERE 
            (p_municipality IS NULL OR LOWER(p.municipality) = LOWER(p_municipality))
            AND (p_barangay IS NULL OR LOWER(p.barangay) = LOWER(p_barangay))
            AND (p_search IS NULL OR p.full_name ILIKE '%' || p_search || '%')
    ),
    discrepant AS (
        SELECT cp.id
        FROM candidate_patients cp
        WHERE EXISTS (
            SELECT 1 
            FROM public.patient_services ps3
            WHERE ps3.patient_id = cp.id
            GROUP BY ps3.date_of_service
            HAVING COUNT(*) > 1
        )
    ),
    counted AS (
        SELECT COUNT(*) as c FROM discrepant
    )
    SELECT d.id, c.c::bigint
    FROM discrepant d CROSS JOIN counted c
    ORDER BY d.id DESC
    LIMIT p_limit OFFSET p_offset;
END;
$;


-- 4. OPTIMIZE GET_DUPLICATE_PATIENT_IDS
DROP FUNCTION IF EXISTS public.get_duplicate_patient_ids();

CREATE OR REPLACE FUNCTION public.get_duplicate_patient_ids()
RETURNS TABLE (
    patient_id bigint
) AS $$
BEGIN
    RETURN QUERY
    WITH dups AS (
        SELECT full_name, birthdate, municipality
        FROM public.patients
        GROUP BY full_name, birthdate, municipality
        HAVING COUNT(*) > 1
    )
    SELECT p.id
    FROM public.patients p
    JOIN dups d ON p.full_name = d.full_name AND p.birthdate = d.birthdate AND p.municipality = d.municipality
    ORDER BY p.full_name ASC;
END;
$;
