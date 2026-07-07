import { Payment } from '../types';

/**
 * Calculates the total amount paid by a student based on their payment records.
 */
export const calculateTotalPaid = (studentId: string, payments: Payment[]): number => {
  return payments
    .filter(p => p.student_id === studentId)
    .reduce((sum, p) => sum + p.amount, 0);
};

/**
 * Calculates the remaining balance fee for a student.
 */
export const calculateRemainingFee = (courseFee: number, discount: number, totalPaid: number): number => {
  const netFee = Math.max(0, courseFee - discount);
  return Math.max(0, netFee - totalPaid);
};
