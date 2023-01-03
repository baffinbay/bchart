import dayjs from 'dayjs'
import duration from 'dayjs/plugin/duration'

dayjs.extend(duration)

const scale = [
  { key: '', from: 1 },
  { key: 'k', from: 1e3 },
  { key: 'M', from: 1e6 },
  { key: 'G', from: 1e9 },
  { key: 'T', from: 1e12 },
  { key: 'P', from: 1e15 },
  { key: 'E', from: 1e18 },
  { key: 'Z', from: 1e21 },
  { key: 'Y', from: 1e24 },
].sort((a, b) => (a.from < b.from ? 1 : -1))

export function humanizeNumber(number: number, maxDecimalDigits: number = 0) {
  const factor = scale.find((x) => x.from <= number) ?? { key: '', from: 1 }
  return `${Math.round(
    (number / factor.from + Number.EPSILON) * Math.pow(10, maxDecimalDigits)
  ) / Math.pow(10, maxDecimalDigits)
    }${factor.key}`
}