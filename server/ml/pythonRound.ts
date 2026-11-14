/**
 * Reproduces Python's built-in `round(value, digits)` for doubles.
 *
 * CPython rounds the exact binary value of the double, half-to-even, using its
 * correctly-rounded decimal conversion. A naïve `Math.round(v * 10**d) / 10**d`
 * differs in two ways:
 *   1. scaling by a power of ten introduces its own rounding error, which can create
 *      false ties (e.g. `16.050000000000000711` scales to exactly `160.5`), and
 *   2. ties must go to even, not away from zero.
 *
 * The implementation below reads a 20-digit-oversampled exact decimal expansion
 * (a double resolves to at most 17 significant digits, so 20 extra digits are ample
 * to decide any tie) and rounds the decimal string directly.
 */
export function pyRound(value: number, digits: number): number {
  if (!Number.isFinite(value)) return value;

  const negative = value < 0;
  const scaledMagnitude = Math.abs(value);
  // toFixed is specified to round the *exact* binary value correctly.
  const withTail = scaledMagnitude.toFixed(Math.min(100, digits + 20));
  const [intPart, fracPart = ''] = withTail.split('.');
  const kept = fracPart.slice(0, digits).padEnd(digits, '0');
  const rest = fracPart.slice(digits);

  const digitsArray = `${intPart}${kept}`.split('').map(Number);
  const restDigits = rest.split('').map(Number);

  let roundUp: boolean;
  if (restDigits.length === 0) {
    roundUp = false;
  } else if (restDigits[0] > 5) {
    roundUp = true;
  } else if (restDigits[0] === 5) {
    const tailIsZero = restDigits.slice(1).every((digit) => digit === 0);
    if (!tailIsZero) {
      roundUp = true; // strictly above the halfway point
    } else {
      // Exact tie → round half to even.
      const lastKept = digitsArray[digitsArray.length - 1] ?? 0;
      roundUp = lastKept % 2 !== 0;
    }
  } else {
    roundUp = false;
  }

  if (roundUp) {
    let index = digitsArray.length - 1;
    while (index >= 0) {
      if (digitsArray[index] === 9) {
        digitsArray[index] = 0;
        index -= 1;
      } else {
        digitsArray[index] += 1;
        break;
      }
    }
    if (index < 0) digitsArray.unshift(1);
  }

  const combined = digitsArray.join('');
  const splitAt = combined.length - digits;
  const resultText =
    digits > 0
      ? `${combined.slice(0, splitAt) || '0'}.${combined.slice(splitAt)}`
      : combined;

  const result = Number(resultText);
  // Normalise -0 to 0, matching Python's `round(-0.04, 1) == -0.0` display behaviour.
  return negative && result !== 0 ? -result : result;
}
