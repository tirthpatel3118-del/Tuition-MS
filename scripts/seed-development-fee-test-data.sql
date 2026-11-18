-- DEVELOPMENT ONLY. Synthetic fee workflow fixtures for Demo Institute Alpha.
-- Safe to re-run: fixed QA IDs and unique QA roll numbers make this idempotent.
-- Never run against production. All contacts/emails below are deliberately fictional.

begin;

insert into public.students
(id,institute_id,roll_number,full_name,parent_name,parent_whatsapp,student_mobile,email,address,course_id,admission_date,course_fee,discount,status)
values
('a4100000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','QA-FEE-OVERDUE','QA Overdue Student','QA Parent One','9000000001','9000000002','qa.overdue@example.test','Synthetic QA record','a2000000-0000-4000-8000-000000000001',current_date,12000,0,'Active'),
('a4100000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','QA-FEE-TODAY','QA Due Today Student','QA Parent Two','9000000003','9000000004','qa.today@example.test','Synthetic QA record','a2000000-0000-4000-8000-000000000001',current_date,12000,0,'Active'),
('a4100000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000001','QA-FEE-FUTURE','QA Upcoming Student','QA Parent Three','9000000005','9000000006','qa.future@example.test','Synthetic QA record','a2000000-0000-4000-8000-000000000001',current_date,12000,0,'Active'),
('a4100000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000001','QA-FEE-DIRECT','QA Direct Balance Student','QA Parent Four','9000000007','9000000008','qa.direct@example.test','Synthetic QA record','a2000000-0000-4000-8000-000000000001',current_date,9000,0,'Active'),
('a4100000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000001','QA-FEE-PARTIAL','QA Partial Payment Student','QA Parent Five','9000000009','9000000010','qa.partial@example.test','Synthetic QA record','a2000000-0000-4000-8000-000000000001',current_date,10000,0,'Active'),
('a4100000-0000-4000-8000-000000000006','a1000000-0000-4000-8000-000000000001','QA-FEE-PAID','QA Fully Paid Student','QA Parent Six','9000000011','9000000012','qa.paid@example.test','Synthetic QA record','a2000000-0000-4000-8000-000000000001',current_date,10000,0,'Active')
on conflict (id) do update set full_name=excluded.full_name,course_fee=excluded.course_fee,status=excluded.status;

insert into public.installments (id,institute_id,student_id,installment_number,due_date,amount,status,remarks)
values
('a5100000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a4100000-0000-4000-8000-000000000001',1,(now() at time zone 'Asia/Kolkata')::date - 2,4000,'Overdue','SYNTHETIC QA: two days late'),
('a5100000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','a4100000-0000-4000-8000-000000000002',1,(now() at time zone 'Asia/Kolkata')::date,6000,'Pending','SYNTHETIC QA: due today'),
('a5100000-0000-4000-8000-000000000003','a1000000-0000-4000-8000-000000000001','a4100000-0000-4000-8000-000000000003',1,(now() at time zone 'Asia/Kolkata')::date + 1,12000,'Pending','SYNTHETIC QA: upcoming tomorrow'),
('a5100000-0000-4000-8000-000000000004','a1000000-0000-4000-8000-000000000001','a4100000-0000-4000-8000-000000000005',1,(now() at time zone 'Asia/Kolkata')::date - 1,5000,'Partially_Paid','SYNTHETIC QA: partially paid, one day late'),
('a5100000-0000-4000-8000-000000000005','a1000000-0000-4000-8000-000000000001','a4100000-0000-4000-8000-000000000006',1,(now() at time zone 'Asia/Kolkata')::date - 3,10000,'Paid','SYNTHETIC QA: fully paid')
on conflict (id) do update set due_date=excluded.due_date,amount=excluded.amount,status=excluded.status,remarks=excluded.remarks;

insert into public.payments (id,institute_id,student_id,amount,payment_mode,payment_date,remarks,payment_type,idempotency_key)
values
('a6100000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001','a4100000-0000-4000-8000-000000000005',2000,'Cash',(now() at time zone 'Asia/Kolkata')::date,'SYNTHETIC QA PARTIAL PAYMENT','PAYMENT','qa-fee-partial-20261119'),
('a6100000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000001','a4100000-0000-4000-8000-000000000006',10000,'Cash',(now() at time zone 'Asia/Kolkata')::date,'SYNTHETIC QA FULL PAYMENT','PAYMENT','qa-fee-paid-20261119')
on conflict (id) do update set amount=excluded.amount,remarks=excluded.remarks;

insert into public.payment_allocations (institute_id,payment_id,installment_id,allocated_amount,allocation_type)
select 'a1000000-0000-4000-8000-000000000001', p.id, i.id, p.amount, 'CREDIT'
from public.payments p
join public.installments i on i.student_id=p.student_id and i.institute_id=p.institute_id
where p.id in ('a6100000-0000-4000-8000-000000000001','a6100000-0000-4000-8000-000000000002')
and not exists (
  select 1 from public.payment_allocations pa
  where pa.payment_id=p.id and pa.installment_id=i.id and pa.allocation_type='CREDIT'
);

commit;
