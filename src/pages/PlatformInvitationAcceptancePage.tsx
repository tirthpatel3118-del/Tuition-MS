import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AuthFrame } from "./AuthPages";
import { useAuth } from "../context/AuthContext";

export function PlatformInvitationAcceptancePage() {
  const { session, email, updatePassword, acceptPlatformInvitation, signOut } = useAuth();
  const navigate = useNavigate();
  const [token] = useState(() => {
    const url = new URL(window.location.href);
    const value = url.searchParams.get("token") ?? "";
    if (value) {
      url.searchParams.delete("token");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
    return value;
  });
  const [requiresPasswordSetup] = useState(() => new URLSearchParams(window.location.search).get("setup") === "1");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!session) {
      setError("This invitation is not signed in. Open the one-time link again in the same browser.");
      return;
    }
    if (!token) {
      setError("The invitation token is missing. Ask the EduLedger administrator for a new invitation.");
      return;
    }
    if (requiresPasswordSetup && password.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }
    if (requiresPasswordSetup && password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      if (requiresPasswordSetup) await updatePassword(password);
      await acceptPlatformInvitation(token);
      navigate("/", { replace: true });
    } catch (value) {
      setError(value instanceof Error ? value.message : "The invitation could not be accepted.");
    } finally {
      setBusy(false);
    }
  };

  if (!session) {
    return <AuthFrame title="Invitation sign-in required" description="Open the secure invitation link again and complete the email verification flow.">
      <p role="alert" className="rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-900">No active sign-in session was found. The link may have expired or already been used.</p>
    </AuthFrame>;
  }

  return <AuthFrame title="Activate your EduLedger access" description={"Invitation for " + (email ?? "your account") + ". The invitation email must match the signed-in account."}>
    <form onSubmit={submit} className="space-y-4">
      {requiresPasswordSetup && <>
        <label className="block text-sm font-semibold text-slate-700">
          Create password
          <input required minLength={8} type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 font-normal outline-none focus:border-[#A03B5E] focus:ring-4 focus:ring-[#F8E9ED]" />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Confirm password
          <input required minLength={8} type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-3 font-normal outline-none focus:border-[#A03B5E] focus:ring-4 focus:ring-[#F8E9ED]" />
        </label>
      </>}
      <p className="text-xs leading-5 text-slate-500">{requiresPasswordSetup ? "After activation, you will sign in using this email and password." : "This account already exists. Accepting the invitation adds the requested institute access."}</p>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy || !token} className="w-full rounded-xl bg-[#6B1F38] px-4 py-3 text-sm font-semibold text-white hover:bg-[#57172D] disabled:opacity-60">
        {busy ? "Activating…" : "Accept invitation"}
      </button>
    </form>
    <button onClick={() => void signOut()} className="mt-5 w-full py-2 text-sm font-semibold text-slate-500 hover:text-slate-800">Sign out</button>
  </AuthFrame>;
}
