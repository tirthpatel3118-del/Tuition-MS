let activeInstituteId: string | null = null;

export function setActiveInstituteId(instituteId: string | null) {
  activeInstituteId = instituteId;
}

export function getActiveInstituteId() {
  return activeInstituteId;
}

export function requireActiveInstituteId() {
  if (!activeInstituteId) throw new Error('Choose an institute before accessing its records.');
  return activeInstituteId;
}

