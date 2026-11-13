import test from 'node:test';
import assert from 'node:assert/strict';
import { zingTrack, zingLyricText, isZing, isNct, NCT_ID_BASE, validTrack } from '../lib/lyrics.mjs';
import { GET as search } from '../app/api/zing/search/route.js';
import { GET as lyrics } from '../app/api/zing/lyrics/route.js';

test('Zing identities stay distinct from NCT and lyric words retain their order', () => {
  const track = zingTrack({encodeId:'ZqfoKtrd1H7M',title:'Nàng Thơ',artistsNames:'Hoàng Dũng',duration:240});
  assert.ok(validTrack(track)); assert.ok(isZing(track)); assert.ok(!isNct(track));
  assert.ok(isNct({id:NCT_ID_BASE+1}));
  assert.equal(track.id, zingTrack({encodeId:'ZqfoKtrd1H7M',title:'Nàng Thơ',artistsNames:'Hoàng Dũng'}).id);
  assert.equal(zingTrack({encodeId:'../bad',title:'bad',artistsNames:'bad'}),null);
  assert.equal(zingLyricText({sentences:[{words:[{data:'Dòng'},{data:'một'}]},{words:[{data:'Dòng hai'}]}]}),'Dòng một\nDòng hai');
  assert.equal(zingLyricText({sentences:[{words:[{data:23}]}]}),'');
});

test('routes validate input, sign server-side, and return normalized search and lyrics', async t => {
  const calls=[];
  t.mock.method(globalThis,'fetch', async input => {
    const url = new URL(input);
    calls.push(url);
    if(url.pathname==='/') return new Response('',{headers:{'set-cookie':'zmp3=test; Path=/; HttpOnly'}});
    assert.match(url.searchParams.get('sig'),/^[a-f0-9]{128}$/);
    if(url.pathname.includes('/search/')) {
      assert.equal(url.searchParams.get('q'),'Nàng Thơ');
      return Response.json({err:0,data:{songs:[{encodeId:'ZqfoKtrd1H7M',title:'Nàng Thơ',artistsNames:'Hoàng Dũng'}]}});
    }
    return Response.json({err:0,data:{sentences:[{words:[{data:'Lời minh họa'}]}]}});
  });
  assert.equal((await search(new Request('http://localhost/api/zing/search?q= '))).status,400);
  assert.equal((await lyrics(new Request('http://localhost/api/zing/lyrics?id=https://bad.example'))).status,400);
  assert.equal(calls.length,0);
  const result=await search(new Request('http://localhost/api/zing/search?q='+encodeURIComponent(' Nàng   Thơ ')));
  assert.equal(result.status,200);
  const [track]=await result.json();assert.equal(track.zingId,'ZqfoKtrd1H7M');
  assert.ok(!JSON.stringify(track).includes('apiKey'));
  assert.deepEqual(await (await lyrics(new Request('http://localhost/api/zing/lyrics?id=ZqfoKtrd1H7M'))).json(),{plainLyrics:'Lời minh họa'});
  t.mock.method(globalThis,'fetch',async ()=>Response.json({err:0,data:{}}));
  assert.equal((await lyrics(new Request('http://localhost/api/zing/lyrics?id=ZqfoKtrd1H7M'))).status,404);
  t.mock.method(globalThis,'fetch',async ()=>Response.json({err:-403,msg:'permission denied'}));
  assert.equal((await search(new Request('http://localhost/api/zing/search?q=a'))).status,502);
});
