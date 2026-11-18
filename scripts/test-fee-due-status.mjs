import assert from 'node:assert/strict';
import { getFeeDueStatus, isActionableFeeDue } from '../src/utils/feeDueStatus.ts';

const today = new Date(2026, 10, 19, 12);
assert.deepEqual(getFeeDueStatus('2026-11-19', today), { status: 'due_today', daysLate: 0, label: 'Due today' });
assert.equal(getFeeDueStatus('2026-11-18', today).label, '1 day late');
assert.equal(getFeeDueStatus('2026-11-17', today).label, '2 days late');
assert.equal(getFeeDueStatus('2026-11-20', today).status, 'upcoming');
assert.equal(getFeeDueStatus(null, today).label, 'No due date');
assert.equal(isActionableFeeDue('2026-11-19', today), true);
assert.equal(isActionableFeeDue('2026-11-18', today), true);
assert.equal(isActionableFeeDue('2026-11-20', today), false);
assert.equal(isActionableFeeDue(null, today), true);
console.log('Fee due date classification tests passed.');
