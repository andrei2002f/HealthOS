"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip,
  ReferenceLine,
} from "recharts";

type DataPoint = {
  date: string;
  value: number | null;
};

type Props = {
  data: DataPoint[];
  color?: string;
  /** If provided, draws a horizontal reference line (e.g. target threshold). */
  referenceValue?: number;
  /** Unit appended to the value in the tooltip, e.g. "%" or "h". */
  unit?: string;
  /** Number of decimal places shown in tooltip (default 0). */
  decimals?: number;
  height?: number;
};

export function SparklineChart({
  data,
  color = "#6366f1",
  referenceValue,
  unit = "",
  decimals = 0,
  height = 48,
}: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        {referenceValue !== undefined && (
          <ReferenceLine
            y={referenceValue}
            stroke={color}
            strokeDasharray="3 3"
            strokeOpacity={0.4}
          />
        )}
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const v = payload[0].value as number | null;
            if (v == null) return null;
            return (
              <div className="rounded-md bg-popover px-2 py-1 text-xs shadow-md">
                {v.toFixed(decimals)}
                {unit}
              </div>
            );
          }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={false}
          connectNulls={true}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
