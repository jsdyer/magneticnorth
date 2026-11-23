import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseCoefficients,fieldAt,calculate,decimalYear,convertBearing,trend,receipt,resultCSV} from '../web/model.mjs';
const cof=readFileSync(new URL('../web/data/WMM.COF',import.meta.url),'utf8');
const model=parseCoefficients(cof),input={latitude:49.1044,longitude:-122.6608,altitudeMetres:0,date:'2026-11-23'};
const fixtures=readFileSync(new URL('./fixtures/WMM2025_TestValues.txt',import.meta.url),'utf8').split('\n').filter(x=>x.trim()&&!x.startsWith('#')).map(x=>x.trim().split(/\s+/).map(Number));
test('all 100 official NOAA/BGS WMM2025 reference points match published precision',()=>{
 assert.equal(fixtures.length,100);
 for(const row of fixtures){const [year,alt,lat,lon]=row,result=fieldAt(model,lat,lon,alt,year);for(const [i,key] of ['declination','inclination','h','x','y','z','f'].entries()){const tolerance=i<2?.0051:.002;assert.ok(Math.abs(result[key]-row[i+4])<tolerance,`${year}/${lat}/${lon} ${key}: ${result[key]} != ${row[i+4]}`);}}
});
test('original coefficient bytes match published provenance SHA-256',()=>{const info=JSON.parse(readFileSync(new URL('../web/data/model-info.json',import.meta.url)));assert.equal(createHash('sha256').update(cof).digest('hex'),info.sha256);assert.equal(info.epoch,2025);});
test('rejects incomplete, duplicate or wrong-epoch coefficients',()=>{assert.throws(()=>parseCoefficients(cof.replace('2025.0','2020.0')));assert.throws(()=>parseCoefficients(cof.split('\n').slice(0,10).join('\n')));const lines=cof.split('\n');lines[2]=lines[1];assert.throws(()=>parseCoefficients(lines.join('\n')),/record/);});
test('calendar conversion handles leap days and rejects impossible dates',()=>{assert.equal(decimalYear('2025-01-01'),2025);assert.equal(decimalYear('2028-07-02'),2028.5);assert.throws(()=>decimalYear('2026-02-29'));assert.throws(()=>decimalYear('2026-13-01'));});
test('valid period includes final 2029 day but excludes 2030 and historical dates',()=>{assert.ok(calculate(model,{...input,date:'2029-12-31'}).year<2030);for(const date of ['2030-01-01','2024-12-31'])assert.throws(()=>calculate(model,{...input,date}),/WMM2025/);});
test('coordinates and explicit altitude are validated',()=>{for(const patch of [{latitude:91},{longitude:-181},{altitudeMetres:850001},{latitude:NaN},{altitudeMetres:-1001}])assert.throws(()=>calculate(model,{...input,...patch}));});
test('true/magnetic signs and wrapping are correct for east and west declination',()=>{assert.equal(convertBearing(90,15,'true'),75);assert.equal(convertBearing(90,15,'magnetic'),105);assert.equal(convertBearing(90,-15,'true'),105);assert.equal(convertBearing(5,15,'true'),350);assert.equal(convertBearing(360,0,'true'),0);assert.throws(()=>convertBearing(-1,15));});
test('poles stay finite and low horizontal intensity is flagged',()=>{for(const lat of [-90,90]){const r=fieldAt(model,lat,0,0,2026);assert.equal(r.geographicPole,true);for(const key of ['declination','inclination','h','x','y','z','f'])assert.ok(Number.isFinite(r[key]));}assert.equal(fieldAt(model,89,-121,28,2025).zone,'blackout');assert.equal(fieldAt(model,80,-96,48,2025).zone,'caution');});
test('each call is independent of prior locations and dates',()=>{const a=calculate(model,input);fieldAt(model,-50,100,100,2029);assert.deepEqual(calculate(model,input),a);});
test('trend samples the installed model period without extrapolation',()=>{const t=trend(model,input,21);assert.equal(t.length,21);assert.equal(t[0].date,'2025-01-01');assert.equal(t.at(-1).date,'2029-12-31');assert.ok(t.every(r=>r.year>=2025&&r.year<2030));});
test('a place beyond the starter list works without changing the model',()=>{const config=JSON.parse(readFileSync(new URL('../web/config.json',import.meta.url)));config.presets.push({id:'toronto',label:'Toronto',latitude:43.6532,longitude:-79.3832});const results=config.presets.map(p=>calculate(model,{...input,...p}));assert.equal(results.length,5);assert.ok(results.at(-1).declination<0);});
test('portable exports retain inputs, units through field names and model provenance',()=>{const r=calculate(model,input),info={name:'WMM2025',epoch:2025};const out=receipt(r,info);assert.equal(out.schema,'coolcode.magneticnorth.v1');assert.equal(out.result.date,input.date);assert.equal(out.model.epoch,2025);assert.match(resultCSV(r),/altitudeMetres/);assert.match(resultCSV(r),/2026-11-23/);});
