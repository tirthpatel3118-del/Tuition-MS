import assert from 'node:assert/strict';

// Test simulation of EduLedger Auth Lifecycle and Tab-Switching Behavior
console.log('Testing EduLedger ERP Auth Lifecycle & Tab-Switching...');

// Simulated state machine matching src/context/AuthContext.tsx
class MockAuthProvider {
  constructor() {
    this.status = 'loading';
    this.session = null;
    this.verifiedUserId = null;
    this.memberships = [];
    this.activeInstituteId = null;
    this.error = null;

    this.statusRef = this.status;
    this.sessionRef = this.session;
    this.verifiedUserIdRef = this.verifiedUserId;

    this.bootstrapSeq = 0;
    this.membershipRequestId = 0;
    this.statusTransitions = [];
  }

  setStatus(next) {
    this.statusRef = next;
    this.status = next;
    this.statusTransitions.push(next);
  }

  setSession(s) {
    this.sessionRef = s;
    this.session = s;
  }

  setVerifiedUserId(id) {
    this.verifiedUserIdRef = id;
    this.verifiedUserId = id;
  }

  async runBootstrap(targetSession, mockBackend) {
    const seq = ++this.bootstrapSeq;
    this.setStatus('verifying');
    this.error = null;

    try {
      const claims = await mockBackend.getClaims(targetSession.access_token);
      if (seq !== this.bootstrapSeq) return;

      if (!claims?.sub) {
        this.error = 'Your sign-in could not be verified. Please sign in again.';
        this.setStatus('error');
        return;
      }

      this.setVerifiedUserId(String(claims.sub));
      this.setStatus('loading-memberships');

      const rows = await mockBackend.getMemberships(claims.sub);
      if (seq !== this.bootstrapSeq) return;

      this.memberships = rows.map(r => ({
        instituteId: r.institute_id,
        instituteName: r.institute_name,
        role: r.role,
      }));

      if (this.memberships.length === 1) {
        this.activeInstituteId = this.memberships[0].instituteId;
      }
      this.setStatus('ready');
      this.error = null;
    } catch (err) {
      if (seq !== this.bootstrapSeq) return;
      this.error = err.message;
      this.setStatus('error');
    }
  }

  handleAuthStateChange(event, nextSession, mockBackend) {
    if (!nextSession) {
      this.bootstrapSeq += 1;
      this.membershipRequestId += 1;
      this.setSession(null);
      this.setVerifiedUserId(null);
      this.memberships = [];
      this.activeInstituteId = null;
      this.setStatus('signed-out');
      return;
    }

    const currentStatus = this.statusRef;
    const currentVerifiedUserId = this.verifiedUserIdRef;
    const nextUserId = nextSession.user.id;

    // The fix: if already in 'ready' and same user, update session silently without regressing status
    if (currentStatus === 'ready' && currentVerifiedUserId === nextUserId) {
      this.setSession(nextSession);
      return;
    }

    // In-flight guard
    if ((currentStatus === 'verifying' || currentStatus === 'loading-memberships') && currentVerifiedUserId === nextUserId) {
      this.setSession(nextSession);
      return;
    }

    this.setSession(nextSession);
    return this.runBootstrap(nextSession, mockBackend);
  }

  handleVisibilityOrFocus(visibilityState, mockBackend) {
    if (visibilityState !== 'visible') return;

    // The fix: if already in 'ready', 'signed-out', or 'demo', do NOT re-run bootstrap or getSession
    const currentStatus = this.statusRef;
    if (currentStatus === 'ready' || currentStatus === 'signed-out' || currentStatus === 'demo') {
      return 'noop';
    }

    // Only restore if suspended during loading
    return 'restore';
  }
}

// Mock backend
const mockBackend = {
  getClaims: async (token) => {
    if (token === 'valid_token' || token === 'refreshed_token') {
      return { sub: 'user_123', email: 'owner@abc.edu' };
    }
    throw new Error('Invalid token');
  },
  getMemberships: async (sub) => {
    if (sub === 'user_123') {
      return [{ institute_id: 'inst_abc', institute_name: 'ABC Tuition Classes', role: 'owner' }];
    }
    return [];
  }
};

async function runTests() {
  console.log('\nTest 1: Initial user sign-in and bootstrap');
  const auth = new MockAuthProvider();
  assert.equal(auth.status, 'loading');

  const initialSession = {
    access_token: 'valid_token',
    user: { id: 'user_123', email: 'owner@abc.edu' }
  };

  await auth.handleAuthStateChange('SIGNED_IN', initialSession, mockBackend);
  assert.equal(auth.status, 'ready');
  assert.equal(auth.verifiedUserId, 'user_123');
  assert.equal(auth.activeInstituteId, 'inst_abc');
  assert.deepEqual(auth.statusTransitions, ['verifying', 'loading-memberships', 'ready']);
  console.log('✓ Initial sign-in successfully bootstrapped from loading -> verifying -> loading-memberships -> ready');

  console.log('\nTest 2: Tab switch simulation (user switches to ChatGPT tab)');
  // User switches away to ChatGPT tab
  const hiddenResult = auth.handleVisibilityOrFocus('hidden', mockBackend);
  assert.equal(hiddenResult, undefined);
  assert.equal(auth.status, 'ready');
  console.log('✓ Hidden visibility change causes no state changes');

  console.log('\nTest 3: Returning from ChatGPT tab (visibilitychange -> visible and window focus)');
  // User switches back to EduLedger tab
  const visibleResult = auth.handleVisibilityOrFocus('visible', mockBackend);
  assert.equal(visibleResult, 'noop');
  assert.equal(auth.status, 'ready');
  console.log('✓ Returning to visible tab does NOT interrupt active workspace');

  console.log('\nTest 4: Background token refresh (TOKEN_REFRESHED) while in ready state');
  const refreshedSession = {
    access_token: 'refreshed_token',
    user: { id: 'user_123', email: 'owner@abc.edu' }
  };
  const prevTransitionsCount = auth.statusTransitions.length;

  auth.handleAuthStateChange('TOKEN_REFRESHED', refreshedSession, mockBackend);

  // Status must remain 'ready', NO new transitions to 'verifying' or 'loading-memberships'
  assert.equal(auth.status, 'ready');
  assert.equal(auth.statusTransitions.length, prevTransitionsCount);
  assert.equal(auth.session.access_token, 'refreshed_token');
  console.log('✓ TOKEN_REFRESHED cleanly updates token in background without resetting status to verifying or loading-memberships');

  console.log('\nTest 5: Resumed bootstrap if tab was suspended mid-load');
  const interruptedAuth = new MockAuthProvider();
  interruptedAuth.setStatus('loading');
  const restoreAction = interruptedAuth.handleVisibilityOrFocus('visible', mockBackend);
  assert.equal(restoreAction, 'restore');
  console.log('✓ Interrupted bootstrap safely triggers session restoration');

  console.log('\nTest 6: User sign-out transition');
  auth.handleAuthStateChange('SIGNED_OUT', null, mockBackend);
  assert.equal(auth.status, 'signed-out');
  assert.equal(auth.session, null);
  assert.equal(auth.verifiedUserId, null);
  assert.equal(auth.activeInstituteId, null);
  console.log('✓ User sign-out cleanly resets state to signed-out');

  console.log('\n======================================================');
  console.log('ALL AUTH LIFECYCLE AND TAB-SWITCH TESTS PASSED (6/6)!');
  console.log('======================================================');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
