import test from 'node:test';
import assert from 'node:assert/strict';
import {projectFromUrl,projectId,streamBimOrigin} from '../src/project-context.mjs';
test('standalone project links work with different projects and regions',()=>{
 assert.deepEqual(projectFromUrl('https://app.streambim.com/webapp/default/#/viewer?projectId=9876'),{origin:'https://app.streambim.com',projectId:'9876'});
 assert.deepEqual(projectFromUrl('https://sweden.streambim.com/webapp/default/?projectId=42'),{origin:'https://sweden.streambim.com',projectId:'42'});
});
test('project ID is validated without a fixed project restriction',()=>{
 for(const id of [1,42,9876])assert.equal(projectId(id),String(id));
 for(const id of ['',null,'../319','0','319&other=true'])assert.throws(()=>projectId(id));
});
test('region validation rejects unrelated origins, credentials, custom ports and non-HTTPS URLs',()=>{
 for(const origin of ['http://app.streambim.com','https://streambim.com.example.com','https://a.b.streambim.com','https://app.streambim.com:8080','https://user@app.streambim.com','https://127.0.0.1'])assert.throws(()=>streamBimOrigin(origin));
 assert.equal(streamBimOrigin('https://sweden.streambim.com/webapp/default/'),'https://sweden.streambim.com');
});
