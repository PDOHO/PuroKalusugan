import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.SUPABASE_URL || 'https://vernageujrplrgtowrdo.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlcm5hZ2V1anJwbHJndG93cmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDc2ODIsImV4cCI6MjA4ODEyMzY4Mn0.rNyWQY4UL-GztHKEGsEVdWlW2Z5I0cl-gu4KIUeoIXw';

const supabase = createClient(supabaseUrl, supabaseKey);

function levenshtein(a, b) {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix = Array(bn + 1).fill(null).map(() => Array(an + 1).fill(null));
  for (let i = 0; i <= an; i += 1) matrix[0][i] = i;
  for (let j = 0; j <= bn; j += 1) matrix[j][0] = j;
  for (let j = 1; j <= bn; j += 1) {
    for (let i = 1; i <= an; i += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + cost);
    }
  }
  return matrix[bn][an];
}

function stringSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  const s1 = str1.trim().toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ');
  const s2 = str2.trim().toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ');
  if (s1 === s2) return 1.0;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  return (maxLen - levenshtein(s1, s2)) / maxLen;
}

function cleanFullName(raw) {
  if (!raw) return '';
  return raw.trim()
    .replace(/\b(jr|sr|iii|ii|iv)\.?\b/gi, '')
    .replace(/[^a-z0-9]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function parseFullName(raw) {
  if (!raw) return { last: '', given: '', raw: '' };
  const str = raw.trim().replace(/\b(jr|sr|iii|ii|iv)\.?\b/gi, '').trim();
  if (str.includes(',')) {
    const parts = str.split(',');
    const last = parts[0].trim().toLowerCase();
    const rest = parts.slice(1).join(' ').trim().toLowerCase();
    return { last, given: rest, raw: raw.trim() };
  } else {
    const tokens = str.split(/\s+/).filter(Boolean);
    if (tokens.length === 1) return { last: tokens[0].toLowerCase(), given: '', raw: raw.trim() };
    return { last: tokens[0].toLowerCase(), given: tokens.slice(1).join(' ').toLowerCase(), raw: raw.trim() };
  }
}

// Checks if two names have conflicting given name words (e.g. John Vincent vs John James)
function hasConflictingGivenNames(g1, g2) {
  const t1 = g1.split(/[^a-z0-9]+/).filter(t => t.length >= 2);
  const t2 = g2.split(/[^a-z0-9]+/).filter(t => t.length >= 2);
  if (t1.length === 0 || t2.length === 0) return false;

  // Substantive words (length >= 3, ignoring initials)
  const substantive1 = t1.filter(a => a.length >= 3);
  const substantive2 = t2.filter(b => b.length >= 3);

  const unmatched1 = substantive1.filter(a => !substantive2.some(b => stringSimilarity(a, b) >= 0.70));
  const unmatched2 = substantive2.filter(b => !substantive1.some(a => stringSimilarity(a, b) >= 0.70));

  // If BOTH sides have unmatched substantive words that differ (e.g. "vincent" vs "james"), it's a conflict
  if (unmatched1.length > 0 && unmatched2.length > 0) {
    return true;
  }
  return false;
}

function parseDate(dStr) {
  if (!dStr || dStr === 'null' || dStr === 'N/A') return null;
  if (dStr.includes('-')) {
    const parts = dStr.split('-');
    return { y: parseInt(parts[0], 10), m: parseInt(parts[1], 10), d: parseInt(parts[2], 10) };
  }
  const parts = dStr.split('/');
  if (parts.length >= 3) {
    let m = parseInt(parts[0], 10);
    let d = parseInt(parts[1], 10);
    let y = parseInt(parts[2], 10);
    if (y < 100) y += (y > 25 ? 1900 : 2000);
    return { y, m, d };
  }
  return null;
}

async function run() {
  console.log("Fetching all patients in Santiago...");
  let allPatients = [];
  let from = 0;
  const step = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('patients')
      .select('id, full_name, birthdate, sex, barangay, municipality')
      .ilike('municipality', 'Santiago')
      .order('id', { ascending: true })
      .range(from, from + step - 1);

    if (error) {
      console.error("Error fetching patients:", error);
      return;
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allPatients.push(...data);
      from += step;
      if (data.length < step) hasMore = false;
    }
  }

  console.log(`Fetched ${allPatients.length} patients in Santiago. Building indexed blocks...`);

  const index = new Map();
  for (const p of allPatients) {
    p.parsed = parseFullName(p.full_name);
    p.cleanFull = cleanFullName(p.full_name);
    p.parsedDate = parseDate(p.birthdate);

    if (p.birthdate) {
      const k = 'dob:' + p.birthdate;
      if (!index.has(k)) index.set(k, []);
      index.get(k).push(p);
    }
    if (p.parsed.last && p.parsed.last.length >= 3) {
      const k = 'last:' + p.parsed.last.substring(0, 4);
      if (!index.has(k)) index.set(k, []);
      index.get(k).push(p);
    }
  }

  const duplicates = [];
  const processedPairs = new Set();

  for (const [key, group] of index.entries()) {
    if (group.length > 500) continue;

    for (let i = 0; i < group.length; i++) {
      const p1 = group[i];
      for (let j = i + 1; j < group.length; j++) {
        const p2 = group[j];
        if (p1.id === p2.id) continue;
        const pairKey = Math.min(p1.id, p2.id) + '-' + Math.max(p1.id, p2.id);
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);

        const s1 = (p1.sex || '').toLowerCase().trim();
        const s2 = (p2.sex || '').toLowerCase().trim();
        const isOppSex = (s1.includes('f') && s2.startsWith('m')) || (s1.startsWith('m') && s2.includes('f'));
        if (isOppSex) continue;

        const d1 = p1.parsedDate;
        const d2 = p2.parsedDate;
        const sameDob = (d1 && d2 && d1.y === d2.y && d1.m === d2.m && d1.d === d2.d);
        const yearDiff = (d1 && d2) ? Math.abs(d1.y - d2.y) : null;

        const lastSim = stringSimilarity(p1.parsed.last, p2.parsed.last);
        const givenSim = stringSimilarity(p1.parsed.given, p2.parsed.given);
        const overallSim = stringSimilarity(p1.cleanFull, p2.cleanFull);

        // Core Rule: Check the WHOLE name. Conflicting given name words (like John Vincent vs John James) are NOT duplicates!
        if (hasConflictingGivenNames(p1.parsed.given, p2.parsed.given)) continue;

        // Given name similarity must be high (avoid different names under same surname)
        if (lastSim >= 0.85 && givenSim < 0.70) {
          // Only allow if one is an exact prefix / initial of the other and overall similarity is high
          const g1 = p1.parsed.given;
          const g2 = p2.parsed.given;
          const isPrefix = (g1.startsWith(g2) || g2.startsWith(g1)) && Math.min(g1.length, g2.length) >= 3;
          if (!isPrefix || overallSim < 0.82) continue;
        }

        // Twins safeguard: same birthdate but low given name similarity
        if (sameDob && givenSim < 0.70 && overallSim < 0.85) continue;

        // Generational family members safeguard: age difference > 3 years unless near-identical full name (>= 0.95)
        if (yearDiff !== null && yearDiff > 3 && overallSim < 0.95) continue;

        let isMatch = false;
        let matchReason = '';

        if (overallSim >= 0.92) {
          isMatch = true;
          matchReason = `Near Exact Name Match (${(overallSim * 100).toFixed(0)}%)`;
        } else if (sameDob && lastSim >= 0.85 && givenSim >= 0.75) {
          isMatch = true;
          matchReason = `Same Birthdate (${p1.birthdate}) + High Name Similarity`;
        } else if (lastSim >= 0.85 && givenSim >= 0.80 && (!yearDiff || yearDiff <= 2)) {
          isMatch = true;
          matchReason = `Same First & Last Name Typos/Variant (${(overallSim * 100).toFixed(0)}%)`;
        }

        if (isMatch) {
          duplicates.push({
            id1: p1.id,
            name1: p1.full_name,
            birthdate1: p1.birthdate || 'N/A',
            sex1: p1.sex || 'N/A',
            barangay1: p1.barangay || 'N/A',
            id2: p2.id,
            name2: p2.full_name,
            birthdate2: p2.birthdate || 'N/A',
            sex2: p2.sex || 'N/A',
            barangay2: p2.barangay || 'N/A',
            similarity: overallSim.toFixed(2),
            reason: matchReason
          });
        }
      }
    }
  }

  duplicates.sort((a, b) => b.similarity - a.similarity);

  console.log(`Found ${duplicates.length} verified candidate duplicate pairs in Santiago (checked whole name).`);

  const csvHeaders = 'ID1,Name1,Birthdate1,Sex1,Barangay1,ID2,Name2,Birthdate2,Sex2,Barangay2,Similarity,Reason';
  const csvRows = duplicates.map(d =>
    `"${d.id1}","${d.name1.replace(/"/g, '""')}","${d.birthdate1}","${d.sex1}","${d.barangay1}","${d.id2}","${d.name2.replace(/"/g, '""')}","${d.birthdate2}","${d.sex2}","${d.barangay2}","${d.similarity}","${d.reason}"`
  );

  const csvContent = [csvHeaders, ...csvRows].join('\n');
  fs.writeFileSync('public/fuzzy_santiago_duplicates.csv', csvContent);
  fs.writeFileSync('fuzzy_duplicates_santiago_all.csv', csvContent);

  if (fs.existsSync('dist')) {
    fs.writeFileSync('dist/fuzzy_santiago_duplicates.csv', csvContent);
  }

  console.log("Successfully updated public/fuzzy_santiago_duplicates.csv and fuzzy_duplicates_santiago_all.csv");
}

run().catch(console.error);
