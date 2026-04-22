// ISO 3166-1 alpha-2 country code to name map
const COUNTRY_NAMES = {
  AF:'Afghanistan',DZ:'Algeria',AO:'Angola',AR:'Argentina',AU:'Australia',
  AT:'Austria',BD:'Bangladesh',BE:'Belgium',BJ:'Benin',BO:'Bolivia',
  BR:'Brazil',BG:'Bulgaria',BF:'Burkina Faso',BI:'Burundi',CM:'Cameroon',
  CA:'Canada',CF:'Central African Republic',TD:'Chad',CL:'Chile',CN:'China',
  CO:'Colombia',CG:'Congo',CD:'DR Congo',HR:'Croatia',CU:'Cuba',
  CZ:'Czech Republic',DK:'Denmark',DO:'Dominican Republic',EC:'Ecuador',
  EG:'Egypt',SV:'El Salvador',ET:'Ethiopia',FI:'Finland',FR:'France',
  GA:'Gabon',GM:'Gambia',DE:'Germany',GH:'Ghana',GR:'Greece',
  GT:'Guatemala',GN:'Guinea',HT:'Haiti',HN:'Honduras',HU:'Hungary',
  IN:'India',ID:'Indonesia',IQ:'Iraq',IE:'Ireland',IL:'Israel',
  IT:'Italy',CI:"Cote d'Ivoire",JM:'Jamaica',JP:'Japan',JO:'Jordan',
  KZ:'Kazakhstan',KE:'Kenya',KW:'Kuwait',LB:'Lebanon',LR:'Liberia',
  LY:'Libya',MG:'Madagascar',MW:'Malawi',MY:'Malaysia',ML:'Mali',
  MR:'Mauritania',MX:'Mexico',MA:'Morocco',MZ:'Mozambique',MM:'Myanmar',
  NP:'Nepal',NL:'Netherlands',NZ:'New Zealand',NI:'Nicaragua',NE:'Niger',
  NG:'Nigeria',NO:'Norway',PK:'Pakistan',PA:'Panama',PY:'Paraguay',
  PE:'Peru',PH:'Philippines',PL:'Poland',PT:'Portugal',RO:'Romania',
  RU:'Russia',RW:'Rwanda',SA:'Saudi Arabia',SN:'Senegal',SL:'Sierra Leone',
  SO:'Somalia',ZA:'South Africa',SS:'South Sudan',ES:'Spain',LK:'Sri Lanka',
  SD:'Sudan',SE:'Sweden',CH:'Switzerland',SY:'Syria',TW:'Taiwan',
  TZ:'Tanzania',TH:'Thailand',TG:'Togo',TN:'Tunisia',TR:'Turkey',
  UG:'Uganda',UA:'Ukraine',GB:'United Kingdom',US:'United States',
  UY:'Uruguay',VE:'Venezuela',VN:'Vietnam',YE:'Yemen',ZM:'Zambia',ZW:'Zimbabwe',
};

function getCountryName(code) {
  return COUNTRY_NAMES[code] || code;
}

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
  if (!genderData.gender || genderData.count === 0)
    return { error: { status: 502, message: 'Genderize returned an invalid response' } };
  if (ageData.age === null || ageData.age === undefined)
    return { error: { status: 502, message: 'Agify returned an invalid response' } };
  if (!nationData.country || nationData.country.length === 0)
    return { error: { status: 502, message: 'Nationalize returned an invalid response' } };

  const topCountry = nationData.country.reduce((best, c) =>
    c.probability > best.probability ? c : best
  );

  const age = ageData.age;
  return {
    profile: {
      gender:              genderData.gender,
      gender_probability:  genderData.probability,
      sample_size:         genderData.count,
      age,
      age_group:           classifyAgeGroup(age),
      country_id:          topCountry.country_id,
      country_name:        getCountryName(topCountry.country_id),
      country_probability: topCountry.probability,
    },
  };
}

module.exports = { fetchAllAPIs, validateAndExtract, getCountryName };
