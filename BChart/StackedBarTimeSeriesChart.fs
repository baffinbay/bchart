namespace Lib

open System
open Fable.Core
open Feliz

module StackedBarTimeSeriesChartCompat =

  type Props = {
    id: string
    data: IDatum[] option
    startDate: DateTime
    endDate: DateTime
    title: string option
    tooltip: IDatum option -> ReactElement
    style: obj option
    timezone: TimeZone option
    leftAxis: {| enabled: bool |}
    rightAxis: {| unit: string option; enabled: bool |}
    settings: Settings[] option
  }

  and IDatum = { date: DateTime; item: Item }
  and [<EmitIndexer>] Item = string -> U2<float, DateTime> // this should probably be changed

  and [<StringEnum; RequireQualifiedAccess>] TimeZone =
    | [<CompiledName("UTC")>] UTC
    | [<CompiledName("LOCAL")>] LOCAL

  and Settings = {
    colorOrder: string[] option
    categories: {| key: string; strokeColor: string |}
  }

  [<ReactComponent(import = "StackedBarTimeSeriesChart", from = "./StackedBarTimeSeriesChart.tsx")>]
  let StackedBarChart (props: Props) = React.imported ()
