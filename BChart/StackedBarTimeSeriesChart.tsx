import {React, ReactElement, useCallback} from 'react'
import styled from '@emotion/styled/macro'
import dayjs, {Dayjs} from 'dayjs'
import utc from 'dayjs/plugin/utc'
import duration, {Duration} from 'dayjs/plugin/duration'
import {BarStack} from '@visx/shape'
import {scaleBand, scaleLinear, scaleOrdinal, scaleTime} from '@visx/scale'
import {AxisBottom, AxisLeft} from '@visx/axis'
import {Text} from '@visx/text'
import {GridColumns} from '@visx/grid'
import {useTooltip, TooltipWithBounds, defaultStyles} from '@visx/tooltip'
import {Group} from '@visx/group'
import {ParentSize} from '@visx/responsive'
import {
  orderKeysOnColor,
  mapToEvenResolution as mapToEvenBucketBoundaries,
  aggregateKeysAndDataByColor,
  humanizeNumber,
  IDatum
} from './utils'
import {localPoint} from '@visx/event'

dayjs.extend(utc)
dayjs.extend(duration)

const MIN_BARS = 1
const MAX_BARS = 300

const barSizeOptions: Array<{ amount: number; unit: 'm' | 'h' }> = [
  {amount: 1, unit: 'm'},
  {amount: 2, unit: 'm'},
  {amount: 5, unit: 'm'},
  {amount: 10, unit: 'm'},
  {amount: 15, unit: 'm'},
  {amount: 30, unit: 'm'},
  {amount: 1, unit: 'h'},
  {amount: 2, unit: 'h'},
  {amount: 3, unit: 'h'},
  {amount: 6, unit: 'h'},
  {amount: 12, unit: 'h'},
]

type Props<T> = {
  id: string
  data: T[] | undefined
  startDate: Dayjs
  endDate: Dayjs
  title?: string
  tooltip?(data: T | undefined): ReactElement
  style?: object | undefined
  timeZone?: 'UTC' | 'LOCAL'
  leftYAxis?: { enabled: boolean }
  rightYAxis?: {
    unit?: string
    enabled: boolean
  }
  settings?: {
    colorOrder?: string[]
    categories?: {
      key: string
      strokeColor: string
    }[]
  }
}

///
/// StackedAreaChart component
///
export default function StackedBarTimeSeriesChart<T extends IDatum>({
                                                                      data,
                                                                      title,
                                                                      style,
                                                                      timeZone = 'UTC',
                                                                      startDate,
                                                                      endDate,
                                                                      tooltip,
                                                                      leftYAxis = {enabled: true},
                                                                      rightYAxis = {enabled: false},
                                                                      settings,
                                                                    }: Props<T>): ReactElement {
  const keys = Object.keys(data[0] || []).filter((k) => k !== 'date')
  const orderedKeys = !!settings?.colorOrder
    ? (orderKeysOnColor(keys, settings) as (keyof T)[])
    : keys

  const margin = {
    top: title ? 36 : 0,
    right: rightYAxis.enabled ? 35 : 0,
    bottom: 22,
    left: leftYAxis.enabled ? 35 : 0,
  }

  const adjustedData = mapToEvenBucketBoundaries<T>(
    data,
    startDate,
    endDate,
    barSizeOptions,
    MIN_BARS,
    MAX_BARS
  )

  return (
    <Wrapper style={{...style, position: 'relative'}}>
      <ParentSize>
        {({width, height}) => (
          <Graph
            width={width}
            height={height}
            data={adjustedData}
            title={title}
            settings={settings}
            margin={margin}
            keys={orderedKeys}
            timeZone={timeZone}
            leftYAxis={leftYAxis}
            rightYAxis={rightYAxis}
            tooltip={tooltip}
          />
        )}
      </ParentSize>
    </Wrapper>
  )
}

type GraphProps<T extends IDatum> = {
  width: number
  height: number
  margin: { top: number; right: number; bottom: number; left: number }
  data: T[]
  title?: string
  keys: (keyof T)[]
  timeZone: 'UTC' | 'LOCAL'
  tooltip?(data: T | undefined): ReactElement
  leftYAxis?: { enabled: boolean }
  rightYAxis?: {
    unit?: string
    enabled: boolean
  }
  settings?: {
    colorOrder?: string[]
    categories?: {
      key: string
      strokeColor: string
    }[]
  }
}

