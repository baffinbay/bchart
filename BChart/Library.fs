namespace BChart

open Feliz
open Lib

/// Exposes the components in more F#y manner.
module Components =

  //TODO: implement params according to usage

  [<ReactComponent>]
  let DonutDoubleChart () =
    let props: DonutDoubleChartCompat.Props = failwith ""
    DonutDoubleChartCompat.DonutDoubleChart props

  [<ReactComponent>]
  let StackedAreaTimeSeriesChart () =
    let props: StackedAreaTimeSeriesChartCompat.Props = failwith ""
    StackedAreaTimeSeriesChartCompat.StackedAreaChart props

  [<ReactComponent>]
  let StackedBarTimeSeriesChart () =
    let props: StackedBarTimeSeriesChartCompat.Props = failwith ""
    StackedBarTimeSeriesChartCompat.StackedBarChart props
