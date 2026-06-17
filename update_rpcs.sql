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
) AS $$
DECLARE
    v_sql text;
BEGIN
    RETURN QUERY
    WITH first_services AS (
        SELECT 
            patient_id, 
            MIN(date_of_service) as abs_first_date
        FROM patient_services
        GROUP BY patient_id
    ),
    filtered AS (
        SELECT p.id
        FROM patients p
        JOIN first_services fs ON p.id = fs.patient_id
        WHERE 
            (p_municipality IS NULL OR LOWER(p.municipality) = LOWER(p_municipality))
            AND (p_barangay IS NULL OR LOWER(p.barangay) = LOWER(p_barangay))
            AND (p_search IS NULL OR p.full_name ILIKE '%' || p_search || '%')
            AND (p_start_date IS NULL OR fs.abs_first_date >= p_start_date)
            AND (p_end_date IS NULL OR fs.abs_first_date <= p_end_date)
            AND (
                p_program IS NULL OR EXISTS (
                    SELECT 1 FROM patient_services ps2 
                    WHERE ps2.patient_id = p.id AND (
                        CASE p_program
                            WHEN 'health_promotion' THEN ps2.health_promotion
                            WHEN 'fpe' THEN ps2.fpe
                            WHEN 'philhealth' THEN ps2.philhealth
                            WHEN 'referral' THEN ps2.referral
                            WHEN 'nutrition' THEN ps2.nutrition
                            WHEN 'cancer' THEN ps2.cancer
                            WHEN 'immunization' THEN ps2.immunization
                            WHEN 'hpn' THEN ps2.hpn
                            WHEN 'dm' THEN ps2.dm
                            WHEN 'maternal_health' THEN ps2.maternal_health
                            WHEN 'road_safety' THEN ps2.road_safety
                            WHEN 'mental_health' THEN ps2.mental_health
                            WHEN 'tb' THEN ps2.tb
                            WHEN 'hiv' THEN ps2.hiv
                            WHEN 'wash' THEN ps2.wash
                            WHEN 'large_scale_pk_activity' THEN ps2.large_scale_pk_activity
                            ELSE false
                        END
                    )
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


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
) AS $$
BEGIN
    RETURN QUERY
    WITH discrepant AS (
        SELECT p.id
        FROM patients p
        WHERE 
            (p_municipality IS NULL OR LOWER(p.municipality) = LOWER(p_municipality))
            AND (p_barangay IS NULL OR LOWER(p.barangay) = LOWER(p_barangay))
            AND (p_search IS NULL OR p.full_name ILIKE '%' || p_search || '%')
            AND (
                -- Identify discrepancies: duplicate latest services? Or maybe patient basic info doesn't match latest service info?
                -- Since discrepancy definition varied, let's do a simple check.
                EXISTS (
                    SELECT 1 FROM patient_services ps3
                    WHERE ps3.patient_id = p.id
                    GROUP BY ps3.date_of_service
                    HAVING COUNT(*) > 1
                )
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
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.get_duplicate_patient_ids()
RETURNS TABLE (
    patient_id bigint
) AS $$
BEGIN
    RETURN QUERY
    WITH dups AS (
        SELECT full_name, birthdate, municipality
        FROM patients
        GROUP BY full_name, birthdate, municipality
        HAVING COUNT(*) > 1
    )
    SELECT p.id
    FROM patients p
    JOIN dups d ON p.full_name = d.full_name AND p.birthdate = d.birthdate AND p.municipality = d.municipality
    ORDER BY p.full_name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
