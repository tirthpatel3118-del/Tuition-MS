-- Create courses table
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_name TEXT NOT NULL,
    batch_name TEXT NOT NULL,
    duration_months INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create students table
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    roll_number TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    parent_name TEXT NOT NULL,
    parent_whatsapp TEXT NOT NULL,
    student_mobile TEXT NOT NULL,
    email TEXT,
    address TEXT,
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    admission_date DATE NOT NULL,
    course_fee NUMERIC(10, 2) NOT NULL,
    discount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL CHECK (status IN ('Active', 'Inactive', 'Completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create payments table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL,
    payment_mode TEXT NOT NULL,
    payment_date DATE NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create receipts table
CREATE TABLE receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    receipt_number TEXT NOT NULL UNIQUE,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create installments table
CREATE TABLE installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Pending', 'Paid', 'Overdue')),
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add indexes
CREATE INDEX idx_students_roll_number ON students(roll_number);
CREATE INDEX idx_students_full_name ON students(full_name);
CREATE INDEX idx_students_parent_whatsapp ON students(parent_whatsapp);
CREATE INDEX idx_payments_student_id ON payments(student_id);
CREATE INDEX idx_payments_payment_date ON payments(payment_date);
CREATE INDEX idx_receipts_receipt_number ON receipts(receipt_number);
CREATE INDEX idx_installments_student_id ON installments(student_id);
CREATE INDEX idx_installments_due_date ON installments(due_date);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE installments ENABLE ROW LEVEL SECURITY;

-- Keep RLS enabled with no policies until the final tenant authorization migration is applied.

-- Create view to calculate Total Paid and Remaining Fee dynamically
CREATE VIEW student_balances AS
SELECT
    s.id AS student_id,
    s.roll_number,
    s.full_name,
    s.course_fee,
    s.discount,
    (s.course_fee - s.discount) AS net_fee,
    COALESCE(SUM(p.amount), 0) AS total_paid,
    (s.course_fee - s.discount - COALESCE(SUM(p.amount), 0)) AS remaining_fee
FROM
    students s
LEFT JOIN
    payments p ON s.id = p.student_id
GROUP BY
    s.id, s.roll_number, s.full_name, s.course_fee, s.discount;

-- Create view to calculate Outstanding Students dynamically
CREATE VIEW outstanding_students AS
SELECT
    s.id AS student_id,
    s.roll_number,
    s.full_name,
    s.parent_name,
    s.parent_whatsapp,
    s.student_mobile,
    s.email,
    s.status,
    s.course_fee,
    s.discount,
    (s.course_fee - s.discount) AS net_fee,
    COALESCE(SUM(p.amount), 0) AS total_paid,
    (s.course_fee - s.discount - COALESCE(SUM(p.amount), 0)) AS remaining_fee
FROM
    students s
LEFT JOIN
    payments p ON s.id = p.student_id
WHERE
    s.status = 'Active'
GROUP BY
    s.id, s.roll_number, s.full_name, s.parent_name, s.parent_whatsapp, s.student_mobile, s.email, s.status, s.course_fee, s.discount
HAVING
    (s.course_fee - s.discount - COALESCE(SUM(p.amount), 0)) > 0;

-- Grant select permission on the views to authenticated users
GRANT SELECT ON student_balances TO authenticated;
GRANT SELECT ON outstanding_students TO authenticated;

-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

