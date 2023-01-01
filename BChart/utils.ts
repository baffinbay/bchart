import dayjs, {Dayjs} from 'dayjs'
import duration from 'dayjs/plugin/duration'

dayjs.extend(duration)

export function merge(
  mapOne: Map<string, number>,
  mapTwo: Map<string, number>
): Map<string, number> {
  return new Map<string, number>(
    Array.from(new Map([...mapOne, ...mapTwo]).keys()).map((key) => [
      key,
      (mapOne.get(key) ?? 0) + (mapTwo.get(key) ?? 0),
    ])
  )
}

const scale = [
  {key: '', from: 1},
  {key: 'k', from: 1e3},
  {key: 'M', from: 1e6},
  {key: 'G', from: 1e9},
  {key: 'T', from: 1e12},
  {key: 'P', from: 1e15},
  {key: 'E', from: 1e18},
  {key: 'Z', from: 1e21},
  {key: 'Y', from: 1e24},
].sort((a, b) => (a.from < b.from ? 1 : -1))

export function humanizeNumber(number: number, maxDecimalDigits: number = 0) {
  const factor = scale.find((x) => x.from <= number) ?? {key: '', from: 1}
  return `${
    Math.round(
      (number / factor.from + Number.EPSILON) * Math.pow(10, maxDecimalDigits)
    ) / Math.pow(10, maxDecimalDigits)
  }${factor.key}`
}

export interface IDatum {
  date: Date

  [propName: string]: number | Date
}

// utils for stackedBarChart
function intervalConverterFactory(
  barSizeOptions: Array<{ amount: number; unit: 'm' | 'h' }>
) {
  return barSizeOptions.map(({unit, amount}) => ({
    unit: unit,
    duration: dayjs.duration(amount, unit),
    startOfInterval: (d: Dayjs) => {
      return d.startOf(unit).subtract(d.get(unit) % amount, unit)
    },
    endOfInterval: (d: Dayjs) => {
      const roundedTimestamp = d
        .startOf(unit)
        .add((amount - (d.get(unit) % amount)) % amount, unit)
      if (roundedTimestamp.isBefore(d)) {
        return roundedTimestamp.add(amount, unit)
      }
      return roundedTimestamp
    },
  }))
}

export function mapToEvenResolution<T extends IDatum>(
  data: T[],
  startDate: Dayjs,
  endDate: Dayjs,
  barSizeOptions: Array<{ amount: number; unit: 'm' | 'h' }>,
  minBars: number,
  maxBars: number
): T[] {
  const intervalConverters = intervalConverterFactory(barSizeOptions)
  const intervalSettings = intervalConverters
    .map((x) => {
      const intervalStart = x.startOfInterval(dayjs(startDate))
      const intervalEnd = x.endOfInterval(dayjs(endDate))
      const intervalLength = intervalEnd.diff(intervalStart, x.unit)
      const numBars = intervalLength / x.duration.as(x.unit)
      return {
        unit: x.unit,
        numBars: numBars,
        barWidth: intervalLength / numBars,
        intervalStart,
      }
    })
    .find(({numBars: bars}) => minBars <= bars && bars <= maxBars)

  if (!intervalSettings) {
    console.error(
      'failed to generate interval settings given > ',
      startDate,
      endDate,
      minBars,
      maxBars
    )
    throw new Error('Did not find proper bar interval')
  }

  const keys = Object.keys(data[0] || []).filter(
    (k) => k !== 'date'
  ) as (keyof T)[]

  const newData = new Array(intervalSettings.numBars).fill(0).map((_, i) =>
    keys.reduce((zeroObj, k) => ({...zeroObj, [k]: 0}), {
      date: intervalSettings.intervalStart.add(
        intervalSettings.barWidth * i,
        intervalSettings.unit
      ),
    })
  ) as T[]

  return data.reduce((newData, d) => {
    const index = Math.floor(
      dayjs(d.date).diff(
        intervalSettings.intervalStart,
        intervalSettings.unit
      ) / intervalSettings.barWidth
    )

    // exclude data outside of chart interval
    if (!newData[index]) {
      return newData
    }

    newData[index] = keys.reduce((newVal, k) => {
      return {...newVal, [k]: (newVal[k] as number) + (d[k] as number)}
    }, newData[index])
    return newData
  }, newData)
}

export function orderKeysOnColor(
  keys: string[],
  settings: {
    colorOrder?: string[]
    categories?: {
      key: string
      strokeColor: string
    }[]
  }
) {
  const colorOrderMap =
    settings.colorOrder?.reduce(
      (map: { [key: string]: number }, x, i) => ({...map, [x]: i}),
      {}
    ) ?? {}

  const keyToOrder =
    settings.categories?.reduce(
      (map: { [key: string]: number }, x) => ({
        ...map,
        [x.key]: colorOrderMap[x.strokeColor] ?? 0,
      }),
      {}
    ) ?? {}

  return keys
    .sort((a, b) => {
      if (!colorOrderMap) {
        return 0
      }
      return (keyToOrder[a] ?? 0) - (keyToOrder[b] ?? 0)
    })
    .reverse()
}

export function aggregateKeysAndDataByColor<T extends IDatum>(
  keys: (keyof T)[],
  data: T[],
  settings?: {
    colorOrder?: string[]
    categories?: {
      key: string
      strokeColor: string
    }[]
  }
): { data: IDatum[]; keys: string[] } {
  // properties with the same color is aggregated together. What the actual key is does not matter for the chart.
  // Each key gets its own bar segment. Merging bar segments with the same color into one bar segment removes the issue
  // where stripes appear where bar segments meet.
  const colorGenerator = defaultColorGenerator()
  const keysToColorKeys = keys.reduce((obj, x) => {
    const category = settings?.categories?.find((y) => y.key === x)
    if (category) {
      return {...obj, [x]: category.strokeColor}
    } else {
      return {...obj, [x]: colorGenerator.next().value}
    }
  }, {}) as { [x: string]: string }

  const colorKeys = [...new Set(Object.values(keysToColorKeys))]
  const zeroPoint = [...new Set(Object.values(keysToColorKeys))].reduce(
    (obj, k) => ({...obj, [k]: 0}),
    {}
  ) as { [x: string]: number }

  const dataByColor = data.map((x) => {
    const newData = Object.entries(keysToColorKeys).reduce(
      (dataByColor, [k, colorKey]) => {
        return {
          ...dataByColor,
          [colorKey]: dataByColor[colorKey] + (x[k] as number),
        }
      },
      zeroPoint
    )

    return {...newData, date: x.date} as IDatum
  })

  return {keys: colorKeys, data: dataByColor}
}

function* defaultColorGenerator() {
  while (true) {
    yield 'rgb(32, 89, 140, 0.4)'
    yield 'rgb(32, 89, 140, 0.8)'
    yield 'rgb(32, 89, 140, 0.2)'
    yield 'rgb(32, 89, 140, 1)'
    yield 'rgb(32, 89, 140, 0.6)'
  }
}
