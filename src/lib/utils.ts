import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ReportLike = {
  ownerUserId?: string;
  reporter?: string;
};

type AccountLike = {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
} | null;

const normalizeIdentity = (value: unknown) => String(value || '').trim().toLowerCase();

export function scopeReportsToAccount<T extends ReportLike>(reports: T[], user: AccountLike): T[] {
  if (!user?.id) {
    return [];
  }

  if (user.role === 'admin') {
    return reports;
  }

  const allowedIdentities = new Set([user.id, user.name, user.email].map(normalizeIdentity).filter(Boolean));

  return reports.filter((report) => {
    const ownerUserId = normalizeIdentity(report.ownerUserId);
    if (ownerUserId && allowedIdentities.has(ownerUserId)) {
      return true;
    }

    const reporter = normalizeIdentity(report.reporter);
    return reporter ? allowedIdentities.has(reporter) : false;
  });
}
