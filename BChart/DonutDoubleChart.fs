namespace BChart

open System.Collections.Generic
open Fable.Core
open Feliz

module DonutDoubleChartCompat =
  type Props = {
    title: string option
    getColor: GetColor
    data: U3<T1, T2, T3> option
    unit: string
    tooltipOuter: Tooltip option
    tooltipInner: Tooltip option
    style: obj option // should be changed
  }

  and GetColor = {
    inner: string -> string
    outer: string -> string
  }

  and T1 = Dictionary<string, Dictionary<string, int>>
  and T2 = Dictionary<string, int>
  and T3 = (Dictionary<string, int> * Dictionary<string, int> * int) array
  and Tooltip = string * int * int -> ReactElement

  [<ReactComponent(import = "DonutDoubleChart", from = "./DonutDoubleChart.tsx")>]
  let DonutDoubleChart (props: Props) = React.imported ()
