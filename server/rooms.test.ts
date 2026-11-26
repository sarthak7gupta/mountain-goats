// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { Rooms } from './rooms';
import { app } from './http';
import type { AddressInfo } from 'node:net';

describe('authoritative rooms', () => {
  function started() {
    const rooms = new Rooms(); const {room, token} = rooms.create({name:'A', capacity:2,bigMountain:true,greenValley:true});
    const guest = rooms.join(room,'B'); rooms.start(room,token,room.revision);
    return {rooms,room,token,guest};
  }
  it('keeps credentials private and enforces host, capacity, started rooms, and turns', () => {
    const {rooms,room,token,guest} = started();
    expect(JSON.stringify(rooms.view(room, token))).not.toContain(token);
    expect(() => rooms.start(room,guest,room.revision)).toThrow('host');
    expect(() => rooms.join(room,'C')).toThrow('started');
    expect(() => rooms.act(room,guest,room.revision,{type:'end'})).toThrow('turn');
    expect(() => rooms.view(room,'bad')).toThrow('Rejoin');
    expect(room.state!.players.map(p => p.name)).toEqual(['A','B']);
  });
  it('rejects replayed and malformed commands without mutating the game', () => {
    const {rooms,room,token} = started(); const before = JSON.stringify(room.state);
    for (const action of [{type:'change',index:0,value:99},{type:'move',mountain:42},{type:'roll'},{type:'select',index:0.5},null]) {
      expect(() => rooms.act(room,token,room.revision,action)).toThrow();
      expect(JSON.stringify(room.state)).toBe(before);
    }
    const revision = room.revision;
    rooms.act(room,token,revision,{type:'select',index:0});
    expect(() => rooms.act(room,token,revision,{type:'select',index:1})).toThrow('changed');
    expect(room.revision).toBe(revision+1);
  });
  it('rolls once on start and each end, with no client reroll action', () => {
    const {rooms,room,token,guest} = started();
    rooms.act(room,token,room.revision,{type:'end'});
    expect(room.state!.currentPlayerIndex).toBe(1);
    rooms.act(room,guest,room.revision,{type:'end'});
    expect(room.state!.currentTurn).toBe(2);
    expect(room.state!.dice.every(d => d.value >= 1 && d.value <= 6 && !d.used)).toBe(true);
  });
  it('does not bump the revision for commands that change nothing', () => {
    const {rooms,room,token} = started(); const revision = room.revision;
    rooms.act(room,token,revision,{type:'clear'});
    expect(room.revision).toBe(revision);
  });
  it('serializes concurrent joins at capacity', () => {
    const rooms = new Rooms(); const {room} = rooms.create({name:'A',capacity:2}); rooms.join(room,'B');
    expect(() => rooms.join(room,'C')).toThrow('full');
    expect(room.seats).toHaveLength(2);
  });
  it('expires old rooms', () => {
    const rooms = new Rooms(); const {room} = rooms.create({name:'A',capacity:2}); room.touched = 0;
    expect(() => rooms.get(room.code)).toThrow('expired');
  });
});

describe('HTTP multiple devices', () => {
  it('creates, joins, reconnects, rejects cross-origin posts and plays from separate clients', async () => {
    const server = app(); await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    async function call(path:string, token?:string, data?:unknown, extra?:Record<string,string>) {
      const res = await fetch(`${origin}/api${path}`,{method:data === undefined ? 'GET':'POST',headers:{'Content-Type':'application/json',...(token ? {Authorization:`Bearer ${token}`} : {}),...extra},body:data === undefined ? undefined:JSON.stringify(data)});
      return {status:res.status, data:await res.json()};
    }
    try {
      const host = await call('/rooms',undefined,{name:'Host',capacity:2}); expect(host.status).toBe(201);
      const code = host.data.room.code;
      const guest = await call(`/rooms/${code}/join`,undefined,{name:'Guest'});
      expect((await call(`/rooms/${code}/start`,guest.data.token,{revision:1})).status).toBe(403);
      const start = await call(`/rooms/${code}/start`,host.data.token,{revision:1}); expect(start.status).toBe(200);
      const revision = start.data.revision;
      const stale = await call(`/rooms/${code}/action`,host.data.token,{revision:0,action:{type:'end'}}); expect(stale.status).toBe(409);
      const denied = await call(`/rooms/${code}/action`,host.data.token,{revision,action:{type:'end'}},{Origin:'https://evil.example'}); expect(denied.status).toBe(403);
      const [one,two] = await Promise.all([call(`/rooms/${code}/action`,host.data.token,{revision,action:{type:'end'}}),call(`/rooms/${code}/action`,host.data.token,{revision,action:{type:'end'}})]);
      expect([one.status,two.status].sort()).toEqual([200,409]);
      const reconnect = await call(`/rooms/${code}`,guest.data.token); expect(reconnect.data.you).toBe(1); expect(reconnect.data.state.currentPlayerIndex).toBe(1);
      expect((await call(`/rooms/${code}`)).status).toBe(401);
      expect((await call('/rooms',undefined,{name:'Bad',capacity:7})).status).toBe(400);
      const config = await call('/config'); expect(config.data.mode).toBe('lan'); expect(Array.isArray(config.data.lanUrls)).toBe(true);
      expect((await fetch(`${origin}/%E0%A4%A`)).status).toBe(404);
    } finally { await new Promise<void>((resolve,reject) => server.close(error => error ? reject(error):resolve())); }
  });
});
