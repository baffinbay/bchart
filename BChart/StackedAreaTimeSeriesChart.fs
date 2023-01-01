namespace BChart

namespace Lib

open System
open Fable.Core
open Feliz

module StackedAreaTimeSeriesChartCompat =

  type Props = {
    id: string
    data: IDatum[] option
    title: string
    tooltip: IDatum option -> ReactElement
    unit: string
    settings: Settings[]
    timeZone: TimeZone
  }

  and IDatum = { date: DateTime; item: Item }
  and [<EmitIndexer>] Item = string -> U2<float, DateTime> // this should probably be changed

  and Settings = {
    key: string
    gradient: Gradient
    strokeColor: string
  }

  and Gradient = { from: string; ``to``: string }

  and [<StringEnum; RequireQualifiedAccess>] TimeZone =
    | [<CompiledName("UTC")>] UTC
    | [<CompiledName("LOCAL")>] LOCAL


  [<ReactComponent(import = "StackedAreaChart", from = "./StackedAreaTimeSeriesChart.tsx")>]
  let StackedAreaChart (props: Props) = React.imported ()
