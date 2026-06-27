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
    WITH discrepant_services AS (
        SELECT ps.patient_id
        FROM patient_services ps
        JOIN patients p ON p.id = ps.patient_id
        JOIN barangays b ON LOWER(b.municipality) = LOWER(p.municipality) AND LOWER(b.barangay_name) = LOWER(p.barangay)
        WHERE 
            (p_start_date IS NULL OR ps.date_of_service >= p_start_date)
            AND (p_end_date IS NULL OR ps.date_of_service <= p_end_date)
            AND (
                (ps.wash = true AND NOT (
                    LOWER(b.program2_name) = 'wash' OR LOWER(b.program3_name) = 'wash' OR LOWER(b.program4_name) = 'wash'
                )) OR
                (ps.cancer = true AND NOT (
                    LOWER(b.program2_name) = 'cancer' OR LOWER(b.program3_name) = 'cancer' OR LOWER(b.program4_name) = 'cancer'
                )) OR
                (ps.immunization = true AND NOT (
                    LOWER(b.program2_name) = 'immunization' OR LOWER(b.program3_name) = 'immunization' OR LOWER(b.program4_name) = 'immunization'
                )) OR
                (ps.hpn = true AND NOT (
                    LOWER(b.program2_name) = 'hpn' OR LOWER(b.program3_name) = 'hpn' OR LOWER(b.program4_name) = 'hpn'
                )) OR
                (ps.dm = true AND NOT (
                    LOWER(b.program2_name) = 'dm' OR LOWER(b.program3_name) = 'dm' OR LOWER(b.program4_name) = 'dm'
                )) OR
                (ps.maternal_health = true AND NOT (
                    LOWER(b.program2_name) = 'maternal health' OR LOWER(b.program3_name) = 'maternal health' OR LOWER(b.program4_name) = 'maternal health'
                )) OR
                (ps.road_safety = true AND NOT (
                    LOWER(b.program2_name) = 'road safety' OR LOWER(b.program3_name) = 'road safety' OR LOWER(b.program4_name) = 'road safety'
                )) OR
                (ps.mental_health = true AND NOT (
                    LOWER(b.program2_name) = 'mental health' OR LOWER(b.program3_name) = 'mental health' OR LOWER(b.program4_name) = 'mental health'
                )) OR
                (ps.tb = true AND NOT (
                    LOWER(b.program2_name) = 'tb' OR LOWER(b.program3_name) = 'tb' OR LOWER(b.program4_name) = 'tb'
                )) OR
                (ps.hiv = true AND NOT (
                    LOWER(b.program2_name) = 'hiv' OR LOWER(b.program3_name) = 'hiv' OR LOWER(b.program4_name) = 'hiv'
                ))
            )
        GROUP BY ps.patient_id
    ),
    discrepant AS (
        SELECT p.id
        FROM patients p
        JOIN discrepant_services ds ON p.id = ds.patient_id
        WHERE 
            (p_municipality IS NULL OR LOWER(p.municipality) = LOWER(p_municipality))
            AND (p_barangay IS NULL OR LOWER(p.barangay) = LOWER(p_barangay))
            AND (p_search IS NULL OR p.full_name ILIKE '%' || p_search || '%')
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
