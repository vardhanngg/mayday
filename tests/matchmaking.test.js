const test = require('node:test');
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const WebSocket = require('ws');

const root = path.resolve(__dirname, '..');

function reservePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function makeClient(url) {
  const events = [];
  const waiters = [];
  const socket = new WebSocket(url);
  socket.on('message', raw => {
    let message;
    try { message = JSON.parse(raw.toString()); } catch { return; }
    events.push(message);
    for (let i = waiters.length - 1; i >= 0; i--) {
      const waiter = waiters[i];
      if (!waiter.predicate(message)) continue;
      clearTimeout(waiter.timer);
      waiters.splice(i, 1);
      waiter.resolve(message);
    }
  });
  socket.on('error', () => {});
  return {
    socket,
    events,
    opened: new Promise((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    }),
    waitFor(predicate, timeoutMs = 7000) {
      const old = events.find(predicate);
      if (old) return Promise.resolve(old);
      return new Promise((resolve, reject) => {
        const waiter = {predicate, resolve, reject, timer: null};
        waiter.timer = setTimeout(() => {
          const index = waiters.indexOf(waiter);
          if (index >= 0) waiters.splice(index, 1);
          reject(new Error('Timed out waiting for matchmaking message. Events: ' + JSON.stringify(events.map(x => ({t:x.t,status:x.status,mode:x.mode,state:x.state})))));
        }, timeoutMs);
        waiters.push(waiter);
      });
    },
    send(value) { socket.send(JSON.stringify(value)); },
    close() { try { socket.terminate(); } catch {} }
  };
}

async function startServer(port, dataDir) {
  const child = spawn(process.execPath, [path.join(root, 'server.js')], {
    cwd: root,
    env: {...process.env, PORT: String(port), MAYDAY_DATA_DIR: dataDir, MAYDAY_MATCHMAKING_TIMEOUT_MS: '1000'},
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk.toString(); });
  child.stderr.on('data', chunk => { output += chunk.toString(); });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('MAYDAY server startup timed out. Logs: ' + output)), 10000);
    const inspect = () => {
      if (output.includes('running!')) {
        clearTimeout(timer);
        resolve();
      }
    };
    child.stdout.on('data', inspect);
    child.stderr.on('data', inspect);
    child.once('exit', code => {
      clearTimeout(timer);
      reject(new Error('MAYDAY server exited before startup (' + code + '). Logs: ' + output));
    });
    inspect();
  });
  return {child, getOutput: () => output};
}

