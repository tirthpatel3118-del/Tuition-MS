import assert from 'node:assert/strict';

function getFeeDueStatus(dueDate, now) {
  if (!dueDate) return { status: 'unscheduled', daysLate: 0, label: 'No due date' };
  const key = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const today = key(now);
  if (dueDate > today) return { status: 'upcoming', daysLate: 0, label: 'Upcoming' };
  if (dueDate === today) return { status: 'due_today', daysLate: 0, label: 'Due today' };
  const [y,m,d] = dueDate.split('-').map(Number);
  const due = new Date(y,m-1,d);
  const current = new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const daysLate = Math.max(1,Math.round((current-due)/86400000));
  return { status: 'overdue', daysLate, label: `${daysLate} day${daysLate===1?'':'s'} late` };
}
function allocateDues(studentDue, installments, paidByInstallment) {
  let remaining = studentDue;
  const rows = [];
  for (const item of [...installments].sort((a,b)=>a.number-b.number)) {
    if (remaining <= 0) break;
    const balance = Math.min(Math.max(0,item.amount-(paidByInstallment[item.id]||0)),remaining);
    if (!balance) continue;
    rows.push({ id:item.id, amount:balance, ...getFeeDueStatus(item.dueDate, new Date(2026,10,19,12)) });
    remaining -= balance;
  }
  if (remaining > 0) rows.push({ id:'direct-student', amount:remaining, ...getFeeDueStatus(null,new Date(2026,10,19,12)) });
  return rows;
}

const today = new Date(2026,10,19,12);
assert.equal(getFeeDueStatus('2026-11-19',today).label,'Due today');
assert.equal(getFeeDueStatus('2026-11-18',today).label,'1 day late');
assert.equal(getFeeDueStatus('2026-11-17',today).label,'2 days late');
assert.equal(getFeeDueStatus('2026-11-20',today).status,'upcoming');
assert.equal(getFeeDueStatus(null,today).label,'No due date');

const scenarios = [
  { name:'overdue', due:6000, installments:[{id:'old',number:1,amount:6000,dueDate:'2026-11-17'}], paid:{} },
  { name:'due today', due:5000, installments:[{id:'today',number:1,amount:5000,dueDate:'2026-11-19'}], paid:{} },
  { name:'future hidden', due:4000, installments:[{id:'future',number:1,amount:4000,dueDate:'2026-11-20'}], paid:{} },
  { name:'partial payment', due:3000, installments:[{id:'partial',number:1,amount:5000,dueDate:'2026-11-18'}], paid:{partial:2000} },
  { name:'fully paid installment with direct balance', due:2000, installments:[{id:'paid',number:1,amount:5000,dueDate:'2026-11-18'}], paid:{paid:5000} },
  { name:'no installment schedule', due:7000, installments:[], paid:{} },
];
const [overdue,todayDue,future,partial,paid,direct] = scenarios.map(s=>allocateDues(s.due,s.installments,s.paid));
assert.equal(overdue[0].label,'2 days late');
assert.equal(todayDue[0].label,'Due today');
assert.equal(future[0].status,'upcoming');
assert.equal(partial[0].amount,3000);
assert.equal(partial[0].label,'1 day late');
assert.deepEqual(paid.map(x=>x.id),['direct-student']);
assert.equal(direct[0].amount,7000);
assert.equal(direct[0].label,'No due date');
assert.equal(overdue.reduce((sum,row)=>sum+row.amount,0),6000);
assert.equal(todayDue.reduce((sum,row)=>sum+row.amount,0),5000);
assert.equal(future.reduce((sum,row)=>sum+row.amount,0),4000);
assert.equal(partial.reduce((sum,row)=>sum+row.amount,0),3000);
assert.equal(paid.reduce((sum,row)=>sum+row.amount,0),2000);
assert.equal(direct.reduce((sum,row)=>sum+row.amount,0),7000);
const defaultFollowUp = [...overdue, ...todayDue, ...future, ...direct]
  .filter(row => row.status !== 'upcoming');
assert.ok(defaultFollowUp.some(row => row.label === 'Due today'));
assert.ok(defaultFollowUp.some(row => row.label === '2 days late'));
assert.ok(defaultFollowUp.some(row => row.label === 'No due date'));
assert.ok(!defaultFollowUp.some(row => row.status === 'upcoming'));
console.log('Fee due workflow tests passed: overdue, due today, future, partial payment, fully paid allocation, and unscheduled direct balances.');
