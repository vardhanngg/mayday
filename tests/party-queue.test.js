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
    const messageIndex = events.push(message) - 1;
    for (let i = waiters.length - 1; i >= 0; i--) {
      const waiter = waiters[i];
      if (messageIndex < waiter.afterIndex || !waiter.predicate(message)) continue;
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
    waitFor(predicate, timeoutMs = 6000, afterIndex = 0) {
      const old = events.slice(afterIndex).find(predicate);
      if (old) return Promise.resolve(old);
      return new Promise((resolve, reject) => {
        const waiter = {predicate, resolve, reject, timer: null, afterIndex};
        waiter.timer = setTimeout(() => {
          const index = waiters.indexOf(waiter);
          if (index >= 0) waiters.splice(index, 1);
          reject(new Error('Timed out waiting for MAYDAY message. Events: ' +
            JSON.stringify(events.map(x => ({t:x.t,status:x.status,mode:x.mode,message:x.message})))));
        }, timeoutMs);
        waiters.push(waiter);
      });
    },
    send(value) { socket.send(JSON.stringify(value)); },
    close() { try { socket.terminate(); } catch {} }
  };
}

async function startServer(port, dataDir, matchmakingTimeoutMs = 5000, partyJoinTimeoutMs = 2500) {
  const child = spawn(process.execPath, [path.join(root, 'server.js')], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      MAYDAY_DATA_DIR: dataDir,
      MAYDAY_MATCHMAKING_TIMEOUT_MS: String(matchmakingTimeoutMs),
      MAYDAY_PARTY_JOIN_TIMEOUT_MS: String(partyJoinTimeoutMs)
    },
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

async function createParty(url, clients) {
  const leader = makeClient(url);
  clients.push(leader);
  await leader.opened;
  leader.send({t:'socialHello', name:'Queue Leader'});
  const leaderWelcome = await leader.waitFor(m => m.t==='socialWelcome');

  const member = makeClient(url);
  clients.push(member);
  await member.opened;
  member.send({t:'socialHello', name:'Queue Member'});
  const memberWelcome = await member.waitFor(m => m.t==='socialWelcome');

  leader.send({t:'socialPartyCreateCode'});
  const codeMessage = await leader.waitFor(m => m.t==='socialPartyCode' && m.code);
  member.send({t:'socialPartyJoinCode', code:codeMessage.code});
  const memberPartyState = await member.waitFor(m => m.t==='socialPartyState' && m.party && m.party.members.length===2);
  const leaderPartyState = await leader.waitFor(m => m.t==='socialPartyState' && m.party && m.party.members.length===2);

  return {
    leader,
    member,
    leaderWelcome,
    memberWelcome,
    partyId: memberPartyState.party.id,
    leaderParty: leaderPartyState.party,
    memberParty: memberPartyState.party
  };
}

async function withServer(t, run, matchmakingTimeoutMs = 5000, partyJoinTimeoutMs = 2500) {
  const port = await reservePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mayday-party-queue-'));
  let server;
  const clients = [];
  try {
    server = await startServer(port, dataDir, matchmakingTimeoutMs, partyJoinTimeoutMs);
    await run('ws://127.0.0.1:' + port, clients);
  } finally {
    for (const client of clients) client.close();
    if (server && server.child.exitCode === null) {
      server.child.kill('SIGTERM');
      await Promise.race([
        new Promise(resolve => server.child.once('exit', resolve)),
        new Promise(resolve => setTimeout(resolve, 2500))
      ]);
      if (server.child.exitCode === null) server.child.kill('SIGKILL');
    }
    fs.rmSync(dataDir, {recursive:true, force:true});
    if (server && server.child.exitCode !== 0 && server.child.exitCode !== null) {
      assert.fail('MAYDAY server failed during test cleanup. Logs: ' + server.getOutput());
    }
  }
}

test('leaving a party during search cancels every party queue entry', async t => {
  await withServer(t, async (url, clients) => {
    const party = await createParty(url, clients);
    party.leader.send({t:'socialPartyStart', mode:'survivor'});
    await Promise.all([
      party.leader.waitFor(m => m.t==='socialPartyQueueRequest' && m.mode==='survivor'),
      party.member.waitFor(m => m.t==='socialPartyQueueRequest' && m.mode==='survivor')
    ]);

    const leaderGame = makeClient(url);
    clients.push(leaderGame);
    await leaderGame.opened;
    leaderGame.send({
      t:'matchmake', mode:'survivor', partyId:party.partyId, n:'Queue Leader', ty:'balanced',
      profileId:party.leaderWelcome.profile.id, profileToken:party.leaderWelcome.profileToken
    });

    const memberGame = makeClient(url);
    clients.push(memberGame);
    await memberGame.opened;
    memberGame.send({
      t:'matchmake', mode:'survivor', partyId:party.partyId, n:'Queue Member', ty:'balanced',
      profileId:party.memberWelcome.profile.id, profileToken:party.memberWelcome.profileToken
    });

    await Promise.all([
      leaderGame.waitFor(m => m.t==='matchmaking' && m.status==='searching' && m.mode==='survivor'),
      memberGame.waitFor(m => m.t==='matchmaking' && m.status==='searching' && m.mode==='survivor')
    ]);

    // Starting a second search before cancelling the first must be rejected.
    party.leader.send({t:'socialPartyStart', mode:'survivor'});
    const duplicate = await party.leader.waitFor(m =>
      m.t==='socialActionResult' && m.ok===false && /already matchmaking/i.test(m.message||''));
    assert.match(duplicate.message, /already matchmaking/i);

    party.member.send({t:'socialPartyLeave'});
    await party.member.waitFor(m => m.t==='socialPartyState' && m.party===null);

    const [leaderCancelled, memberCancelled] = await Promise.all([
      leaderGame.waitFor(m => m.t==='matchmaking' && m.status==='cancelled' && m.mode==='survivor'),
      memberGame.waitFor(m => m.t==='matchmaking' && m.status==='cancelled' && m.mode==='survivor')
    ]);
    assert.match(leaderCancelled.message, /party membership changed/i);
    assert.match(memberCancelled.message, /party membership changed/i);
  });
});

test('a party cannot start a different mode while already matchmaking', async t => {
  await withServer(t, async (url, clients) => {
    const party = await createParty(url, clients);
    party.leader.send({t:'socialPartyStart', mode:'ffa'});
    await Promise.all([
      party.leader.waitFor(m => m.t==='socialPartyQueueRequest' && m.mode==='ffa'),
      party.member.waitFor(m => m.t==='socialPartyQueueRequest' && m.mode==='ffa')
    ]);

    party.leader.send({t:'socialPartyStart', mode:'clash'});
    const rejected = await party.leader.waitFor(m =>
      m.t==='socialActionResult' && m.ok===false && /already matchmaking/i.test(m.message||''));
    assert.match(rejected.message, /already matchmaking/i);

    assert.equal(party.leader.events.filter(m => m.t==='socialPartyQueueRequest' && m.mode==='clash').length, 0,
      'the second request must not tell party members to enter another mode');
    assert.equal(party.member.events.filter(m => m.t==='socialPartyQueueRequest' && m.mode==='clash').length, 0,
      'all members must stay out of a second queue');
  });
});


test('a party queue deadline cancels the search when one member never joins', async t => {
  await withServer(t, async (url, clients) => {
    const party = await createParty(url, clients);
    const stateAfterIndex = party.leader.events.length;
    party.leader.send({t:'socialPartyStart', mode:'survivor'});
    await Promise.all([
      party.leader.waitFor(m => m.t==='socialPartyQueueRequest' && m.mode==='survivor'),
      party.member.waitFor(m => m.t==='socialPartyQueueRequest' && m.mode==='survivor')
    ]);

    const leaderGame = makeClient(url);
    clients.push(leaderGame);
    await leaderGame.opened;
    leaderGame.send({
      t:'matchmake', mode:'survivor', partyId:party.partyId, n:'Queue Leader', ty:'balanced',
      profileId:party.leaderWelcome.profile.id, profileToken:party.leaderWelcome.profileToken
    });
    await leaderGame.waitFor(m => m.t==='matchmaking' && m.status==='searching' && m.mode==='survivor');

    const cancelled = await leaderGame.waitFor(m =>
      m.t==='matchmaking' && m.status==='cancelled' && m.mode==='survivor' &&
      /timed out because not every member joined/i.test(m.message||''), 5000);
    assert.match(cancelled.message, /not every member joined/i);

    const state = await party.leader.waitFor(m =>
      m.t==='socialPartyState' && m.party?.id===party.partyId && !m.party.mode, 6000, stateAfterIndex);
    assert.equal(state.party.mode, '', 'party state must reset after the incomplete search is cancelled');
  }, 5000, 1200);
});

test('disconnecting one queued pilot cancels the whole party search', async t => {
  await withServer(t, async (url, clients) => {
    const party = await createParty(url, clients);
    const stateAfterIndex = party.leader.events.length;
    party.leader.send({t:'socialPartyStart', mode:'survivor'});
    await Promise.all([
      party.leader.waitFor(m => m.t==='socialPartyQueueRequest' && m.mode==='survivor'),
      party.member.waitFor(m => m.t==='socialPartyQueueRequest' && m.mode==='survivor')
    ]);

    const leaderGame = makeClient(url);
    clients.push(leaderGame);
    await leaderGame.opened;
    leaderGame.send({
      t:'matchmake', mode:'survivor', partyId:party.partyId, n:'Queue Leader', ty:'balanced',
      profileId:party.leaderWelcome.profile.id, profileToken:party.leaderWelcome.profileToken
    });

    const memberGame = makeClient(url);
    clients.push(memberGame);
    await memberGame.opened;
    memberGame.send({
      t:'matchmake', mode:'survivor', partyId:party.partyId, n:'Queue Member', ty:'balanced',
      profileId:party.memberWelcome.profile.id, profileToken:party.memberWelcome.profileToken
    });

    await Promise.all([
      leaderGame.waitFor(m => m.t==='matchmaking' && m.status==='searching' && m.mode==='survivor'),
      memberGame.waitFor(m => m.t==='matchmaking' && m.status==='searching' && m.mode==='survivor')
    ]);
    memberGame.close();

    const cancelled = await leaderGame.waitFor(m =>
      m.t==='matchmaking' && m.status==='cancelled' && m.mode==='survivor' &&
      /party member disconnected during matchmaking/i.test(m.message||''));
    assert.match(cancelled.message, /party member disconnected/i);

    const state = await party.leader.waitFor(m =>
      m.t==='socialPartyState' && m.party?.id===party.partyId && !m.party.mode, 6000, stateAfterIndex);
    assert.equal(state.party.mode, '', 'disconnection must release the party search state');
  });
});

test('party matchmaking state resets after seating so the party can search again', async t => {
  await withServer(t, async (url, clients) => {
    const party = await createParty(url, clients);
    const stateAfterIndex = party.leader.events.length;
    party.leader.send({t:'socialPartyStart', mode:'survivor'});
    await Promise.all([
      party.leader.waitFor(m => m.t==='socialPartyQueueRequest' && m.mode==='survivor'),
      party.member.waitFor(m => m.t==='socialPartyQueueRequest' && m.mode==='survivor')
    ]);

    const leaderGame = makeClient(url);
    clients.push(leaderGame);
    await leaderGame.opened;
    leaderGame.send({
      t:'matchmake', mode:'survivor', partyId:party.partyId, n:'Queue Leader', ty:'balanced',
      profileId:party.leaderWelcome.profile.id, profileToken:party.leaderWelcome.profileToken
    });

    const memberGame = makeClient(url);
    clients.push(memberGame);
    await memberGame.opened;
    memberGame.send({
      t:'matchmake', mode:'survivor', partyId:party.partyId, n:'Queue Member', ty:'balanced',
      profileId:party.memberWelcome.profile.id, profileToken:party.memberWelcome.profileToken
    });

    await Promise.all([
      leaderGame.waitFor(m => m.t==='matchmaking' && m.status==='matched' && m.mode==='survivor'),
      memberGame.waitFor(m => m.t==='matchmaking' && m.status==='matched' && m.mode==='survivor')
    ]);
    const reset = await party.leader.waitFor(m =>
      m.t==='socialPartyState' && m.party?.id===party.partyId && !m.party.mode, 6000, stateAfterIndex);
    assert.equal(reset.party.mode, '', 'seating in a match must reset party.mode');

    party.leader.send({t:'socialPartyStart', mode:'ffa'});
    await Promise.all([
      party.leader.waitFor(m => m.t==='socialPartyQueueRequest' && m.mode==='ffa'),
      party.member.waitFor(m => m.t==='socialPartyQueueRequest' && m.mode==='ffa')
    ]);
  }, 500, 2500);
});
