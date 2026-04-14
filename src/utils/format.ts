// Format currency (XAF - CFA Franc BEAC, Congo Brazzaville)
export const formatCurrency = (amount: number): string => {
  return `${new Intl.NumberFormat('fr-CG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)} FCFA`;
};

// Format date
export const formatDate = (date: string | Date, locale = 'en'): string => {
  const d = new Date(date);
  return d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Format date relative
export const formatRelativeDate = (date: string | Date): string => {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatDate(date);
};

// Format phone number
export const formatPhone = (phone: string, countryCode = '242'): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length >= 9) {
    return `${countryCode} ${cleaned.slice(-9, -6)} ${cleaned.slice(-6, -3)} ${cleaned.slice(-3)}`;
  }
  return phone;
};

// Format percentage
export const formatPercentage = (value: number): string => {
  return `${Math.round(value * 100) / 100}%`;
};

// Get initials from name
export const getInitials = (firstName: string, lastName?: string): string => {
  const first = firstName?.charAt(0)?.toUpperCase() || '';
  const last = lastName?.charAt(0)?.toUpperCase() || '';
  return `${first}${last}`;
};

// Truncate text
export const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
};
