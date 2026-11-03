import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, RefreshCw, Shield, UserPlus, Users } from 'lucide-react';
import { useAuth, type InstituteRole } from '../context/AuthContext';
import {
  inviteInstituteMember, listInstituteInvitations, listInstituteMembers,
  removeInstituteMember, revokeInstituteInvitation, updateInstituteMemberRole,
  type InstituteInvitation, type InstituteMember,
} from '../services/memberService';

const roles: InstituteRole[] = ['owner', 'accountant', 'teacher'];

export function TeamSettings() {
  const { activeMembership, session } = useAuth();
  const [members, setMembers] = useState<InstituteMember[]>([]);
  const [invitations, setInvitations] = useState<InstituteInvitation[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InstituteRole>('teacher');
  const [inviteUrl, setInviteUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextMembers, nextInvitations] = await Promise.all([listInstituteMembers(), listInstituteInvitations()]);
      setMembers(nextMembers);
      setInvitations(nextInvitations);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load institute members.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh, activeMembership?.instituteId]);

  const runAction = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try { await action(); await refresh(); setNotice(success); }
    catch (actionError) { setError(actionError instanceof Error ? actionError.message : 'The request could not be completed.'); }
    finally { setBusy(false); }
  };

  const submitInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError(''); setNotice(''); setInviteUrl('');
    try {
      const invitation = await inviteInstituteMember(email, role);
      setInviteUrl(`${window.location.origin}/accept-invitation?token=${encodeURIComponent(invitation.raw_token)}`);
      setEmail('');
      await refresh();
      setNotice('Invitation created. Share the one-time link with the invited person.');
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Could not create the invitation.');
    } finally { setBusy(false); }
  };

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(inviteUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setError('Clipboard access was unavailable. Select and copy the invitation link.'); }
  };

  return (
    <section className="space-y-5" aria-labelledby="team-settings-title">
      <div className="flex items-start justify-between gap-3">
        <div><h2 id="team-settings-title" className="flex items-center gap-2 text-lg font-bold text-slate-900"><Users className="h-5 w-5 text-blue-600" />Team access</h2>
          <p className="mt-1 text-sm text-slate-500">Invite staff and control their access to this institute.</p></div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" aria-label="Refresh team list"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>

      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}

      <form onSubmit={submitInvite} className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800"><UserPlus className="h-4 w-4 text-blue-600" />Invite a team member</h3>
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto]">
          <label className="text-xs font-semibold text-slate-600">Email address<input type="email" required value={email} onChange={event => setEmail(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal" /></label>
          <label className="text-xs font-semibold text-slate-600">Access role<select value={role} onChange={event => setRole(event.target.value as InstituteRole)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal">{roles.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
          <button disabled={busy} className="self-end rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">Create invite</button>
        </div>
        {inviteUrl && <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3"><label className="text-xs font-semibold text-blue-900">One-time invitation link (expires in 7 days)<input readOnly value={inviteUrl} onFocus={event => event.currentTarget.select()} className="mt-1 block w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-normal text-slate-700" /></label><button type="button" onClick={() => void copyLink()} className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-blue-700">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy link'}</button></div>}
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3"><h3 className="flex items-center gap-2 text-sm font-bold text-slate-800"><Shield className="h-4 w-4 text-blue-600" />Current members</h3></div>
        {loading ? <p className="p-4 text-sm text-slate-500">Loading team…</p> : members.length === 0 ? <p className="p-4 text-sm text-slate-500">No members found.</p> : <ul className="divide-y divide-slate-100">{members.map(member => <li key={member.userId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-slate-800">{member.email || 'Account email unavailable'} {member.userId === session?.user.id && <span className="text-xs font-normal text-slate-500">(you)</span>}</p><p className="text-xs text-slate-500">Joined {new Date(member.createdAt).toLocaleDateString()}</p></div><div className="flex items-center gap-2"><label className="sr-only" htmlFor={`role-${member.userId}`}>Role for {member.email}</label><select id={`role-${member.userId}`} disabled={busy || member.userId === session?.user.id} value={member.role} onChange={event => void runAction(() => updateInstituteMemberRole(member.userId, event.target.value as InstituteRole), 'Member role updated.')} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs capitalize disabled:bg-slate-50">{roles.map(item => <option key={item} value={item}>{item}</option>)}</select>{member.userId !== session?.user.id && <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Remove ${member.email} from this institute?`)) void runAction(() => removeInstituteMember(member.userId), 'Member removed.'); }} className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Remove</button>}</div></li>)}</ul>}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3"><h3 className="text-sm font-bold text-slate-800">Pending invitations</h3></div>
        {loading ? <p className="p-4 text-sm text-slate-500">Loading invitations…</p> : invitations.filter(item => item.status === 'Pending').length === 0 ? <p className="p-4 text-sm text-slate-500">No pending invitations.</p> : <ul className="divide-y divide-slate-100">{invitations.filter(item => item.status === 'Pending').map(invite => <li key={invite.id} className="flex items-center justify-between gap-3 px-4 py-3"><div><p className="text-sm font-semibold text-slate-800">{invite.email}</p><p className="text-xs capitalize text-slate-500">{invite.role} · expires {new Date(invite.expiresAt).toLocaleDateString()}</p></div><button type="button" disabled={busy} onClick={() => void runAction(() => revokeInstituteInvitation(invite.id), 'Invitation revoked.')} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Revoke</button></li>)}</ul>}
      </div>
      <p className="text-xs leading-5 text-slate-500">Invitations are not emailed automatically. Send the generated link securely to the invited person. Owners should grant only the access needed for each role.</p>
    </section>
  );
}

