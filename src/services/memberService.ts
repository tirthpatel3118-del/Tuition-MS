import { supabase } from '../lib/supabase';
import { requireActiveInstituteId } from '../lib/tenant';
import type { InstituteRole } from '../context/AuthContext';

export interface InstituteMember {
  userId: string;
  email: string;
  role: InstituteRole;
  createdAt: string;
}

export interface InstituteInvitation {
  id: string;
  email: string;
  role: InstituteRole;
  status: string;
  expiresAt: string;
  createdAt: string;
}

async function callRpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw error;
  return data as T;
}

export const listInstituteMembers = () =>
  callRpc<InstituteMember[]>('list_institute_members', { p_institute_id: requireActiveInstituteId() });

export const listInstituteInvitations = () =>
  callRpc<InstituteInvitation[]>('list_institute_invitations', { p_institute_id: requireActiveInstituteId() });

export const inviteInstituteMember = (email: string, role: InstituteRole) =>
  callRpc<{ status: string; invitation_id: string; raw_token: string }>('invite_institute_member', {
    p_institute_id: requireActiveInstituteId(), p_email: email.trim(), p_role: role,
  });

export const updateInstituteMemberRole = (userId: string, role: InstituteRole) =>
  callRpc<void>('update_member_role', {
    p_institute_id: requireActiveInstituteId(), p_target_user_id: userId, p_new_role: role,
  });

export const removeInstituteMember = (userId: string) =>
  callRpc<void>('remove_institute_member', {
    p_institute_id: requireActiveInstituteId(), p_target_user_id: userId,
  });

export const revokeInstituteInvitation = (invitationId: string) =>
  callRpc<void>('revoke_institute_invitation', {
    p_institute_id: requireActiveInstituteId(), p_invitation_id: invitationId,
  });