function Graph<T extends IDatum>({
                                   width,
                                   height,
                                   margin,
                                   data,
                                   keys,
                                   title,
                                   timeZone,
                                   tooltip,
                                   leftYAxis = {enabled: true},
                                   rightYAxis = {enabled: false},
                                   settings,
                                 }: GraphProps<T>) {
  const {
    tooltipData,
    tooltipLeft,
    tooltipTop = 0,
    tooltipOpen = 0,
    showTooltip,
    hideTooltip,
  } = useTooltip<T>()
  const {
    tooltipData: timeTooltipData,
    tooltipLeft: timeTooltipLeft,
    tooltipOpen: timeTooltipOpen = 0,
    showTooltip: timeShowTooltip,
    hideTooltip: timeHideTooltip,
  } = useTooltip<Date>()
  const parseDate = timeZone === 'UTC' ? dayjs.utc : dayjs

  const valueMax = data.reduce((acc, cur) => {
    const tot = keys
      .map((k): number => Number(cur[k]).valueOf())
      .reduce((a, c) => a + c, 0)

    return Math.max(acc, tot)
  }, 0)

  const yScale = scaleLinear<number>({
    domain: [0, valueMax],
    nice: true,
  })

  const dateScale = scaleBand<string>({
    domain: data.map((data) => data.date.toString()),
    padding: 1.5 / (width / data.length),
  })

  const xMax = width - margin.left - margin.right
  const yMax = height - margin.top - margin.bottom

  dateScale.rangeRound([0, xMax]).round(false)
  yScale.range([yMax, 0])

  const xScale = scaleTime<number>({
    range: [0, xMax],
    domain: [
      Math.min(...data.map((x) => x.date.valueOf())),
      Math.max(...data.map((x) => x.date.valueOf())),
    ],
  })

  const barDuration =
    data.length >= 2
      ? dayjs.duration(dayjs(data[1].date).diff(dayjs(data[0].date)))
      : dayjs.duration(1, 'm')

  const {keys: colorKeys, data: dataByColor} = aggregateKeysAndDataByColor<T>(
    keys,
    data,
    settings
  )

  const colorScale = scaleOrdinal<keyof T, string>({
    domain: colorKeys,
    range: colorKeys,
  })

  const handleTooltip = useCallback(
    (
      event:
        | React.TouchEvent<SVGRectElement>
        | React.MouseEvent<SVGRectElement>,
      barIndex: number
    ) => {
      const {x} = localPoint(event) || {x: 0}
      if (
        keys.reduce(
          (sum: number, k) => (data[barIndex][k] as number) + sum,
          0
        ) > 0
      ) {
        showTooltip({
          tooltipData: data[barIndex],
          tooltipLeft: x,
          tooltipTop: margin.top,
        })
      } else {
        hideTooltip()
      }
      timeShowTooltip({
        tooltipData: data[barIndex].date.toDate(),
        tooltipLeft: x,
        tooltipTop: margin.top,
      })
    },
    [data, margin.top, showTooltip, keys, hideTooltip, timeShowTooltip]
  )

  const LeftAxis =
    leftYAxis.enabled === true ? (
      <AxisLeft
        left={margin.left}
        top={margin.top}
        scale={yScale}
        tickFormat={(d) => humanizeNumber(d.valueOf(), 1)}
        stroke="#ccc"
        tickStroke="#ccc"
        tickLength={3}
        hideAxisLine={true}
        hideTicks={true}
        tickLabelProps={() => ({
          fill: '#666',
          fontSize: 10,
          textAnchor: 'middle',
          x: -17,
        })}
        numTicks={3}
      />
    ) : null

  const RightAxis =
    rightYAxis.enabled === true ? (
      <Text
        angle={-90}
        width={width}
        height={height}
        verticalAnchor="end"
        textAnchor="middle"
        fontSize={10}
        x={width - 14}
        y={height / 2}
        fill="#666"
      >
        {rightYAxis.unit}
      </Text>
    ) : null

  const hoverDateScale = dateScale.copy()
  hoverDateScale.padding(0)

  return (
    <>
      <svg width={'100%'} height={height}>
        <rect x={0} y={0} width={width} height={height} fill="#fff"/>
        <Text
          width={width}
          verticalAnchor="start"
          textAnchor="middle"
          fontSize={13}
          fontWeight={500}
          x={width / 2}
          y={10}
          fill="#666"
        >
          {title}
        </Text>
        <Group top={margin.top} left={margin.left}>
          <BarStack<IDatum, string>
            data={dataByColor}
            keys={colorKeys}
            xScale={dateScale}
            yScale={yScale}
            color={colorScale}
            x={(x) => x.date.toString()}
          >
            {(barStacks) =>
              barStacks.map((barStack) => {
                return barStack.bars.map((bar) => (
                  <rect
                    key={`bar-stack-${barStack.index}-${bar.index}`}
                    x={bar.x}
                    y={bar.y}
                    height={Math.max(0, bar.height)}
                    width={bar.width}
                    fill={bar.color}
                    strokeWidth={0}
                    stroke="black"
                    strokeOpacity={0}
                  />
                ))
              })
            }
          </BarStack>
          <BarStack<{ date: Dayjs; value: number }, string>
            data={data.map((x) => ({
              date: x.date,
              value: 0,
            }))}
            keys={['value']}
            xScale={hoverDateScale}
            yScale={yScale}
            color={() => '#eee'}
            x={(x) => x.date.toString()}
          >
            {(barStacks) =>
              barStacks.map((barStack) => {
                return barStack.bars.map((bar) => (
                  <Rect
                    key={`bar-stack-${barStack.index}-${bar.index}`}
                    x={bar.x}
                    y={bar.y - yMax}
                    height={Math.max(0, yMax)}
                    width={bar.width}
                    onTouchStart={(e) => handleTooltip(e, bar.index)}
                    onMouseEnter={(e) => handleTooltip(e, bar.index)}
                    onMouseLeave={() => {
                      if (tooltipOpen) {
                        hideTooltip()
                      }
                      if (timeTooltipOpen) {
                        timeHideTooltip()
                      }
                    }}
                    onTouchEnd={() => {
                      if (tooltipOpen) {
                        hideTooltip()
                      }
                      if (timeTooltipOpen) {
                        timeHideTooltip()
                      }
                    }}
                  />
                ))
              })
            }
          </BarStack>

          <GridColumns
            top={0}
            scale={xScale}
            numTicks={3}
            height={yMax}
            strokeDasharray="1,3"
            stroke="#000"
            strokeOpacity={0.2}
            pointerEvents="none"
          />
        </Group>
        {LeftAxis}
        {RightAxis}
        <AxisBottom
          top={yMax + margin.top}
          left={margin.left}
          scale={xScale}
          hideAxisLine={true}
          hideTicks={true}
          tickFormat={(d: any) => {
            const date = parseDate(d)
            return date.format('DD/MM HH:mm')
          }}
          stroke="#ccc"
          tickStroke="#ccc"
          tickLength={3}
          tickLabelProps={() => ({
            fill: '#666',
            fontSize: 10,
            textAnchor: 'middle',
            y: 16,
          })}
          numTicks={3}
        />
      </svg>
      {tooltipOpen && !!tooltip && (
        <TooltipWithBounds
          // set this to random so it correctly updates with parent bounds
          key={Math.random()}
          top={tooltipTop}
          left={tooltipLeft ?? 0}
          offsetLeft={20}
          style={{
            ...defaultStyles,
            background: '#fff',
            border: '1px solid #072234',
            fontSize: '0.75rem',
            fontFamily: 'sans-serif',
            color: '#072234',
            lineHeight: '1.1rem',
            margin: '0',
            padding: '0.25rem 0.5rem 0.1rem 0.5rem',
          }}
        >
          {tooltip(tooltipData)}
        </TooltipWithBounds>
      )}
      {timeTooltipOpen && (
        <TooltipWithBounds
          top={yMax + 5}
          left={timeTooltipLeft ?? 0}
          offsetLeft={20}
          style={{
            ...defaultStyles,
            background: '#fff',
            border: '1px solid #072234',
            fontSize: '0.75rem',
            color: '#072234',
            margin: '0',
            padding: '0.25rem 0.5rem 0.1rem 0.5rem',
          }}
        >
          {formatBarRangeTooltip(parseDate(timeTooltipData), barDuration)}
        </TooltipWithBounds>
      )}
    </>
  )
}

function formatBarRangeTooltip(
  intervalStart: Dayjs,
  intervalDuration: Duration
) {
  const intervalEnd = intervalStart.add(intervalDuration)
  return `${intervalStart.format('DD/MM HH:mm:ss')}-${intervalEnd.format(
    'HH:mm:ss'
  )}`
}

const Wrapper = styled.div`
  padding: 0.25em;
  background: #fff;
  boxshadow: rgba(202, 202, 202, 0.2) 0px 0px 10px 0px;
`

const Rect = styled.rect`
  fill: black;
  opacity: 0;
  :hover {
    opacity: 0.1;
  }
`
