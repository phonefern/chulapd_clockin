"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type AttendanceChartPoint = {
  date: string;
  label: string;
  present: number;
  avgHours: number;
};

function ChartShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-slate-950">{title}</h2>
      <div className="h-72 w-full">{children}</div>
    </div>
  );
}

export function AttendanceCharts({ data }: { data: AttendanceChartPoint[] }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartShell title="จำนวนคนลงเวลาต่อวัน">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: -20, right: 12 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
            <Tooltip
              cursor={{ fill: "rgba(15, 23, 42, 0.06)" }}
              formatter={(value) => [`${value} คน`, "ลงเวลา"]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""}
            />
            <Bar dataKey="present" fill="#16a34a" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>

      <ChartShell title="ชั่วโมงทำงานเฉลี่ยต่อวัน">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: -20, right: 12 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis tickLine={false} axisLine={false} fontSize={12} />
            <Tooltip
              cursor={{ fill: "rgba(15, 23, 42, 0.06)" }}
              formatter={(value) => [`${Number(value).toFixed(2)} ชม.`, "เฉลี่ย"]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""}
            />
            <Bar dataKey="avgHours" fill="#2563eb" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartShell>
    </div>
  );
}
