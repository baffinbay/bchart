import React, { ReactElement, useCallback } from 'react'
import styled from '@emotion/styled/macro'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { Text } from '@visx/text'
import { AreaStack, Bar, Line } from '@visx/shape'
import { GridColumns } from '@visx/grid'
import { curveMonotoneX } from '@visx/curve'
import { SeriesPoint } from '@visx/shape/lib/types'
import { LinearGradient } from '@visx/gradient'
import { AxisBottom, AxisLeft } from '@visx/axis'
import { Group } from '@visx/group'
import { scaleTime, scaleLinear } from '@visx/scale'
import { ParentSize } from '@visx/responsive'
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip'
import { localPoint } from '@visx/event'
import { bisector } from 'd3-array'
import { humanizeNumber } from './utils'

dayjs.extend(utc)

type Gradient = {
  from: string
  to: string
}

export interface IDatum {
  date: Date

  [propName: string]: number | Date
}

type Props<T> = {
  id: string
  data: T[]
  title: string
  tooltip?(data: T | undefined): ReactElement
  unit: string
  settings: {
    key: string
    gradient: Gradient
    strokeColor: string
  }[]
  style?: object | undefined
  timeZone?: 'UTC' | 'LOCAL'
}

///
/// StackedAreaChart component
///
export default function StackedAreaChart<T extends IDatum>({
  id,
  data,
  title,
  tooltip,
  unit,
  settings,
  style,
  timeZone = 'UTC',
}: Props<T>): ReactElement {

  const keys = Object.keys(data[0] || []).filter(
    (k) => k !== 'date'
  ) as (keyof T)[]

  return (
    <Wrapper style={{ ...style, position: 'relative' }}>
      <ParentSize>
        {({ width, height }) => (
          <Graph
            id={id}
            width={width}
            height={height}
            data={data}
            title={title}
            unit={unit}
            keys={keys}
            settings={settings}
            timeZone={timeZone}
            tooltip={tooltip}
          />
        )}
      </ParentSize>
    </Wrapper>
  )
}

type GraphProps<T extends IDatum> = {
  id: string
  width: number
  height: number
  margin?: { top: number; right: number; bottom: number; left: number }
  data: T[]
  title: string
  unit: string
  tooltip?(data: T | undefined): ReactElement
  settings: {
    key: string
    gradient: Gradient
    strokeColor: string
  }[]
  keys: (keyof T)[]
  timeZone: 'UTC' | 'LOCAL'
}

