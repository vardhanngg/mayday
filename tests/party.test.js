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
      if (!waiters[i].predicate(message)) continue;
      clearTimeout(waiters[i].timer);
      const [w] = waiters.splice(i, 1);
      w.resolve(message);
    }
  });
  socket.on('error', () => {});
  const client = {
    socket,
    events,
    opened: new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); }),
    /** Wait for a message matching predicate that arrives AFTER this call (ignores history). */
    next(predicate, timeoutMs = 6000, label = 'message') {
      return new Promise((resolve, reject) => {
        const waiter = {predicate, resolve, timer: null};
        waiter.timer = setTimeout(() => {
          const i = waiters.indexOf(waiter);
          if (i >= 0) waiters.splice(i, 1);
          reject(new Error('Timed out waiting for ' + label + '. Recent: ' + JSON.stringify(events.slice(-8).map(x => ({t: x.t, status: x.status, mode: x.mode})))));
        }, timeoutMs);
        waiters.push(waiter);
      });
    },
    /** Wait for any matching message, including ones already received. */
    waitFor(predicate, timeoutMs = 6000, label = 'message') {
      const old = events.find(predicate);
      return old ? Promise.resolve(old) : client.next(predicate, timeoutMs, label);
    },
    send(value) { socket.send(JSON.stringify(value)); },
    close() { try { socket.terminate(); } catch {} }
  };
  return client;
}

async function startServer(port, dataDir, env = {}) {
  const child = spawn(process.execPath, [path.join(root, 'server.js')], {
    cwd: root,
    env: {...process.env, PORT: String(port), MAYDAY_DATA_DIR: dataDir, MAYDAY_MATCHMAKING_TIMEOUT_MS: '60000', ...env},
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server startup timed out: ' + output)), 10000);
    const inspect = chunk => {
      output += chunk.toString();
      if (output.includes('running!')) { clearTimeout(timer); resolve(); }
    };
    child.stdout.on('data', inspect);
    child.stderr.on('data', inspect);
    child.once('exit', code => { clearTimeout(timer); reject(new Error('server exited (' + code + '): ' + output)); });
  });
  return {child, getOutput: () => output};
}

const lastParty = c => [...c.events].reverse().find(m => m.t === 'socialPartyState');
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Boots a server plus helpers to create signed-in pilots, friendships, and queue clients. */
async function harness(t, env) {
  const port = await reservePort();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mayday-party-'));
  const server = await startServer(port, dataDir, env);
  const url = 'ws://127.0.0.1:' + port;
  const clients = [];
  t.after(() => { clients.forEach(c => c.close()); server.child.kill(); fs.rmSync(dataDir, {recursive: true, force: true}); });

  const open = async () => { const c = makeClient(url); clients.push(c); await c.opened; return c; };
  const pilot = async name => {
    const social = await open();
    social.send({t: 'socialHello', name});
    const welcome = await social.waitFor(m => m.t === 'socialWelcome');
    return {name, social, id: welcome.profile.id, code: welcome.profile.code, token: welcome.profileToken};
  };
  const befriend = async (a, b) => {
    a.social.send({t: 'socialAddFriend', code: b.code});
    await a.social.waitFor(m => m.t === 'socialActionResult' && m.ok);
    const done = b.social.next(m => m.t === 'socialActionResult' && /accepted/i.test(m.message || ''), 4000, 'friend accept');
    b.social.send({t: 'socialAddFriend', code: a.code});
    await done;
  };
  const party = async (leader, ...members) => {
    for (const m of members) {
      const inviteSeen = m.social.next(x => x.t === 'socialPartyInvite', 4000, 'party invite delivery');
      leader.social.send({t: 'socialPartyInvite', friendId: m.id});
      const inv = await inviteSeen;
      m.social.send({t: 'socialPartyInviteResponse', inviteId: inv.inviteId, accept: true});
      await m.social.next(x => x.t === 'socialPartyState' && x.party && x.party.members.some(y => y.id === m.id), 4000, 'party roster on member');
    }
    await sleep(100);
  };
  /** What the real client does on socialPartyQueueRequest: open a game socket and matchmake. */
  const queue = async (p, mode, partyId) => {
    const game = await open();
    game.send({t: 'matchmake', mode, n: p.name, ty: 'balanced', partyId, profileId: p.id, profileToken: p.token});
    return game;
  };
  const startQueue = async (leader, members, mode) => {
    const requests = [leader, ...members].map(p => p.social.next(m => m.t === 'socialPartyQueueRequest', 4000, 'queue request for ' + p.name));
    leader.social.send({t: 'socialPartyStart', mode});
    const reqs = await Promise.all(requests);
    return Promise.all([leader, ...members].map((p, i) => queue(p, mode, reqs[i].partyId)));
  };
  return {open, pilot, befriend, party, queue, startQueue, server};
}

