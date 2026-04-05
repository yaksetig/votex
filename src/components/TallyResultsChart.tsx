import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface TallyChartDatum {
  name: string;
  [key: string]: string | number;
}

interface TallyResultsChartProps {
  chartData: TallyChartDatum[];
  option1Name: string;
  option2Name: string;
}

const TallyResultsChart: React.FC<TallyResultsChartProps> = ({
  chartData,
  option1Name,
  option2Name,
}) => {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
        <CartesianGrid stroke="#d9dce2" strokeDasharray="4 4" vertical={false} />
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#44474c", fontSize: 12, fontWeight: 600 }}
        />
        <YAxis
          allowDecimals={false}
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#74777d", fontSize: 12 }}
        />
        <Tooltip
          cursor={{ fill: "rgba(0, 90, 194, 0.06)" }}
          contentStyle={{
            borderRadius: 16,
            border: "1px solid rgba(196, 198, 205, 0.5)",
            boxShadow: "0 18px 48px rgba(0, 20, 54, 0.08)",
          }}
        />
        <Bar dataKey={option1Name} fill="#005ac2" radius={[10, 10, 0, 0]} />
        <Bar dataKey={option2Name} fill="#4f6073" radius={[10, 10, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default TallyResultsChart;
