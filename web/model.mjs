// Degree-12 spherical-harmonic synthesis adapted from NOAA's public-domain
// WMM Legacy C geomag.c. Coefficients are WMM2025, not the legacy model's data.
const DEG = Math.PI / 180;
const matrix = () => Array.from({length: 13}, () => new Float64Array(13));

export function parseCoefficients(text) {
  const lines = text.trim().split(/\r?\n/), header = lines.shift().trim().split(/\s+/);
  const epoch = Number(header[0]);
  if (epoch !== 2025 || header[1] !== 'WMM-2025') throw Error('Expected the WMM2025 coefficient file.');
  const rows = [], seen = new Set();
  for (const line of lines) {
    if (line.trim().startsWith('9999')) break;
    const row = line.trim().split(/\s+/).map(Number);
    const [n, m] = row;
    if (row.length !== 6 || !row.every(Number.isFinite) || !Number.isInteger(n) || !Number.isInteger(m) || n < 1 || n > 12 || m < 0 || m > n || seen.has(`${n}:${m}`)) throw Error('Invalid WMM coefficient record.');
    seen.add(`${n}:${m}`); rows.push(row);
  }
  if (rows.length !== 90) throw Error('The degree-12 coefficient file is incomplete.');
  return {epoch, name: header[1], rows};
}

export function decimalYear(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Error('Choose a complete calendar date.');
  const time = Date.parse(date + 'T00:00:00Z'), year = Number(date.slice(0, 4));
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== date) throw Error('That calendar date does not exist.');
  return year + (time - Date.UTC(year, 0, 1)) / (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1));
}

export function validateInput({latitude, longitude, altitudeMetres, date}) {
  if (![latitude, longitude, altitudeMetres].every(x => typeof x === 'number' && Number.isFinite(x))) throw Error('Enter numeric coordinates and altitude.');
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) throw Error('Latitude must be −90 to 90°, and longitude −180 to 180°.');
  if (altitudeMetres < -1000 || altitudeMetres > 850000) throw Error('This calculator accepts −1,000 to 850,000 metres above the WGS84 ellipsoid.');
  const year = decimalYear(date);
  if (year < 2025 || year >= 2030) throw Error('WMM2025 covers 1 January 2025 through 31 December 2029. Choose a date in that period.');
  return {latitude, longitude, altitudeMetres, date, year};
}

