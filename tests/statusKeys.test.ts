import test from 'node:test';
import assert from 'node:assert/strict';
import { userStatusKey,leadStatusKey,companyTypeKey,urgencyKey } from '../src/domain/statusKeys';
test('Legacy labels and canonical status keys resolve identically; unknown values are never guessed',()=>{
  for(const fn of [userStatusKey,leadStatusKey,companyTypeKey,urgencyKey])for(const value of [undefined,null,'unrecognised'])assert.equal(fn(value),null);
  assert.equal(userStatusKey('Aktif'),'active');assert.equal(userStatusKey('active'),'active');
  assert.equal(userStatusKey('Askıya Alındı'),'suspended');assert.equal(userStatusKey('pending_auth'),'pending_auth');
  for(const value of ['Devam Ediyor','In Progress','in_progress'])assert.equal(leadStatusKey(value),'in_progress');
  assert.notEqual(leadStatusKey('Olumsuz Sonuçlandı'),leadStatusKey('Reddedildi'));
  assert.equal(companyTypeKey('Distribütör'),'distributor');assert.equal(urgencyKey('1-3 Ay İçinde'),'within_1_3_months');
});
