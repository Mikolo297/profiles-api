async function fetchWithTimeout(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAllAPIs(name) {
  const encoded = encodeURIComponent(name);

  const [genderData, ageData, nationData] = await Promise.all([
    fetchWithTimeout(`https://api.genderize.io?name=${encoded}`),
    fetchWithTimeout(`https://api.agify.io?name=${encoded}`),
    fetchWithTimeout(`https://api.nationalize.io?name=${encoded}`),
  ]);

  return { genderData, ageData, nationData };
}

function classifyAgeGroup(age) {
  if (age <= 12)  return 'child';
  if (age <= 19)  return 'teenager';
  if (age <= 59)  return 'adult';
  return 'senior';
}

function validateAndExtract({ genderData, ageData, nationData }) {
  // Genderize validation
  if (!genderData.gender || genderData.count === 0) {
    return { error: { status: 502, message: 'Genderize returned an invalid response' } };
  }

  // Agify validation
  if (genderData.age === null && ageData.age === null) {
    return { error: { status: 502, message: 'Agify returned an invalid response' } };
  }
  if (ageData.age === null || ageData.age === undefined) {
    return { error: { status: 502, message: 'Agify returned an invalid response' } };
  }

  // Nationalize validation
  if (!nationData.country || nationData.country.length === 0) {
    return { error: { status: 502, message: 'Nationalize returned an invalid response' } };
  }

  // Pick top country by probability
  const topCountry = nationData.country.reduce((best, c) =>
    c.probability > best.probability ? c : best
  );

  const age = ageData.age;
  const age_group = classifyAgeGroup(age);

  return {
    profile: {
      gender:              genderData.gender,
      gender_probability:  genderData.probability,
      sample_size:         genderData.count,
      age,
      age_group,
      country_id:          topCountry.country_id,
      country_probability: topCountry.probability,
    },
  };
}

module.exports = { fetchAllAPIs, validateAndExtract };