export function fieldAt(model, latitude, longitude, altitudeKm, year) {
  if (![latitude, longitude, altitudeKm, year].every(Number.isFinite) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || altitudeKm < -1 || altitudeKm > 850 || year < model.epoch || year >= model.epoch + 5) throw Error('Calculation inputs are outside this model’s supported range.');
  const c = matrix(), cd = matrix(), tc = matrix(), dp = matrix(), k = matrix();
  const p = new Float64Array(169), sp = new Float64Array(13), cp = new Float64Array(13), pp = new Float64Array(13);
  p[0] = cp[0] = pp[0] = 1;
  for (const [n, m, g, h, dg, dh] of model.rows) {
    c[m][n] = g; cd[m][n] = dg;
    if (m) { c[n][m - 1] = h; cd[n][m - 1] = dh; }
  }
  for (let n = 1; n <= 12; n++) {
    p[n] = p[n - 1] * (2 * n - 1) / n;
    let j = 2;
    for (let m = 0; m <= n; m++) {
      k[m][n] = ((n - 1) ** 2 - m ** 2) / ((2 * n - 1) * (2 * n - 3));
      if (m) {
        p[n + m * 13] = p[n + (m - 1) * 13] * Math.sqrt((n - m + 1) * j / (n + m)); j = 1;
        c[n][m - 1] *= p[n + m * 13]; cd[n][m - 1] *= p[n + m * 13];
      }
      c[m][n] *= p[n + m * 13]; cd[m][n] *= p[n + m * 13];
    }
  }
  k[1][1] = 0;
  const a = 6378.137, b = 6356.7523142, re = 6371.2, a2 = a*a, b2 = b*b, c2 = a2-b2, a4 = a2*a2, c4 = a4-b2*b2;
  const sinLat = Math.sin(latitude * DEG), cosLat = Math.cos(latitude * DEG), sin2 = sinLat*sinLat, cos2 = cosLat*cosLat;
  sp[1] = Math.sin(longitude * DEG); cp[1] = Math.cos(longitude * DEG);
  const q = Math.sqrt(a2 - c2*sin2), q1 = altitudeKm*q, q2 = ((q1+a2)/(q1+b2))**2;
  const ct = sinLat/Math.sqrt(q2*cos2+sin2), st = Math.sqrt(Math.max(0, 1-ct*ct));
  const r = Math.sqrt(altitudeKm*altitudeKm+2*q1+(a4-c4*sin2)/(q*q));
  const d = Math.sqrt(a2*cos2+b2*sin2), ca = (altitudeKm+d)/r, sa = c2*cosLat*sinLat/(r*d);
  for (let m=2; m<=12; m++) {sp[m]=sp[1]*cp[m-1]+cp[1]*sp[m-1];cp[m]=cp[1]*cp[m-1]-sp[1]*sp[m-1];}
  const aor = re/r, dt = year-model.epoch;
  let ar = aor*aor, br=0, bt=0, bp=0, bpp=0;
  for (let n=1; n<=12; n++) {
    ar *= aor;
    for (let m=0; m<=n; m++) {
      const index=n+m*13;
      if(n===m){p[index]=st*p[n-1+(m-1)*13];dp[m][n]=st*dp[m-1][n-1]+ct*p[n-1+(m-1)*13];}
      else if(n===1){p[index]=ct*p[n-1+m*13];dp[m][n]=ct*dp[m][n-1]-st*p[n-1+m*13];}
      else {if(m>n-2){p[n-2+m*13]=0;dp[m][n-2]=0;}p[index]=ct*p[n-1+m*13]-k[m][n]*p[n-2+m*13];dp[m][n]=ct*dp[m][n-1]-st*p[n-1+m*13]-k[m][n]*dp[m][n-2];}
      tc[m][n]=c[m][n]+dt*cd[m][n];if(m)tc[n][m-1]=c[n][m-1]+dt*cd[n][m-1];
      const temp1=tc[m][n]*cp[m]+(m?tc[n][m-1]*sp[m]:0),temp2=tc[m][n]*sp[m]-(m?tc[n][m-1]*cp[m]:0),par=ar*p[index];
      bt-=ar*temp1*dp[m][n];bp+=m*temp2*par;br+=(n+1)*temp1*par;
      if(st===0&&m===1){pp[n]=n===1?pp[n-1]:ct*pp[n-1]-k[m][n]*pp[n-2];bpp+=m*temp2*ar*pp[n];}
    }
  }
  bp=st===0?bpp:bp/st;
  const x=-bt*ca-br*sa,y=bp,z=bt*sa-br*ca,h=Math.hypot(x,y),f=Math.hypot(h,z),declination=Math.atan2(y,x)/DEG,inclination=Math.atan2(z,h)/DEG;
  return {declination,inclination,x,y,z,h,f,declinationUncertainty:Math.hypot(0.26,5417/h),zone:h<2000?'blackout':h<6000?'caution':'normal',geographicPole:Math.abs(latitude)===90};
}

export function calculate(model, input) {const checked=validateInput(input);return {...checked,...fieldAt(model,checked.latitude,checked.longitude,checked.altitudeMetres/1000,checked.year)};}
export function wrapBearing(value){return ((value%360)+360)%360;}
export function convertBearing(bearing,declination,from='true'){
  if(!Number.isFinite(bearing)||bearing<0||bearing>360||!Number.isFinite(declination)||!['true','magnetic'].includes(from))throw Error('Enter a bearing from 0 to 360°.');
  return wrapBearing(bearing+(from==='magnetic'?declination:-declination));
}
export function trend(model,input,count=21){
  const sampleCount=Math.max(2,Math.min(101,Math.trunc(count)||21));
  const first=Date.UTC(2025,0,1),last=Date.UTC(2029,11,31);
  return Array.from({length:sampleCount},(_,i)=>calculate(model,{...input,date:new Date(first+(last-first)*i/(sampleCount-1)).toISOString().slice(0,10)}));
}
export function receipt(result,provenance){return {schema:'coolcode.magneticnorth.v1',calculatedAt:new Date().toISOString(),model:provenance,result};}
export function resultCSV(result){const keys=['date','latitude','longitude','altitudeMetres','declination','inclination','h','f','x','y','z','zone'];return keys.map(key=>['h','f','x','y','z'].includes(key)?key+'_nT':['declination','inclination'].includes(key)?key+'_degrees':key).join(',')+'\r\n'+keys.map(key=>String(result[key])).join(',')+'\r\n';}
