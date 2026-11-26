// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe,it,expect } from 'vitest';
import { Rooms } from './rooms';
describe('durable private rooms', () => {
 it('restores game, seats, credentials and revision after a full reopen', () => {
  const dir=mkdtempSync(join(tmpdir(),'goats-')); const path=join(dir,'rooms.sqlite');
  try {
   const first=new Rooms(path); const {room,token}=first.create({name:'Host',capacity:2}); const guest=first.join(room,'Guest'); first.start(room,token,room.revision);
   first.act(room,token,room.revision,{type:'end'}); const before=JSON.stringify(first.view(room,guest)); first.close();
   const second=new Rooms(path); expect(JSON.stringify(second.view(second.get(room.code),guest))).toBe(before);
   second.act(second.get(room.code),guest,room.revision,{type:'end'}); expect(second.get(room.code).game!.state.currentTurn).toBe(2); second.close();
  } finally { rmSync(dir,{recursive:true,force:true}); }
 });
 it('boots past an unreadable saved room', () => {
  const dir=mkdtempSync(join(tmpdir(),'goats-')); const path=join(dir,'rooms.sqlite');
  try {
   const first=new Rooms(path); const {room}=first.create({name:'Host',capacity:2});
   first.database!.prepare('INSERT INTO rooms (code, data) VALUES (?, ?)').run('BROKEN','{not json'); first.close();
   const second=new Rooms(path); expect(second.get(room.code).seats).toHaveLength(1); expect(()=>second.get('BROKEN')).toThrow('expired'); second.close();
  } finally { rmSync(dir,{recursive:true,force:true}); }
 });
 it('does not change live state when the durable write fails', () => {
  const dir=mkdtempSync(join(tmpdir(),'goats-'));
  try {
   const rooms=new Rooms(join(dir,'rooms.sqlite')); const {room}=rooms.create({name:'Host',capacity:2}); rooms.close();
   expect(()=>rooms.join(room,'Guest')).toThrow(); expect(room.seats).toHaveLength(1); expect(room.revision).toBe(0);
  } finally { rmSync(dir,{recursive:true,force:true}); }
 });
});
