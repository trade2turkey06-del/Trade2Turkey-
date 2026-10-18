import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { requestLanguage,apiMessage,outputInstruction,aiText } from '../server/language';
const req=(body:unknown,header='tr')=>({body,get:()=>header}) as any;
test('AI output language is explicit and request-local; schema and names stay invariant',()=>{
 assert.equal(requestLanguage(req({language:'en'})),'en');
 assert.equal(requestLanguage(req({},'en')),'en');
 assert.equal(requestLanguage(req({language:'invalid'})),'tr');
 assert.match(outputInstruction(req({language:'en'})),/OUTPUT LANGUAGE: English/);
 assert.match(outputInstruction(req({language:'tr'})),/OUTPUT LANGUAGE: Turkish/);
 assert.match(outputInstruction(req({language:'en'})),/JSON keys, status codes and numeric values unchanged/);
 assert.match(apiMessage(req({language:'en'}),'aiDisabled'),/disabled/);
 const server=fs.readFileSync('server.ts','utf8');
 assert.match(server,/app.use\("\/api\/ai", \(req, res\) => \{ res.status\(503\)/);
 assert.equal((server.match(/const prompt = outputInstruction\(req\)/g)||[]).length,6);
});

test('Generated fallback prose respects the request language and preserves parameter data',()=>{
 assert.equal(aiText(req({language:'en'}),'alignedFruitJuice'),'Aligned (Fruit Juice)');
 const name='Türkçe Firma';
 const result=aiText(req({language:'en'}),'recommendationReviewValueAsAPotentialManufacturingPartnerFor',name);
 assert.ok(result.includes(name));assert.ok(result.startsWith('Recommendation:'));
});