test('direct friend invite: send, receive, accept and both rosters agree', async t => {
  const h = await harness(t);
  const [a, b] = [await h.pilot('Alpha'), await h.pilot('Bravo')];
  await h.befriend(a, b);
  await h.party(a, b);
  for (const p of [a, b]) {
    const state = lastParty(p.social).party;
    assert.deepEqual(state.members.map(x => x.id).sort(), [a.id, b.id].sort());
    assert.equal(state.leaderId, a.id);
  }
});

test('direct friend invite: rejecting leaves no stale membership and the friend can be re-invited', async t => {
  const h = await harness(t);
  const [a, b] = [await h.pilot('Alpha'), await h.pilot('Bravo')];
  await h.befriend(a, b);
  const seen = b.social.next(m => m.t === 'socialPartyInvite');
  a.social.send({t: 'socialPartyInvite', friendId: b.id});
  const inv = await seen;
  b.social.send({t: 'socialPartyInviteResponse', inviteId: inv.inviteId, accept: false});
  await a.social.waitFor(m => m.t === 'socialInviteResult');
  b.social.send({t: 'socialPartyGet'});
  await sleep(150);
  assert.equal(lastParty(b.social).party, null, 'declined pilot must not be in any party');
  await h.party(a, b); // re-invite works
  assert.equal(lastParty(b.social).party.members.length, 2);
});

test('refreshing a pilot (new social socket) restores the same authoritative roster', async t => {
  const h = await harness(t);
  const [a, b] = [await h.pilot('Alpha'), await h.pilot('Bravo')];
  await h.befriend(a, b);
  await h.party(a, b);
  const fresh = await h.open();
  fresh.send({t: 'socialHello', name: 'Bravo', profileId: b.id, profileToken: b.token});
  const state = await fresh.waitFor(m => m.t === 'socialPartyState');
  assert.equal(state.party.members.length, 2);
  assert.equal(state.party.leaderId, a.id);
});

test('leader cancel stops matchmaking for every party member and resets the party mode', async t => {
  const h = await harness(t);
  const [a, b] = [await h.pilot('Alpha'), await h.pilot('Bravo')];
  await h.befriend(a, b);
  await h.party(a, b);
  const [ga, gb] = await h.startQueue(a, [b], 'ffa');
  await ga.waitFor(m => m.t === 'matchmaking' && m.status === 'searching');
  await gb.waitFor(m => m.t === 'matchmaking' && m.status === 'searching');
  const cancelA = ga.next(m => m.t === 'matchmaking' && m.status === 'cancelled');
  const cancelB = gb.next(m => m.t === 'matchmaking' && m.status === 'cancelled');
  const bTold = b.social.next(m => m.t === 'socialPartyQueueCancelRequest');
  a.social.send({t: 'socialPartyCancel'});
  await Promise.all([cancelA, cancelB, bTold]);
  await sleep(100);
  assert.equal(lastParty(a.social).party.mode, '');
  assert.equal(lastParty(b.social).party.mode, '');
});

test('a member cancelling their own search also cancels the leader and the rest of the party', async t => {
  const h = await harness(t);
  const [a, b] = [await h.pilot('Alpha'), await h.pilot('Bravo')];
  await h.befriend(a, b);
  await h.party(a, b);
  const [ga, gb] = await h.startQueue(a, [b], 'survivor');
  await ga.waitFor(m => m.t === 'matchmaking' && m.status === 'searching');
  await gb.waitFor(m => m.t === 'matchmaking' && m.status === 'searching');
  const leaderCancelled = ga.next(m => m.t === 'matchmaking' && m.status === 'cancelled');
  gb.send({t: 'matchmakeCancel', mode: 'survivor'});
  await leaderCancelled;
});

test('a member leaving the party while queued cancels the queue and dissolves a two-pilot party', async t => {
  const h = await harness(t);
  const [a, b] = [await h.pilot('Alpha'), await h.pilot('Bravo')];
  await h.befriend(a, b);
  await h.party(a, b);
  const [ga] = await h.startQueue(a, [b], 'ffa');
  await ga.waitFor(m => m.t === 'matchmaking' && m.status === 'searching');
  const cancelled = ga.next(m => m.t === 'matchmaking' && m.status === 'cancelled');
  b.social.send({t: 'socialPartyLeave'});
  await cancelled;
  a.social.send({t: 'socialPartyGet'});
  await sleep(150);
  assert.equal(lastParty(a.social).party, null, 'leader must not be left in a one-person party');
  assert.equal(lastParty(b.social).party, null);
});

