import React, { ReactElement } from 'react'
import styled from '@emotion/styled/macro'
import { ParentSize } from '@visx/responsive'
import Pie, { ProvidedProps, PieArcDatum } from '@visx/shape/lib/shapes/Pie'
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip'
import { localPoint } from '@visx/event'
import { animated, useTransition, interpolate } from 'react-spring'
import { Group } from '@visx/group'
import { humanizeNumber } from './utils'

const defaultMargin = { top: 10, right: 10, bottom: 10, left: 10 }

export interface getColor {
  inner: (label: string) => string
  outer: (label: string) => string
}

type Props = {
  title?: string
  getColor: getColor
  data:
  | Map<string, Map<string, number>>
  | Map<string, number>
  | [Map<string, number>, Map<string, number>, number]
  unit: string
  tooltipOuter?: (name: string, qty: number, share: number) => ReactElement
  // tooltipInner?: (name: string, qty: number, share: number) => ReactElement
  style?: object | undefined
}

/// sums the value of all the outer slices
const sumByOuterMapKeys = (
  x: Map<string, Map<string, number>>
): [string, number][] =>
  Array.from(x.entries()).map((a) => [
    a[0],
    Array.from(a[1].values()).reduce((a, c) => a + c, 0),
  ])

const mapToArrayOfEntries = (x: Map<string, number>): [string, number][] =>
  Array.from(x.entries())

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

/// sums the value of all the inner slices
const sumByInnerMapKeys = (
  x: Map<string, Map<string, number>>
): [string, number][] => {
  const map = Array.from(x.values()).reduce(
    (a, c) => merge(a, c),
    new Map<string, number>()
  )
  return Array.from(map.entries()).map((a) => [a[0], a[1]])
}

const sumNestedMap = (x: Map<string, Map<string, number>>): number =>
  Array.from(x.values())
    .flatMap((y) => Array.from(y.values()))
    .reduce((sum, v) => sum + v, 0)

const sumMap = (x: Map<string, number>): number =>
  Array.from(x.values()).reduce((sum, v) => sum + v, 0)

const isSingleDonutData = (
  x:
    | Map<string, Map<string, number>>
    | Map<string, number>
    | [Map<string, number>, Map<string, number>, number]
) => !Array.isArray(x) && typeof x.values().next().value === 'number'

const isPreComputedData = (
  x:
    | Map<string, Map<string, number>>
    | Map<string, number>
    | [Map<string, number>, Map<string, number>, number]
) => Array.isArray(x) && x.length === 3

const extractDonutData = (
  data:
    | Map<string, Map<string, number>>
    | Map<string, number>
    | [Map<string, number>, Map<string, number>, number]
): {
  totalSum: number
  outerPieData: [string, number][]
  innerPieData: [string, number][]
} => {
  if (isPreComputedData(data)) {
    let doubleDonutData = data as [
      Map<string, number>,
      Map<string, number>,
      number
    ]
    return {
      outerPieData: mapToArrayOfEntries(doubleDonutData[0]),
      innerPieData: mapToArrayOfEntries(doubleDonutData[1]),
      totalSum: doubleDonutData[2],
    }
  }
  if (isSingleDonutData(data)) {
    let singleDonutData = data as Map<string, number>
    return {
      totalSum: sumMap(singleDonutData),
      outerPieData: mapToArrayOfEntries(singleDonutData),
      innerPieData: [],
    }
  } else {
    let doubleDonutData = data as Map<string, Map<string, number>>
    return {
      totalSum: sumNestedMap(doubleDonutData),
      outerPieData: sumByOuterMapKeys(doubleDonutData),
      innerPieData: sumByInnerMapKeys(doubleDonutData),
    }
  }
}

export type PieProps = {
  width: number
  height: number
  title?: string
  margin?: typeof defaultMargin
  animate?: boolean
}

