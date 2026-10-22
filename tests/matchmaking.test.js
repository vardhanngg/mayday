const test = require('node:test');
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const WebSocket = require('ws');

const root = path.resolve(__dirname, '..');
const pilotFirstNames = new Set(require(path.join(root, 'pilot-names.json')).map(name => String(name || '').trim().split(/\s+/)[0].slice(0, 14)));

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

async function startServer(port, dataDir, matchmakingTimeoutMs = 1000) {
  const child = spawn(process.execPath, [path.join(root, 'server.js')], {
    cwd: root,
    env: {...process.env, PORT: String(port), MAYDAY_DATA_DIR: dataDir, MAYDAY_MATCHMAKING_TIMEOUT_MS: String(matchmakingTimeoutMs)},
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
  const {child, getOutput} = await startServer(port, dataDir, 5000);
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

    await t.test('a solo queue becomes a full Dogfight using randomized pilot names and server movement', async () => {
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
      const simulatedNames = room.players.filter(p => p.ai).map(p => p.n);
      assert.equal(new Set(simulatedNames).size, 7, 'pilot display names should be unique in the match');
      assert.ok(simulatedNames.every(name => pilotFirstNames.has(name)), 'simulated pilots should draw first names from the supplied name list');
      assert.ok(simulatedNames.every(name => !/\s/.test(name)), 'simulated pilot display names should contain only a first name');
      assert.ok(simulatedNames.every(name => !/^AI\b/i.test(name)), 'pilot display names should not use an AI prefix');
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


    await t.test('a returning profile name is preserved if reconnect sends the Pilot placeholder', async () => {
      const creator = await connect('Profile Creator');
      creator.send({t:'socialHello', name:'Karan'});
      const created = await creator.waitFor(m => m.t==='socialWelcome');
      assert.equal(created.profile.name, 'Karan');
      creator.close();

      const returning = await connect('Profile Restored');
      returning.send({t:'socialHello', name:'Pilot', profileId:created.profile.id, profileToken:created.profileToken});
      const restored = await returning.waitFor(m => m.t==='socialWelcome');
      assert.equal(restored.profile.name, 'Karan', 'a default client placeholder must not erase the saved profile name');

      returning.send({t:'matchmake', mode:'ffa', n:'Pilot', profileId:created.profile.id, profileToken:created.profileToken, ty:'balanced'});
      await returning.waitFor(m => m.t==='matchmaking' && m.status==='matched' && m.mode==='ffa');
      const room = await returning.waitFor(m => m.t==='room' && m.mode==='ffa' && m.state==='playing');
      const human = room.players.find(p => !p.ai);
      assert.equal(human.n, 'Karan', 'match roster should use the authenticated player name, not Pilot');
      returning.send({t:'leave'});
      await returning.waitFor(m => m.t==='left' && m.ok===true);
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
      assert.deepEqual(liveRoom.players.filter(p => !p.ai).map(p => p.n).sort(), ['Dogfight A','Dogfight B']);

      const late = await connect('Late Arriver');
      late.send({t:'matchmake', mode:'ffa', n:'Late Arriver', ty:'balanced'});
      await late.waitFor(m => m.t==='matchmaking' && m.status==='searching' && m.mode==='ffa');

      // A live match must not accept new matchmaking players, even when AI seats remain.
      await new Promise(resolve => setTimeout(resolve, 1200));
      assert.equal(late.events.some(m => m.t==='matchmaking' && m.status==='matched'), false,
        'late arrivals must not be inserted into a match that has already started');
      assert.equal(late.events.some(m => m.t==='welcome' && m.quickMatch), false,
        'late arrivals must remain in the queue rather than joining a live room');

      late.send({t:'matchmakeCancel', mode:'ffa'});
      await late.waitFor(m => m.t==='matchmaking' && m.status==='cancelled');
      await Promise.all([a,b].map(async pilot => {
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

test('unexpected Survivor disconnect does not block the remaining pilot from winning', async t => {
  const port = await reservePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mayday-survivor-disconnect-'));
  const {child, getOutput} = await startServer(port, dataDir, 5000);
  const clients = [];
  const url = 'ws://127.0.0.1:' + port;
  const connect = async () => {
    const client = makeClient(url);
    clients.push(client);
    await client.opened;
    return client;
  };

  try {
    const host = await connect();
    host.send({t:'host', mode:'survivor', n:'Survivor Host', ty:'balanced'});
    const hostWelcome = await host.waitFor(m => m.t==='welcome' && m.mode==='survivor');

    const guest = await connect();
    guest.send({t:'join', roomId:hostWelcome.code, code:hostWelcome.code, n:'Disconnected Pilot', ty:'balanced'});
    await guest.waitFor(m => m.t==='welcome' && m.code===hostWelcome.code);
    await host.waitFor(m => m.t==='room' && m.code===hostWelcome.code && m.players.length===2);

    host.send({t:'start'});
    await host.waitFor(m => m.t==='round' && m.mode==='survivor' && m.n===1);

    const closed = new Promise(resolve => guest.socket.once('close', resolve));
    guest.socket.close(1001, 'temporary network loss');
    await closed;

    const result = await host.waitFor(m => m.t==='matchend' && m.mode==='survivor');
    assert.equal(result.win, 'Survivor Host',
      'a disconnected opponent must not remain eligible and block Survivor completion');
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
      assert.fail('MAYDAY Survivor disconnect test failed. Logs: ' + getOutput());
    }
  }
});

test('combat hit reports require a recent plausible shot and cannot spoof damage', async t => {
  const port = await reservePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mayday-combat-validation-'));
  const {child, getOutput} = await startServer(port, dataDir, 5000);
  const clients = [];
  const url = 'ws://127.0.0.1:' + port;
  const connect = async () => {
    const client = makeClient(url);
    clients.push(client);
    await client.opened;
    return client;
  };

  try {
    const attacker = await connect();
    attacker.send({t:'host', mode:'ffa', n:'Attacker', ty:'balanced'});
    const aw = await attacker.waitFor(m => m.t==='welcome' && m.mode==='ffa');
    const victim = await connect();
    victim.send({t:'join', roomId:aw.code, code:aw.code, n:'Victim', ty:'balanced'});
    const vw = await victim.waitFor(m => m.t==='welcome' && m.code===aw.code);
    await attacker.waitFor(m => m.t==='room' && m.code===aw.code && m.players.length===2);

    attacker.send({t:'start'});
    await attacker.waitFor(m => m.t==='round' && m.mode==='ffa' && m.n===1);
    attacker.send({t:'s', p:[0,500,0], q:[0,0,0,1]});
    victim.send({t:'s', p:[0,500,1000], q:[0,0,0,1]});
    await new Promise(resolve => setTimeout(resolve, 3200));

    const before = attacker.events.filter(m => m.t==='snap' && m.players && m.players[vw.id]).at(-1);
    const beforeHp = before.players[vw.id].hp;
    attacker.send({t:'hit', id:vw.id});
    await new Promise(resolve => setTimeout(resolve, 150));
    const afterSpoof = attacker.events.filter(m => m.t==='snap' && m.players && m.players[vw.id]).at(-1);
    assert.equal(afterSpoof.players[vw.id].hp, beforeHp,
      'a hit report without a recent shot must not apply damage');

    attacker.send({t:'shoot', p:[0,500,0], d:[0,0,1]});
    attacker.send({t:'hit', id:vw.id});
    await new Promise(resolve => setTimeout(resolve, 150));
    const afterShot = attacker.events.filter(m => m.t==='snap' && m.players && m.players[vw.id]).at(-1);
    assert.equal(afterShot.players[vw.id].hp, beforeHp-25,
      'a plausible recent shot should still damage the target');
    attacker.send({t:'leave'});
    victim.send({t:'leave'});
    await Promise.all([
      attacker.waitFor(m => m.t==='left' && m.ok===true),
      victim.waitFor(m => m.t==='left' && m.ok===true)
    ]);
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
      assert.fail('MAYDAY combat validation test failed. Logs: ' + getOutput());
    }
  }
});

test('unexpected disconnect can reconnect to the same room using the saved session token', async t => {
  const port = await reservePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mayday-reconnect-'));
  const {child, getOutput} = await startServer(port, dataDir, 5000);
  const clients = [];
  const url = 'ws://127.0.0.1:' + port;
  const connect = async () => {
    const client = makeClient(url);
    clients.push(client);
    await client.opened;
    return client;
  };

  try {
    const original = await connect();
    original.send({t:'host', mode:'ffa', n:'Reconnect Pilot', ty:'balanced'});
    const welcome = await original.waitFor(m => m.t==='welcome' && m.mode==='ffa');
    assert.ok(welcome.session, 'server should issue a session token');
    const code = welcome.code;

    const closed = new Promise(resolve => original.socket.once('close', resolve));
    original.socket.close(1001, 'temporary network loss');
    await closed;
    await new Promise(resolve => setTimeout(resolve, 100));

    const resumed = await connect();
    resumed.send({t:'reconnect', code, session:welcome.session});
    const resumedWelcome = await resumed.waitFor(m => m.t==='welcome' && m.resumed===true);
    assert.equal(resumedWelcome.code, code);
    assert.equal(resumedWelcome.id, welcome.id);
    const resumeState = await resumed.waitFor(m => m.t==='resume' && m.mode==='ffa');
    assert.equal(resumeState.state, 'lobby');
    await resumed.waitFor(m => m.t==='room' && m.code===code && m.players.some(p => p.id===welcome.id && p.connected!==false));

    resumed.send({t:'leave'});
    await resumed.waitFor(m => m.t==='left' && m.ok===true);
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
      assert.fail('MAYDAY reconnect test failed. Logs: ' + getOutput());
    }
  }
});

test('pilots who join the same queue three seconds apart enter the same match if it has not started', async t => {
  const port = await reservePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mayday-delayed-queue-'));
  const {child, getOutput} = await startServer(port, dataDir, 5000);
  const clients = [];
  const url = 'ws://127.0.0.1:' + port;
  const connect = async () => {
    const client = makeClient(url);
    clients.push(client);
    await client.opened;
    return client;
  };

  try {
    const first = await connect();
    first.send({t:'matchmake', mode:'ffa', n:'Vardhan', ty:'balanced'});
    const firstSearching = await first.waitFor(m => m.t==='matchmaking' && m.status==='searching' && m.mode==='ffa');
    assert.equal(firstSearching.players, 1);

    await new Promise(resolve => setTimeout(resolve, 3000));

    const second = await connect();
    second.send({t:'matchmake', mode:'ffa', n:'Anika', ty:'fighter'});
    const secondSearching = await second.waitFor(m => m.t==='matchmaking' && m.status==='searching' && m.mode==='ffa' && m.players===2);
    assert.equal(secondSearching.players, 2);

    const [matchedFirst, matchedSecond] = await Promise.all([
      first.waitFor(m => m.t==='matchmaking' && m.status==='matched' && m.mode==='ffa'),
      second.waitFor(m => m.t==='matchmaking' && m.status==='matched' && m.mode==='ffa')
    ]);
    assert.equal(matchedFirst.roomCode, matchedSecond.roomCode, 'both queued players should be assigned to the same room');
    assert.equal(matchedFirst.players, 8);
    assert.equal(matchedFirst.aiPlayers, 6);

    const [roomFirst, roomSecond] = await Promise.all([
      first.waitFor(m => m.t==='room' && m.mode==='ffa' && m.state==='playing'),
      second.waitFor(m => m.t==='room' && m.mode==='ffa' && m.state==='playing')
    ]);
    assert.equal(roomFirst.code, roomSecond.code);
    const humans = roomFirst.players.filter(p => !p.ai).map(p => p.n).sort();
    assert.deepEqual(humans, ['Anika','Vardhan']);
    first.send({t:'leave'});
    second.send({t:'leave'});
    await Promise.all([
      first.waitFor(m => m.t==='left' && m.ok===true),
      second.waitFor(m => m.t==='left' && m.ok===true)
    ]);
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
      assert.fail('MAYDAY server failed during delayed queue test. Logs: ' + getOutput());
    }
  }
});


test('queued pilots are never backfilled into a live match and instead start a fair new match', async t => {
  const port = await reservePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mayday-fair-queue-'));
  const {child, getOutput} = await startServer(port, dataDir, 12000);
  const clients = [];
  const url = 'ws://127.0.0.1:' + port;
  const connect = async name => {
    const client = makeClient(url);
    clients.push(client);
    await client.opened;
    return client;
  };

  try {
    const seed = await connect('Seed Pilot');
    seed.send({t:'matchmake', mode:'ffa', n:'Seed Pilot', ty:'balanced'});
    const seedMatched = await seed.waitFor(m => m.t==='matchmaking' && m.status==='matched' && m.mode==='ffa', 17000);
    const seedRoom = await seed.waitFor(m => m.t==='room' && m.mode==='ffa' && m.state==='playing');
    assert.equal(seedMatched.aiPlayers, 7);

    const first = await connect('Vardhan');
    first.send({t:'matchmake', mode:'ffa', n:'Vardhan', ty:'balanced'});
    await first.waitFor(m => m.t==='matchmaking' && m.status==='searching' && m.mode==='ffa' && m.players===1);
    await new Promise(resolve => setTimeout(resolve, 3000));

    const second = await connect('Anika');
    second.send({t:'matchmake', mode:'ffa', n:'Anika', ty:'fighter'});
    await second.waitFor(m => m.t==='matchmaking' && m.status==='searching' && m.mode==='ffa' && m.players===2);

    await new Promise(resolve => setTimeout(resolve, 1200));
    assert.equal(first.events.some(m => m.t==='matchmaking' && m.status==='matched'), false);
    assert.equal(second.events.some(m => m.t==='matchmaking' && m.status==='matched'), false);

    const [matchedFirst, matchedSecond] = await Promise.all([
      first.waitFor(m => m.t==='matchmaking' && m.status==='matched' && m.mode==='ffa', 15000),
      second.waitFor(m => m.t==='matchmaking' && m.status==='matched' && m.mode==='ffa', 15000)
    ]);
    assert.notEqual(matchedFirst.roomCode, seedRoom.code, 'new queue must receive a fresh match, not the live room');
    assert.equal(matchedFirst.roomCode, matchedSecond.roomCode, 'players waiting in the same queue should be grouped together');
    assert.equal(matchedFirst.backfill, undefined);
    assert.equal(matchedSecond.backfill, undefined);

    const freshRoom = await first.waitFor(m => m.t==='room' && m.mode==='ffa' && m.state==='playing' && m.code===matchedFirst.roomCode);
    assert.equal(freshRoom.players.filter(p => !p.ai).length, 2);
    assert.deepEqual(freshRoom.players.filter(p => !p.ai).map(p => p.n).sort(), ['Anika','Vardhan']);

    for (const client of [first, second, seed]) client.send({t:'leave'});
    await Promise.all([first, second, seed].map(client => client.waitFor(m => m.t==='left' && m.ok===true)));
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
      assert.fail('MAYDAY fair matchmaking test failed. Logs: ' + getOutput());
    }
  }
});

test('leaving cancels queued matchmaking and cleans up private rooms with host handoff', async t => {
  const port = await reservePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mayday-room-cleanup-'));
  const {child, getOutput} = await startServer(port, dataDir, 1500);
  const clients = [];
  const url = 'ws://127.0.0.1:' + port;
  const connect = async () => {
    const client = makeClient(url);
    clients.push(client);
    await client.opened;
    return client;
  };

  try {
    await t.test('explicit leave removes a player from matchmaking even if the socket stays open', async () => {
      const queued = await connect();
      queued.send({t:'matchmake', mode:'ffa', n:'Queue Leaver', ty:'balanced'});
      await queued.waitFor(m => m.t==='matchmaking' && m.status==='searching' && m.mode==='ffa');
      queued.send({t:'leave'});
      await queued.waitFor(m => m.t==='matchmaking' && m.status==='cancelled' && m.mode==='ffa');
      await queued.waitFor(m => m.t==='left' && m.ok===true);
      await new Promise(resolve => setTimeout(resolve, 1900));
      assert.equal(queued.events.some(m => m.t==='matchmaking' && m.status==='matched'), false,
        'a player who leaves must not be assigned to a match later');
      queued.close();
    });

    await t.test('host leave transfers the room and the final leave removes it from the public room list', async () => {
      const host = await connect();
      host.send({t:'host', mode:'ffa', n:'Cleanup Host', ty:'balanced'});
      const hostWelcome = await host.waitFor(m => m.t==='welcome' && m.mode==='ffa');
      const code = hostWelcome.code;

      const guest = await connect();
      guest.send({t:'join', roomId:code, code, n:'Cleanup Guest', ty:'fighter'});
      const guestWelcome = await guest.waitFor(m => m.t==='welcome' && m.code===code);
      await guest.waitFor(m => m.t==='room' && m.code===code && m.state==='lobby' && m.players.length===2);

      host.send({t:'leave'});
      await host.waitFor(m => m.t==='left' && m.ok===true);
      const handedOff = await guest.waitFor(m =>
        m.t==='room' && m.code===code && m.state==='lobby' &&
        m.host===guestWelcome.id && m.players.length===1);
      assert.equal(handedOff.players[0].id, guestWelcome.id,
        'the remaining player should still be in the room after host departure');

      guest.send({t:'leave'});
      await guest.waitFor(m => m.t==='left' && m.ok===true);
      const response = await fetch('http://127.0.0.1:' + port + '/api/games');
      assert.equal(response.status, 200);
      const {games} = await response.json();
      assert.equal(games.some(game => game.roomId===code), false,
        'the room should disappear from the public list when its last human leaves');
      host.close();
      guest.close();
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
      assert.fail('MAYDAY room cleanup test failed. Logs: ' + getOutput());
    }
  }
});