test('automatic matchmaking starts Dogfight, balances Clash Squad, starts Survivor, and supports cancellation', async t => {
  const port = await reservePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mayday-matchmaking-'));
  const {child, getOutput} = await startServer(port, dataDir);
  const clients = [];
  const url = 'ws://127.0.0.1:' + port;

  const connect = async name => {
    const client = makeClient(url);
    clients.push(client);
    await client.opened;
    return client;
  };

  try {
    await t.test('queue cancellation removes the player from the queue', async () => {
      const pilot = await connect('Cancel Pilot');
      pilot.send({t:'matchmake', mode:'survivor', n:'Cancel Pilot', ty:'balanced'});
      const searching = await pilot.waitFor(m => m.t==='matchmaking' && m.status==='searching');
      assert.equal(searching.mode, 'survivor');
      assert.equal(searching.players, 1);
      pilot.send({t:'matchmakeCancel', mode:'survivor'});
      const cancelled = await pilot.waitFor(m => m.t==='matchmaking' && m.status==='cancelled');
      assert.equal(cancelled.mode, 'survivor');
      assert.match(cancelled.message, /cancel/i);
    });

    await t.test('a solo queue becomes a full AI-filled Dogfight and AI pilots move on the server', async () => {
      const pilot = await connect('Solo Pilot');
      pilot.send({t:'matchmake', mode:'ffa', n:'Solo Pilot', ty:'balanced'});
      const matched = await pilot.waitFor(m => m.t==='matchmaking' && m.status==='matched' && m.mode==='ffa');
      assert.equal(matched.players, 8);
      assert.equal(matched.aiPlayers, 7);
      await pilot.waitFor(m => m.t==='round' && m.mode==='ffa');
      const room = await pilot.waitFor(m => m.t==='room' && m.mode==='ffa' && m.state==='playing');
      assert.equal(room.players.length, 8);
      assert.equal(room.players.filter(p => p.ai).length, 7);
      assert.equal(room.players.filter(p => !p.ai).length, 1);
      const firstSnap = await pilot.waitFor(m => m.t==='snap' && Object.values(m.players||{}).filter(p => p.ai).length===7);
      const botId = Object.keys(firstSnap.players).find(id => firstSnap.players[id].ai);
      const firstPosition = firstSnap.players[botId].p.slice();
      await new Promise(resolve => setTimeout(resolve, 500));
      const latestSnap = [...pilot.events].reverse().find(m => m.t==='snap' && m.players?.[botId]);
      assert.ok(latestSnap, 'server should publish shared snapshots for AI pilots');
      assert.notDeepEqual(latestSnap.players[botId].p, firstPosition, 'AI aircraft should move server-side');
      pilot.send({t:'leave'});
      await pilot.waitFor(m => m.t==='left' && m.ok===true);
    });

    await t.test('Dogfight pairs queued pilots into a live room after the quiet-queue timeout', async () => {
      const a = await connect('Dogfight A');
      const b = await connect('Dogfight B');
      a.send({t:'matchmake', mode:'ffa', n:'Dogfight A', ty:'balanced'});
      b.send({t:'matchmake', mode:'ffa', n:'Dogfight B', ty:'fighter'});
      const [roundA, roundB] = await Promise.all([
        a.waitFor(m => m.t==='round' && m.mode==='ffa'),
        b.waitFor(m => m.t==='round' && m.mode==='ffa')
      ]);
      assert.equal(roundA.n, 1);
      assert.equal(roundB.n, 1);
      const welcomeA = a.events.find(m => m.t==='welcome' && m.mode==='ffa');
      const welcomeB = b.events.find(m => m.t==='welcome' && m.mode==='ffa');
      assert.ok(welcomeA?.code);
      assert.equal(welcomeA.code, welcomeB.code);
      const liveRoom = await a.waitFor(m => m.t==='room' && m.mode==='ffa' && m.state==='playing');
      assert.equal(liveRoom.players.length, 8);
      assert.equal(liveRoom.players.filter(p => p.ai).length, 6);

      const late = await connect('Late Arriver');
      late.send({t:'matchmake', mode:'ffa', n:'Late Arriver', ty:'balanced'});
      const backfilled = await late.waitFor(m => m.t==='matchmaking' && m.status==='matched' && m.mode==='ffa');
      assert.equal(backfilled.backfill, true);
      assert.equal(backfilled.roomCode, welcomeA.code);
      assert.equal(backfilled.aiPlayers, 5);
      await late.waitFor(m => m.t==='round' && m.mode==='ffa' && m.backfill===true);
      const updatedRoom = await late.waitFor(m => m.t==='room' && m.code===welcomeA.code && m.state==='playing');
      assert.equal(updatedRoom.players.length, 8);
      assert.equal(updatedRoom.players.filter(p => p.ai).length, 5);
      assert.equal(updatedRoom.players.filter(p => !p.ai).length, 3);
      await Promise.all([a,b,late].map(async pilot => {
        pilot.send({t:'leave'});
        await pilot.waitFor(m => m.t==='left' && m.ok===true);
      }));
    });

    await t.test('Clash Squad distributes a partial queue evenly across two teams', async () => {
      const teamPilots = await Promise.all([
        connect('Clash A'), connect('Clash B'), connect('Clash C'), connect('Clash D')
      ]);
      teamPilots.forEach((pilot, i) => pilot.send({t:'matchmake', mode:'clash', n:'Clash '+String.fromCharCode(65+i), ty:'balanced'}));
      await Promise.all(teamPilots.map(p => p.waitFor(m => m.t==='round' && m.mode==='clash')));
      const room = await teamPilots[0].waitFor(m => m.t==='room' && m.mode==='clash' && m.state==='playing');
      assert.equal(room.players.length, 8);
      assert.equal(room.players.filter(p => p.ai).length, 4);
      const counts = room.players.reduce((acc, p) => {
        acc[p.team] = (acc[p.team] || 0) + 1;
        return acc;
      }, {});
      assert.deepEqual(Object.values(counts).sort((x,y)=>x-y), [4,4]);
      const humanCounts = room.players.filter(p => !p.ai).reduce((acc,p) => { acc[p.team]=(acc[p.team]||0)+1; return acc; }, {});
      assert.deepEqual(Object.values(humanCounts).sort((x,y)=>x-y), [2,2]);
      assert.ok(teamPilots.every(p => p.events.some(m => m.t==='welcome' && m.mode==='clash')));
    });

    await t.test('Survivor queue starts a small live match when the queue stays quiet', async () => {
      const a = await connect('Survivor A');
      const b = await connect('Survivor B');
      a.send({t:'matchmake', mode:'survivor', n:'Survivor A', ty:'balanced'});
      b.send({t:'matchmake', mode:'survivor', n:'Survivor B', ty:'interceptor'});
      const [roundA, roundB] = await Promise.all([
        a.waitFor(m => m.t==='round' && m.mode==='survivor'),
        b.waitFor(m => m.t==='round' && m.mode==='survivor')
      ]);
      assert.equal(roundA.n, 1);
      assert.equal(roundB.n, 1);
      const welcomeA = a.events.find(m => m.t==='welcome' && m.mode==='survivor');
      const welcomeB = b.events.find(m => m.t==='welcome' && m.mode==='survivor');
      assert.equal(welcomeA.code, welcomeB.code);
      const liveRoom = await a.waitFor(m => m.t==='room' && m.mode==='survivor' && m.state==='playing');
      assert.equal(liveRoom.players.length, 6);
      assert.equal(liveRoom.players.filter(p => p.ai).length, 4);
    });
  } finally {
    for (const client of clients) client.close();
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await Promise.race([
        new Promise(resolve => child.once('exit', resolve)),
        new Promise(resolve => setTimeout(resolve, 3000))
      ]);
      if (child.exitCode === null) child.kill('SIGKILL');
    }
    fs.rmSync(dataDir, {recursive:true, force:true});
    if (child.exitCode !== 0 && child.exitCode !== null) {
      assert.fail('MAYDAY server failed during test cleanup. Logs: ' + getOutput());
    }
  }
});