///
/// DoubleDonut component
///
export default function DonutDoubleChart({
  title,
  getColor,
  data,
  unit,
  tooltipOuter,
  style,
}: Props): ReactElement {

  const { totalSum, outerPieData, innerPieData } = extractDonutData(data)

  return (
    <Wrapper style={style}>
      <ParentSize>
        {({ width, height }) => (
          <Graph
            totalSum={totalSum}
            outerPieData={outerPieData}
            innerPieData={innerPieData}
            title={title}
            unit={unit}
            width={width}
            height={height}
            getColor={getColor}
            animate={true}
            tooltipOuter={tooltipOuter}
          />
        )}
      </ParentSize>
    </Wrapper>
  )
}

type GraphProps = {
  title?: string
  width: number
  height: number
  unit: string
  getColor: getColor
  totalSum: number
  outerPieData: [string, number][]
  innerPieData: [string, number][]
  margin?: typeof defaultMargin
  animate?: boolean
  tooltipOuter?: (name: string, qty: number, share: number) => ReactElement
}

function Graph({
  title,
  width,
  height,
  unit,
  getColor,
  margin = defaultMargin,
  animate,
  outerPieData,
  innerPieData,
  totalSum,
  tooltipOuter,
}: GraphProps) {
  const {
    tooltipData,
    tooltipOpen,
    showTooltip,
    hideTooltip,
    tooltipLeft = 0,
    tooltipTop = 0,
  } = useTooltip<[string, number]>()

  if (width < 10) return null

  const handleTooltip = (
    event: React.TouchEvent<SVGPathElement> | React.MouseEvent<SVGPathElement>,
    data: [string, number]
  ) => {
    const { x, y } = localPoint(event) || { x: 0, y: 0 }

    showTooltip({
      tooltipData: data,
      tooltipLeft: x,
      tooltipTop: y,
    })
  }

  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom
  const radius = Math.min(innerWidth, innerHeight) / 2
  const centerY = innerHeight / 2
  const centerX = innerWidth / 2
  const outerThickness = 30
  const innerOuterGap = 5
  const innerThickness = 15

  const diff = Math.abs(height - width)

  return (
    <>
      <svg width={'100%'} height={height}>
        <rect x={0} y={0} width={width} height={height} fill="#fff" />
        {title ? (
          <text
            x="50%"
            y={20}
            textAnchor="middle"
            width={width}
            fontSize={13}
            fontWeight={500}
            fill="#666"
          >
            {title}
          </text>
        ) : null}
        <Group
          top={centerY + margin.top + diff / 2}
          left={centerX + margin.left}
        >
          <Pie<[string, number]>
            data={outerPieData}
            pieValue={(d: [string, number]) => d[1]}
            outerRadius={radius}
            innerRadius={radius - outerThickness}
            cornerRadius={3}
            padAngle={0.005}
          >
            {(pie) => (
              <AnimatedPie<[string, number]>
                {...pie}
                animate={animate}
                getKey={(arc) => arc.data[0]}
                getColor={(arc) => getColor.outer(arc.data[0])}
                handleTooltip={handleTooltip}
                hideTooltip={hideTooltip}
              />
            )}
          </Pie>
          <Pie
            data={innerPieData}
            pieValue={(d: [string, number]) => d[1]}
            pieSortValues={() => -1}
            outerRadius={radius - outerThickness - innerOuterGap}
            innerRadius={
              radius - outerThickness - innerOuterGap - innerThickness
            }
          >
            {(pie) => (
              <AnimatedPie<[string, number]>
                {...pie}
                animate={animate}
                getKey={(arc) => arc.data[0]}
                getColor={(arc) => getColor.inner(arc.data[0])}
                handleTooltip={handleTooltip}
                hideTooltip={hideTooltip}
              />
            )}
          </Pie>
        </Group>
        <text
          x="50%"
          y={height / 2 - 5 + diff / 2}
          dominantBaseline="middle"
          textAnchor="middle"
          style={{ font: 'bold 1.9em sans-serif' }}
          fill="#000"
          fillOpacity={0.8}
        >
          {humanizeNumber(totalSum, 1)}
        </text>
        <text
          x="50%"
          y={height / 2 + 22 - 5 + diff / 2}
          dominantBaseline="middle"
          textAnchor="middle"
          style={{
            font: 'bold 0.8em sans-serif',
            textTransform: 'uppercase',
          }}
          fill="#000"
          fillOpacity={0.8}
        >
          {unit}
        </text>
      </svg>
      {tooltipOpen && tooltipData && (
        <TooltipWithBounds
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
            padding: '0.25rem 0.5rem',
          }}
        >
          {tooltipOuter ? (
            tooltipOuter(tooltipData[0], tooltipData[1], 0.1)
          ) : (
            <>
              <p style={{ textTransform: 'capitalize', fontWeight: 550 }}>
                {tooltipData[0]}
              </p>
              <p>
                {new Intl.NumberFormat('en').format(tooltipData[1])} {unit} (
                {((tooltipData[1] / totalSum) * 100).toFixed(2)}%)
              </p>
            </>
          )}
        </TooltipWithBounds>
      )}
    </>
  )
}

