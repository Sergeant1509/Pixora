export function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
}

export function timeAgo(value) {
  const date = toDate(value);
  if (!date || Number.isNaN(date.getTime())) return 'just now';

  const seconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60]
  ];

  for (const [unit, valueInSeconds] of units) {
    const count = Math.floor(seconds / valueInSeconds);
    if (count >= 1) return `${count} ${unit}${count > 1 ? 's' : ''} ago`;
  }

  return 'just now';
}
