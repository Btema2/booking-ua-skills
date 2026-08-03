/**
 * Ukrainian has three plural forms. The visible «N поверх» tag is spelled the way
 * the handoff spells it; only the text written for screen readers here needs to
 * be grammatical, which is why this lives next to the card rather than inside it.
 */
function pluralForm(count: number, one: string, few: string, many: string): string {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  if (lastDigit === 1 && lastTwoDigits !== 11) {
    return one;
  }
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return few;
  }
  return many;
}

export function peopleLabel(count: number): string {
  return `${count} ${pluralForm(count, 'особа', 'особи', 'осіб')}`;
}