function Graph<T extends IDatum>({
  id,
  width,
  height,
  margin = { top: 36, right: 35, bottom: 22, left: 35 },
  data,
  title,
  unit,
  settings,
  keys,
  timeZone,
  tooltip,
}: GraphProps<T>) {
  const {
    tooltipData,
    tooltipLeft,
    tooltipTop = 0,
    tooltipOpen = 0,
    showTooltip,
    hideTooltip,
  } = useTooltip<T>()

  const parseDate = timeZone === 'UTC' ? dayjs.utc : dayjs
  // bounds
  const yMax = height - margin.top - margin.bottom
  const xMax = width - margin.left - margin.right

  // scales
  const xScale = scaleTime<number>({
    range: [0, xMax],
    domain: [
      Math.min(...data.map((x) => x.date.valueOf())),
      Math.max(...data.map((x) => x.date.valueOf())),
    ],
  })

  /// Calculates the max value of the sum of the stacked values
  const valueMax = data.reduce((acc, cur) => {
    const tot = keys
      .map((k): number => Number(cur[k]).valueOf())
      .reduce((a, c) => a + c, 0)

    return tot > acc ? tot : acc
  }, 0)

  const yScale = scaleLinear<number>({
    range: [yMax, 0],
    domain: [0, valueMax],
  })

  const getY0 = (d: SeriesPoint<T>): number => d[0]
  const getY1 = (d: SeriesPoint<T>): number => d[1]

  const bisectDate = bisector<T, Date>((d: T) => new Date(d.date)).left

  const handleTooltip = useCallback(
    (
      event: React.TouchEvent<SVGRectElement> | React.MouseEvent<SVGRectElement>
    ) => {
      const { x } = localPoint(event) || { x: 0 }
      const xx = x - margin.left
      const x0 = xScale.invert(xx)
      const index = bisectDate(data, x0, 1)
      const d0 = data[index - 1]
      const d1 = data[index]
      let d = d0
      if (d1 && d1.date) {
        d =
          x0.valueOf() - d0.date.valueOf() > d1.date.valueOf() - x0.valueOf()
            ? d1
            : d0
      }
      showTooltip({
        tooltipData: d,
        tooltipLeft: x,
        tooltipTop: margin.top,
      })
    },
    [bisectDate, data, margin.left, margin.top, showTooltip, xScale]
  )
  return width < 10 ? null : (
    <>
      <svg width={'100%'} height={height}>
        <rect x={0} y={0} width={width} height={height} fill="#fff" />
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

        {settings.map((g) => {
          return (
            <LinearGradient
              key={`satc-lg-${id}-${g.key}`}
              id={`satc-lg-${id}-${g.key}`}
              from={g.gradient.from}
              to={g.gradient.to}
            />
          )
        })}

        <Group top={margin.top} left={margin.left}>
          <AreaStack<T, string>
            keys={keys.map((x) => x.toString())}
            data={data}
            x={(d) => xScale(d.data.date.valueOf()) ?? 0}
            y0={(d) => yScale(getY0(d)) ?? 0}
            y1={(d) => yScale(getY1(d)) ?? 0}
            curve={curveMonotoneX}
          >
            {({ stacks, path }) =>
              stacks
                .map((stack) => {
                  const strokeColor =
                    settings.find((x) => x.key === stack.key)?.strokeColor ??
                    '#000'
                  return (
                    <path
                      key={`stack-${id}-${stack.key}`}
                      d={path(stack) || ''}
                      fill={`url(#satc-lg-${id}-${stack.key})`}
                      strokeWidth={1}
                      stroke={strokeColor}
                    />
                  )
                })
                .reverse()
            }
          </AreaStack>

          {/** Cancels out the bottom stroke of the path  */}
          <line
            x1="0"
            y1={height - margin.top - margin.bottom}
            x2={width - margin.right - margin.left}
            y2={height - margin.top - margin.bottom}
            stroke="#fff"
            strokeWidth={1}
          />

          {/** Cancels out the left stroke of the path  */}
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={height - margin.top - margin.bottom}
            stroke="#fff"
            strokeWidth={2}
          />

          {/** Cancels out the right stroke of the path  */}
          <line
            x1={width - margin.right - margin.left}
            y1={0}
            x2={width - margin.right - margin.left}
            y2={height - margin.top - margin.bottom}
            stroke="#fff"
            strokeWidth={2}
          />

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
          {unit}
        </Text>
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
        <Bar
          x={margin.left}
          y={margin.top}
          width={xMax}
          height={yMax}
          fill="transparent"
          onTouchStart={handleTooltip}
          onTouchMove={handleTooltip}
          onMouseMove={handleTooltip}
          onMouseLeave={() => hideTooltip()}
        />
        {tooltipOpen && (
          <g>
            <Line
              from={{ x: tooltipLeft, y: margin.top }}
              to={{ x: tooltipLeft, y: yMax + margin.top }}
              stroke="#999"
              strokeWidth={1}
              pointerEvents="none"
              strokeDasharray="5,1"
            />
          </g>
        )}
      </svg>
      {tooltipOpen && !!tooltip && (
        <>
          <TooltipWithBounds
            // set this to random so it correctly updates with parent bounds
            key={Math.random()}
            top={tooltipTop}
            left={tooltipLeft}
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
          <TooltipWithBounds
            top={yMax + 5}
            left={tooltipLeft}
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
            {parseDate(tooltipData?.date).format('YYYY-MM-DD HH:mm:ss')}
          </TooltipWithBounds>
        </>
      )}
    </>
  )
}

const Wrapper = styled.div`
  padding: 0.25em;
  background: #fff;
  boxshadow: rgba(202, 202, 202, 0.2) 0px 0px 10px 0px;
`
