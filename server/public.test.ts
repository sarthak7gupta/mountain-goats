// @vitest-environment node
import { describe,it,expect } from 'vitest';
import { Rooms } from './rooms';
describe('guest public room discovery', () => {
 it('lists only joinable public rooms without seat credentials or private room codes', () => {
  const rooms=new Rooms(); const privateRoom=rooms.create({name:'Private',capacity:2});
  const open=rooms.create({name:'Open',capacity:3,public:true,bigMountain:true});
  const full=rooms.create({name:'Full',capacity:2,public:true}); rooms.join(full.room,'Guest');
  const started=rooms.create({name:'Started',capacity:3,public:true}); rooms.join(started.room,'Guest'); rooms.start(started.room,started.token,started.room.revision);
  const listing=rooms.publicRooms(); expect(listing).toHaveLength(1); expect(listing[0].code).toBe(open.room.code);
  const data=JSON.stringify(listing); expect(data).not.toContain(privateRoom.room.code); expect(data).not.toContain(open.token); expect(data).not.toContain('Open');
  expect(listing[0].expansions.bigMountain).toBe(true);
  rooms.join(open.room,'Anonymous guest'); expect(rooms.publicRooms()[0].players).toBe(2);
 });
 it('cannot bypass capacity with a stale public listing', () => {
  const rooms=new Rooms(); const {room}=rooms.create({name:'Host',capacity:2,public:true}); const code=rooms.publicRooms()[0].code;
  rooms.join(rooms.get(code),'Guest'); expect(rooms.publicRooms()).toHaveLength(0);
  expect(()=>rooms.join(room,'Late guest')).toThrow('full');
 });
});
