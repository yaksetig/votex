import React from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface TallyChartDatum {
  name: string;
  [key: string]: string | number;
}

interface TallyResultsChartProps {
  chartData: TallyChartDatum[];
  option1Name: string;
  option2Name: string;
  /** Text alternative; the numbers are also listed beside the chart. */
  description: string;
}

/**
 * Two series, one per option, across whichever phases exist (ballots as
 * cast, and the tallied result once a tally ran). Ticks use the theme's
 * on-surface-variant so they meet contrast on the light panel.
 */
const TallyResultsChart: React.FC<TallyResultsChartProps> = ({ chartData, option1Name, option2Name, description }) => {
  return (
    <figure className="h-full" aria-label={description} role="img">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }} accessibilityLayer>
          <CartesianGrid stroke="#c5c6cd" strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#45474c", fontSize: 12, fontWeight: 600 }} />
          <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "#45474c", fontSize: 12 }} />
          <Tooltip
            cursor={{ fill: "rgba(0, 90, 194, 0.06)" }}
            contentStyle={{ borderRadius: 12, border: "1px solid #c5c6cd", boxShadow: "0 8px 24px rgba(9, 20, 38, 0.06)" }}
          />
          <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600, color: "#45474c" }} iconType="square" />
          <Bar dataKey={option1Name} fill="#0058be" radius={[6, 6, 0, 0]} />
          <Bar dataKey={option2Name} fill="#213145" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
};

export default TallyResultsChart;