test('a party member losing their game connection mid-search cancels the whole party search', async t => {
  const h = await harness(t);
  const [a, b] = [await h.pilot('Alpha'), await h.pilot('Bravo')];
  await h.befriend(a, b);
  await h.party(a, b);
  const [ga, gb] = await h.startQueue(a, [b], 'ffa');
  await ga.waitFor(m => m.t === 'matchmaking' && m.status === 'searching');
  await gb.waitFor(m => m.t === 'matchmaking' && m.status === 'searching');
  const cancelled = ga.next(m => m.t === 'matchmaking' && m.status === 'cancelled');
  gb.close();
  await cancelled;
});

test('a party member who never joins the queue does not leave the others stuck searching', async t => {
  const h = await harness(t, {MAYDAY_PARTY_JOIN_MS: '700'});
  const [a, b] = [await h.pilot('Alpha'), await h.pilot('Bravo')];
  await h.befriend(a, b);
  await h.party(a, b);
  const reqs = a.social.next(m => m.t === 'socialPartyQueueRequest');
  a.social.send({t: 'socialPartyStart', mode: 'ffa'});
  const req = await reqs;
  const ga = await h.queue(a, 'ffa', req.partyId); // leader queues, Bravo's client never does
  await ga.waitFor(m => m.t === 'matchmaking' && m.status === 'searching');
  await ga.next(m => m.t === 'matchmaking' && m.status === 'cancelled', 4000, 'stuck-queue cancellation');
});

test('a disconnected member is dropped from the party after the grace period; no stale-membership errors on re-invite', async t => {
  const h = await harness(t, {MAYDAY_PARTY_GRACE_MS: '500'});
  const [a, b] = [await h.pilot('Alpha'), await h.pilot('Bravo')];
  await h.befriend(a, b);
  await h.party(a, b);
  b.social.close();
  const gone = a.social.next(m => m.t === 'socialPartyState' && (m.party === null || m.party.members.length < 2), 4000, 'roster update after disconnect');
  await gone;
  const b2 = await h.open();
  b2.send({t: 'socialHello', name: 'Bravo', profileId: b.id, profileToken: b.token});
  const welcomeState = await b2.waitFor(m => m.t === 'socialPartyState');
  assert.equal(welcomeState.party, null, 'returning pilot must not be shown a party they no longer belong to');
  b.social = b2;
  await h.party(a, b);
  assert.equal(lastParty(a.social).party.members.length, 2);
});

test('a brief reconnect inside the grace period keeps the pilot in the party', async t => {
  const h = await harness(t, {MAYDAY_PARTY_GRACE_MS: '3000'});
  const [a, b] = [await h.pilot('Alpha'), await h.pilot('Bravo')];
  await h.befriend(a, b);
  await h.party(a, b);
  b.social.close();
  await sleep(300);
  const b2 = await h.open();
  b2.send({t: 'socialHello', name: 'Bravo', profileId: b.id, profileToken: b.token});
  const state = await b2.waitFor(m => m.t === 'socialPartyState');
  assert.equal(state.party.members.length, 2);
  await sleep(3400);
  a.social.send({t: 'socialPartyGet'});
  await sleep(150);
  assert.equal(lastParty(a.social).party.members.length, 2, 'grace timer must be cleared on reconnect');
});

test('Clash Squad keeps a party on one team; Dogfight and Survivor parties share a match', async t => {
  const h = await harness(t, {MAYDAY_MATCHMAKING_TIMEOUT_MS: '800'});
  const [a, b] = [await h.pilot('Alpha'), await h.pilot('Bravo')];
  await h.befriend(a, b);
  await h.party(a, b);
  for (const mode of ['clash', 'ffa', 'survivor']) {
    const [ga, gb] = await h.startQueue(a, [b], mode);
    const [ma, mb] = await Promise.all([
      ga.waitFor(m => m.t === 'matchmaking' && m.status === 'matched', 8000, mode + ' match for leader'),
      gb.waitFor(m => m.t === 'matchmaking' && m.status === 'matched', 8000, mode + ' match for member')
    ]);
    assert.equal(ma.roomCode, mb.roomCode, mode + ': party members must be seated in the same room');
    const room = await ga.waitFor(m => m.t === 'room' && m.mode === mode && m.players && m.players.filter(p => !p.ai).length === 2, 8000, mode + ' room');
    const humans = room.players.filter(p => !p.ai);
    if (mode === 'clash') {
      assert.equal(humans[0].team, humans[1].team, 'party members must be teammates in Clash Squad');
      assert.equal(new Set(room.players.map(p => p.team)).size, 2, 'public Clash Squad has exactly two squads');
    }
    // After the match starts the party must be free to queue again with a clean mode.
    await sleep(100);
    a.social.send({t: 'socialPartyGet'});
    await sleep(150);
    assert.equal(lastParty(a.social).party.mode, '', mode + ': party mode must reset once matched');
    ga.send({t: 'leave'}); gb.send({t: 'leave'});
    await sleep(300);
  }
});