// react-spring transition definitions
type AnimatedStyles = { startAngle: number; endAngle: number; opacity: number }

const fromLeaveTransition = ({ endAngle }: PieArcDatum<any>) => ({
  // enter from 360° if end angle is > 180°
  startAngle: endAngle > Math.PI ? 2 * Math.PI : 0,
  endAngle: endAngle > Math.PI ? 2 * Math.PI : 0,
  opacity: 0,
})

const enterUpdateTransition = ({ startAngle, endAngle }: PieArcDatum<any>) => ({
  startAngle,
  endAngle,
  opacity: 1,
})

type AnimatedPieProps<Datum> = ProvidedProps<Datum> & {
  animate?: boolean
  getKey: (d: PieArcDatum<Datum>) => string
  getColor: (d: PieArcDatum<Datum>) => string
  handleTooltip: (
    event: React.TouchEvent<SVGPathElement> | React.MouseEvent<SVGPathElement>,
    d: Datum
  ) => void
  hideTooltip: () => void
  delay?: number
}

function AnimatedPie<Datum>({
  animate,
  arcs,
  path,
  getKey,
  getColor,
  handleTooltip,
  hideTooltip,
}: AnimatedPieProps<Datum>) {
  const transitions = useTransition<PieArcDatum<Datum>, AnimatedStyles>(
    arcs,
    getKey,
    // @ts-ignore react-spring doesn't like this overload
    {
      from: animate ? fromLeaveTransition : enterUpdateTransition,
      enter: enterUpdateTransition,
      update: enterUpdateTransition,
      leave: animate ? fromLeaveTransition : enterUpdateTransition,
    }
  )
  return (
    <>
      {transitions.map(
        ({
          item: arc,
          props,
          key,
        }: {
          item: PieArcDatum<Datum>
          props: AnimatedStyles
          key: string
        }) => {
          return (
            <g key={key}>
              <animated.path
                // compute interpolated path d attribute from intermediate angle values
                d={interpolate(
                  [props.startAngle, props.endAngle],
                  (startAngle, endAngle) =>
                    path({
                      ...arc,
                      startAngle,
                      endAngle,
                    })
                )}
                fill={getColor(arc)}
                onMouseOver={(e) => handleTooltip(e, arc.data)}
                onMouseMove={(e) => handleTooltip(e, arc.data)}
                onMouseOut={() => hideTooltip()}
              />
            </g>
          )
        }
      )}
    </>
  )
}

const Wrapper = styled.div`
  position: relative;
  padding: 0.25em;
  background: #fff;
  boxshadow: rgba(202, 202, 202, 0.2) 0px 0px 10px 0px;
`
