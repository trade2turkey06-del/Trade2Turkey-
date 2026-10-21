import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initialWorkspaceTab,retiredPageRedirect} from '../src/domain/navigation';
import Navbar from '../src/components/Navbar';
import {I18nProvider,type Lang} from '../src/i18n';
import type {UserTenant} from '../src/data/usersData';

test('retired page paths, query and hash links resolve to Action Center without losing other parameters',()=>{
 for(const url of ['/client-discovery','/client-discovery/','/?tab=client-discovery','/#client-discovery','/#/client-discovery']){
  assert.equal(retiredPageRedirect(url),'/?tab=overview');assert.equal(initialWorkspaceTab(url),'overview');
 }
 assert.equal(retiredPageRedirect('/client-discovery?project=demo&tab=client-discovery'), '/?project=demo&tab=overview');
 assert.equal(retiredPageRedirect('/?project=demo#client-discovery'),'/?project=demo&tab=overview');
 assert.equal(retiredPageRedirect('/?tab=client-discovery#workspace-content'),'/?tab=overview#workspace-content');
 assert.equal(initialWorkspaceTab('/?tab=overview'),'overview');
});
test('normal entry, OAuth callbacks, remaining pages and unrelated anchors are left unchanged',()=>{
 for(const url of ['/','/auth/callback?code=example&state=test','/?project=demo#workspace-content','/?tab=buyers','/sectors','/api/drive/upload']){
  assert.equal(retiredPageRedirect(url),null);assert.equal(initialWorkspaceTab(url),'sourcing');
 }
});
function navbar(lang:Lang,role:UserTenant['role']){
 const user={id:'test-user',role,companyName:'Example Company',email:'user@example.invalid',projectId:'demo'} as UserTenant;
 return renderToStaticMarkup(React.createElement(I18nProvider,{initialLang:lang,children:React.createElement(Navbar,{
  currentTab:'overview',setCurrentTab:()=>{},currentUser:user,onLogout:()=>{},activeProjectId:'demo',setActiveProjectId:()=>{},projects:[{id:'demo',name:'Örnek Proje',nameEn:'Example Project'}],onOpenNewProjectModal:role==='admin'?()=>{}:undefined,
 })}));
}
test('TR/EN admin navigation keeps all remaining pages, project selector, new project and logout',()=>{
 for(const lang of ['tr','en'] as const){const html=navbar(lang,'admin');
  for(const tab of ['overview','sourcing','logistics','buyers','sectors','market-insights'])assert.ok(html.includes(`id="nav-${tab}"`),`${lang}:${tab}`);
  assert.ok(!html.includes('nav-client-discovery'));assert.ok(html.includes('id="active-project"'));assert.ok(html.includes('value="demo"'));
  assert.ok(html.includes(lang==='en'?'Example Project':'Örnek Proje'));assert.ok(html.includes(lang==='en'?'Create new project':'Yeni proje oluştur'));
  assert.ok(html.includes('TR'));assert.ok(html.includes('EN'));assert.ok(html.includes(lang==='en'?'Sign out':'Çıkış'));
 }
});
test('client navigation does not gain admin pages or project creation',()=>{
 const html=navbar('en','client');for(const tab of ['overview','buyers','sectors','market-insights'])assert.ok(!html.includes(`id="nav-${tab}"`));
 assert.ok(html.includes('id="nav-sourcing"'));assert.ok(html.includes('id="nav-logistics"'));assert.ok(html.includes('id="active-project"'));assert.ok(!html.includes('Create new project'));
});
